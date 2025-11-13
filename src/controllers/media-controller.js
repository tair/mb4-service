import sequelizeConn from '../util/db.js'
import * as service from '../services/media-service.js'
import * as bibliographyService from '../services/bibliography-service.js'
import * as folioService from '../services/folios-service.js'
import { convertMediaTypeFromMimeType } from '../util/media.js'
import { unzip, cleanupTempDirectory } from '../util/zip.js'
import { models } from '../models/init-models.js'
import { S3MediaUploader } from '../lib/s3-media-uploader.js'
import { VideoProcessor } from '../lib/video-processor.js'
import { convertMediaTypeFromExtension } from '../util/media.js'
import { MEDIA_TYPES } from '../util/media-constants.js'
import { promises as fs } from 'fs'
import {
  ModelRefencialMapper,
  ModelReferencialConfig,
} from '../lib/datamodel/model-referencial-mapper.js'
import s3Service from '../services/s3-service.js'
import config from '../config.js'
import path from 'path'
import { getSpecimenName } from '../util/specimen.js'
import { getTaxonName } from '../util/taxa.js'

/**
 * Validates specimen and view IDs for a given project
 * @param {number|null} specimenId - The specimen ID to validate
 * @param {number|null} viewId - The view ID to validate
 * @param {number} projectId - The project ID to validate against
 * @returns {Promise<{specimen_id: number|null, view_id: number|null}>} Validated and normalized IDs
 * @throws {Error} If validation fails
 */
async function validateSpecimenAndView(specimenId, viewId, projectId) {
  let validatedSpecimenId = null
  let validatedViewId = null

  // Validate specimen_id
  if (specimenId && specimenId !== '' && specimenId !== 'null') {
    const specimen = await models.Specimen.findByPk(specimenId)
    if (specimen == null || specimen.project_id != projectId) {
      throw new Error('Specimen is not found or does not belong to this project')
    }
    validatedSpecimenId = specimenId
  }

  // Validate view_id
  if (viewId && viewId !== '' && viewId !== 'null') {
    const view = await models.MediaView.findByPk(viewId)
    if (view == null || view.project_id != projectId) {
      throw new Error('View is not found or does not belong to this project')
    }
    validatedViewId = viewId
  }

  return {
    specimen_id: validatedSpecimenId,
    view_id: validatedViewId
  }
}

/**
 * Replace the file extension in a filename with a new extension
 * Handles edge cases like files with multiple dots and hidden files
 * @param {string} filename - Original filename (e.g., "archive.v2.zip", ".gitignore", "photo.jpg")
 * @param {string} newExtension - New extension without dot (e.g., "tif", "png")
 * @returns {string} Filename with replaced extension
 */
function replaceFileExtension(filename, newExtension) {
  if (!filename || !newExtension) {
    return filename
  }

  // Find the last dot in the filename
  const lastDotIndex = filename.lastIndexOf('.')
  
  // If no extension found, just append the new extension
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    return `${filename}.${newExtension}`
  }
  
  // Replace the extension after the last dot
  const basename = filename.substring(0, lastDotIndex)
  return `${basename}.${newExtension}`
}

export async function getMediaFiles(req, res) {
  const projectId = req.params.projectId
  try {
    const media = await service.getMediaFiles(projectId)
    res.status(200).json({
      media: media.map((row) => convertMediaResponse(row)),
    })
  } catch (err) {
    console.error(`Error: Cannot media files for ${projectId}`, err)
    res.status(500).json({ message: 'Error while fetching media files.' })
  }
}

export async function createMediaFile(req, res) {
  const projectId = req.params.projectId

  const media = models.MediaFile.build(req.body)

  // Ensure that the specimen_id is within the same project.
  if (
    media.specimen_id &&
    media.specimen_id !== '' &&
    media.specimen_id !== 'null'
  ) {
    const specimen = await models.Specimen.findByPk(media.specimen_id)
    if (specimen == null || specimen.project_id != projectId) {
      res.status(404).json({ message: 'Specimen is not found' })
      return
    }
  } else {
    // Set specimen_id to null if it's empty or invalid
    media.specimen_id = null
  }

  // Ensure that the media view is within the same project.
  if (media.view_id && media.view_id !== '' && media.view_id !== 'null') {
    const view = await models.MediaView.findByPk(media.view_id)
    if (view == null || view.project_id != projectId) {
      res.status(404).json({ message: 'View is not found' })
      return
    }
  } else {
    // Set view_id to null if it's empty or invalid
    media.view_id = null
  }

  if (media.is_copyrighted == 0) {
    media.copyright_permission = 0
  }

  // Set media type based on uploaded file or default to image
  let mediaType = MEDIA_TYPES.IMAGE // Default to image
  if (req.file && req.file.mimetype) {
    mediaType = convertMediaTypeFromMimeType(req.file.mimetype)
  }

  media.set({
    project_id: req.project.project_id,
    user_id: req.user.user_id,
    media_type: mediaType,
  })

  const transaction = await sequelizeConn.transaction()
  const mediaUploader = new S3MediaUploader(transaction, req.user)
  try {
    await media.save({
      transaction,
      user: req.user,
    })

    if (req.file) {
      await mediaUploader.setMedia(media, 'media', req.file)
    }

    await media.save({
      transaction,
      user: req.user,
      shouldSkipLogChange: true,
    })

    // Auto-set as exemplar if this is the first curated image and project has no exemplar
    const project = await models.Project.findByPk(projectId, { transaction })
    if (
      !project.exemplar_media_id &&
      media.media_type === 'image' &&
      media.cataloguing_status === 0 &&
      media.specimen_id &&
      media.view_id &&
      media.is_copyrighted !== null
    ) {
      project.exemplar_media_id = media.media_id
      await project.save({
        transaction,
        user: req.user,
      })
    }

    await transaction.commit()
    mediaUploader.commit()
  } catch (e) {
    await transaction.rollback()
    await mediaUploader.rollback()
    res
      .status(500)
      .json({ message: 'Failed to create media with server error' })
    return
  }

  res.status(200).json({ media: convertMediaResponse(media) })
}

export async function createMediaFiles(req, res) {
  const projectId = req.params.projectId
  const values = req.body

  // Don't create media if the zip file is missing.
  if (!req.file) {
    res.status(400).json({ message: 'No zip file in request' })
    return
  }

  // Validate that the uploaded file is actually a ZIP file
  const allowedMimeTypes = [
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream', // Some systems send this for ZIP files
  ]

  if (
    !allowedMimeTypes.includes(req.file.mimetype) &&
    !req.file.originalname.toLowerCase().endsWith('.zip')
  ) {
    res.status(400).json({
      message:
        'Uploaded file must be a ZIP archive. Please ensure you are uploading a .zip file.',
    })
    return
  }

  // Validate ZIP file size (max 1.5GB)
  const maxZipSize = 1536 * 1024 * 1024 // 1.5GB
  if (req.file.size > maxZipSize) {
    res.status(400).json({
      message:
        'ZIP file is too large. Maximum size is 1.5GB. Please split your files into smaller archives.',
    })
    return
  }

  // Ensure that the specimen is within the same project.
  if (
    values.specimen_id &&
    values.specimen_id !== '' &&
    values.specimen_id !== 'null'
  ) {
    const specimen = await models.Specimen.findByPk(values.specimen_id)
    if (specimen == null || specimen.project_id != projectId) {
      res.status(404).json({ message: 'Specimen is not found' })
      return
    }
  } else {
    // Set specimen_id to null if it's empty or invalid
    values.specimen_id = null
  }

  // Ensure that the view is within the same project.
  if (values.view_id && values.view_id !== '' && values.view_id !== 'null') {
    const view = await models.MediaView.findByPk(values.view_id)
    if (view == null || view.project_id != projectId) {
      res.status(404).json({ message: 'View is not found' })
      return
    }
  } else {
    // Set view_id to null if it's empty or invalid
    values.view_id = null
  }

  if (values.is_copyrighted == 0) {
    values.copyright_permission = 0
  }

  const mediaFiles = []
  const failedFiles = []
  const transaction = await sequelizeConn.transaction()
  const mediaUploader = new S3MediaUploader(transaction, req.user)
  let files = []

  try {
    files = await unzip(req.file.path)

    if (files.length === 0) {
      res
        .status(400)
        .json({ message: 'ZIP file is empty or contains no valid files' })
      return
    }

    // Filter out non-media files and validate file types
    const extractedFiles = files.filter((file) => {
      const extension = file.originalname.split('.').pop().toLowerCase()
      const supportedExtensions = [
        'jpg',
        'jpeg',
        'png',
        'gif',
        'bmp',
        'tiff',
        'tif',
        'webp',
      ]

      // Skip macOS metadata files and system files
      if (
        file.originalname.startsWith('__MACOSX/') ||
        file.originalname.startsWith('._') ||
        file.originalname.startsWith('.DS_Store') ||
        file.originalname.includes('/.DS_Store') ||
        file.originalname.startsWith('Thumbs.db') ||
        file.originalname.includes('/Thumbs.db')
      ) {
        return false
      }

      // Skip directories
      if (!file.originalname.includes('.')) {
        return false
      }

      return supportedExtensions.includes(extension)
    })

    if (extractedFiles.length === 0) {
      res.status(400).json({
        message:
          'ZIP file contains no supported image files. Supported formats: JPG, PNG, GIF, BMP, TIFF, WebP',
      })
      return
    }

    // Limit the number of files that can be processed in a single batch
    const maxFilesPerBatch = 50
    if (extractedFiles.length > maxFilesPerBatch) {
      res.status(400).json({
        message: `ZIP file contains too many files (${extractedFiles.length}). Maximum allowed is ${maxFilesPerBatch} files per batch. Please split your files into smaller archives.`,
      })
      return
    }

    for (let i = 0; i < extractedFiles.length; i++) {
      const file = extractedFiles[i]

      try {
        // Determine media type from the individual file, not the ZIP
        const mediaType = convertMediaTypeFromMimeType(file.mimetype)

        const media = models.MediaFile.build(values)
        media.set({
          project_id: req.project.project_id,
          user_id: req.user.user_id,
          cataloguing_status: 1,
          media_type: mediaType,
        })

        await media.save({
          transaction,
          user: req.user,
        })

        await mediaUploader.setMedia(media, 'media', file)

        await media.save({
          transaction,
          user: req.user,
          shouldSkipLogChange: true,
        })

        mediaFiles.push(media)
      } catch (fileError) {
        console.error(`Failed to process file ${file.originalname}:`, fileError)
        failedFiles.push({
          filename: file.originalname,
          error: fileError.message,
        })
        // Continue processing other files instead of failing completely
      }
    }

    if (mediaFiles.length === 0) {
      await transaction.rollback()
      await mediaUploader.rollback()
      res.status(500).json({
        message: 'Failed to process any files from the ZIP archive',
        failedFiles: failedFiles,
      })
      return
    }

    await transaction.commit()
    mediaUploader.commit()

    // Clean up temporary files
    try {
      await cleanupTempDirectory(path.dirname(files[0]?.path || ''))
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files:', cleanupError)
    }
  } catch (e) {
    await transaction.rollback()
    await mediaUploader.rollback()
    console.error('Batch upload error:', e)

    // Clean up temporary files on error
    try {
      if (files && files.length > 0) {
        await cleanupTempDirectory(path.dirname(files[0].path))
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files on error:', cleanupError)
    }

    res.status(500).json({
      message: 'Failed to create media with server error',
      error: e.message,
      failedFiles: failedFiles,
    })
    return
  }

  res.status(200).json({
    media: mediaFiles.map((media) => convertMediaResponse(media)),
    summary: {
      totalProcessed: mediaFiles.length,
      failedFiles: failedFiles,
    },
  })
}

export async function deleteMediaFiles(req, res) {
  const projectId = req.project.project_id
  const mediaIds = req.body.media_ids
  const remappedMediaIds = req.body.remapped_media_ids || {}

  if (!mediaIds || mediaIds.length == 0) {
    return res.status(200).json({ media_ids: [] })
  }

  const remapTargetMediaIds = Object.values(remappedMediaIds).map((id) =>
    parseInt(id)
  )

  for (const [source, target] of Object.entries(remappedMediaIds)) {
    // Ensure that we are not remapping to the same media.
    if (source == target) {
      return res.status(400).json({
        message: 'Cannot remap to the same media',
      })
    }

    // Ensure that the media that we plan to remap are in the list of media that
    // we will delete.
    if (!mediaIds.includes(parseInt(source))) {
      return res.status(400).json({
        message: 'Remap contains media that is not specified in deletion',
      })
    }

    // Ensure that the media ids that we are remapping to are not in the list of
    // media that we will soon delete.
    if (mediaIds.includes(target)) {
      return res.status(400).json({
        message: 'Remapped media contains to-be deleted media',
      })
    }
  }

  // Ensure that all of the deleted media and the ones that will be remapped are
  // within the same project.
  const allMediaIds = Array.from(new Set([...mediaIds, ...remapTargetMediaIds]))
  const isInProject = await service.isMediaInProject(allMediaIds, projectId)
  if (!isInProject) {
    return res.status(400).json({
      message: 'Not all media are in the specified project',
    })
  }

  const transaction = await sequelizeConn.transaction()
  try {
    const referenceMapper = new ModelRefencialMapper(
      ModelReferencialConfig.MEDIA,
      transaction,
      req.user
    )
    await referenceMapper.moveReferences(
      new Map(Object.entries(remappedMediaIds))
    )

    await models.MediaFile.destroy({
      where: {
        media_id: mediaIds,
        project_id: projectId,
      },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })
    
    await transaction.commit()
    res.status(200).json({ media_ids: mediaIds })
  } catch (e) {
    await transaction.rollback()
    res.status(200).json({ message: 'Error deleting media' })
  }
}

export async function editMediaFile(req, res) {
  const projectId = req.project.project_id
  const mediaId = req.params.mediaId
  
  // Set extended timeout for large media file uploads
  req.setTimeout(1800000) // 30 minutes
  res.setTimeout(1800000)
  
  const media = await models.MediaFile.findByPk(mediaId)
  if (media == null || media.project_id != projectId) {
    res.status(404).json({ message: 'Media is not found' })
    return
  }

  // The values are set as a Form so that it can include binary information from
  // the Form.
  const values = req.body

  // Ensure that the specimen_id is within the same project.
  if (
    values.specimen_id &&
    values.specimen_id !== '' &&
    values.specimen_id !== 'null'
  ) {
    const specimen = await models.Specimen.findByPk(values.specimen_id)
    if (specimen == null || specimen.project_id != projectId) {
      res.status(404).json({ message: 'Specimen is not found' })
      return
    }
  } else {
    // Set specimen_id to null if it's empty or invalid
    values.specimen_id = null
  }

  // Ensure that the media view is within the same project.
  if (values.view_id && values.view_id !== '' && values.view_id !== 'null') {
    const view = await models.MediaView.findByPk(values.view_id)
    if (view == null || view.project_id != projectId) {
      res.status(404).json({ message: 'View is not found' })
      return
    }
  } else {
    // Set view_id to null if it's empty or invalid
    values.view_id = null
  }

  const transaction = await sequelizeConn.transaction()
  const mediaUploader = new S3MediaUploader(transaction, req.user)
  try {
    // First upload the new file if present - this sets media field and triggers old file deletion
    if (req.file) {
      // Detect if this is an image file or non-image file
      const isImageFile = req.file.mimetype && req.file.mimetype.startsWith('image/')
      
      // For non-image files (3D models, videos, etc.), detect by extension if mimetype is not reliable
      const extension = req.file.originalname.split('.').pop().toLowerCase()
      const nonImageExtensions = ['ply', 'stl', 'obj', 'glb', 'gltf', 'fbx', 'mp4', 'mov', 'avi', 'webm', 'mkv', 'wmv', 'flv', 'm4v', 'zip']
      const isNonImageByExtension = nonImageExtensions.includes(extension)
      
      if (isImageFile && !isNonImageByExtension) {
        // Use image processing for actual image files
        await mediaUploader.setMedia(media, 'media', req.file)
        // Update media type to image if it was something else before
        media.set('media_type', MEDIA_TYPES.IMAGE)
      } else {
        // Use non-image processing for 3D files, videos, ZIP files, etc.
        await mediaUploader.setNonImageMedia(media, 'media', req.file)
        
        // Update media type based on the new file type
        let newMediaType = MEDIA_TYPES.IMAGE // Default fallback
        if (req.file.mimetype) {
          newMediaType = convertMediaTypeFromMimeType(req.file.mimetype)
        } else {
          // Fallback to extension-based detection
          newMediaType = convertMediaTypeFromExtension(req.file.originalname)
        }
        media.set('media_type', newMediaType)
      }
    }

    // Then update all other fields
    for (const column in values) {
      if (column !== 'media') {  // Skip media field as it's handled above
        media.set(column, values[column])
      }
    }

    await media.save({
      transaction,
      user: req.user,
      shouldSkipLogChange: true,
    })

    // Auto-set as exemplar if this is the first curated image and project has no exemplar
    const project = await models.Project.findByPk(projectId, { transaction })
    if (
      !project.exemplar_media_id &&
      media.media_type === 'image' &&
      media.cataloguing_status === 0 &&
      media.specimen_id &&
      media.view_id &&
      media.is_copyrighted !== null
    ) {
      project.exemplar_media_id = media.media_id
      await project.save({
        transaction,
        user: req.user,
      })
    }

    await transaction.commit()
    mediaUploader.commit()
    res.status(200).json({ media: convertMediaResponse(media) })
  } catch (e) {
    console.error('Error editing media file:', e)
    await transaction.rollback()
    await mediaUploader.rollback()
    res
      .status(500)
      .json({ message: 'Failed to edit media with server error: ' + e.message })
  }
}

export async function getUsage(req, res) {
  const mediaIds = req.body.media_ids
  const referenceMapper = new ModelRefencialMapper(ModelReferencialConfig.MEDIA)

  const usages = await referenceMapper.getUsageCount(mediaIds)
  res.status(200).json({
    usages: usages,
  })
}

export async function getMediaFile(req, res) {
  const projectId = req.project.project_id
  const mediaId = req.params.mediaId
  const media = await models.MediaFile.findByPk(mediaId)
  if (media == null || media.project_id != projectId) {
    res.status(404).json({ message: 'Media is not found' })
    return
  }

  res.status(200).json({ media: convertMediaResponse(media) })
}

export async function getMediaFileDetails(req, res) {
  const projectId = req.project.project_id
  const mediaId = req.params.mediaId
  const linkId = req.query.link_id
  
  try {
    // Build the comprehensive query with all necessary joins for detailed information
    let query = `
      SELECT 
        mf.media_id,
        mf.project_id,
        mf.specimen_id,
        mf.view_id,
        mf.is_copyrighted,
        mf.copyright_info,
        mf.copyright_permission,
        mf.copyright_license,
        mf.media,
        mf.notes AS media_notes,
        mf.url,
        mf.url_description,
        mf.user_id,
        mf.created_on AS media_created,
        mf.last_modified_on,
        mf.is_sided,
        
        -- View details
        mv.name AS view_name,
        
        -- Specimen details  
        s.specimen_id AS specimen_id_full,
        s.reference_source,
        s.institution_code,
        s.collection_code,
        s.catalog_number,
        s.description AS specimen_description,
        s.occurrence_id,
        
        -- User details (for copyright holder)
        u.fname AS user_fname,
        u.lname AS user_lname,
        u.email AS user_email,
        
        -- Taxon details (for complete specimen name formatting)
        t.genus AS specimen_genus,
        t.specific_epithet AS specimen_specific_epithet,
        t.subspecific_epithet AS specimen_subspecific_epithet,
        t.scientific_name_author AS specimen_author,
        t.scientific_name_year AS specimen_year,
        t.is_extinct AS specimen_is_extinct,
        
        -- Direct taxon association (when media is linked to taxon outside of character context)
        dt.genus AS direct_taxon_genus,
        dt.specific_epithet AS direct_taxon_specific_epithet,
        dt.subspecific_epithet AS direct_taxon_subspecific_epithet,
        dt.scientific_name_author AS direct_taxon_author,
        dt.scientific_name_year AS direct_taxon_year,
        dt.is_extinct AS direct_taxon_is_extinct
        
      FROM media_files mf
      LEFT JOIN media_views mv ON mf.view_id = mv.view_id
      LEFT JOIN specimens s ON mf.specimen_id = s.specimen_id
      LEFT JOIN taxa_x_specimens ts ON s.specimen_id = ts.specimen_id
      LEFT JOIN taxa t ON t.taxon_id = ts.taxon_id
      LEFT JOIN ca_users u ON mf.user_id = u.user_id
      LEFT JOIN taxa_x_media txm ON mf.media_id = txm.media_id
      LEFT JOIN taxa dt ON dt.taxon_id = txm.taxon_id
      WHERE mf.project_id = ? AND mf.media_id = ?
    `
    
    const replacements = [projectId, mediaId]
    
    const [rows] = await sequelizeConn.query(query, { replacements })
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Media is not found' })
    }
    
    let mediaData = rows[0]
    
    // If linkId is provided, get comprehensive character, state, and taxonomic information
    if (linkId) {
      const characterQuery = `
        SELECT 
          -- Cell and Media relationship data
          cxm.link_id,
          cxm.matrix_id,
          cxm.character_id,
          cxm.taxon_id,
          cxm.media_id,
          cxm.notes AS cell_notes,
          
          -- Character information
          c.name AS character_name,
          c.description AS character_description,
          c.num AS character_number,
          c.type AS character_type,
          
          -- Character state information (from actual cell data)
          cells.state_id,
          cs.name AS state_name,
          cs.num AS state_number,
          cs.description AS state_description
          
        FROM cells_x_media cxm
        LEFT JOIN characters c ON cxm.character_id = c.character_id
        LEFT JOIN cells ON cells.character_id = cxm.character_id 
          AND cells.taxon_id = cxm.taxon_id 
          AND cells.matrix_id = cxm.matrix_id
        LEFT JOIN character_states cs ON cells.state_id = cs.state_id 
          AND cs.character_id = cells.character_id
        WHERE cxm.link_id = ? AND cxm.media_id = ?
        LIMIT 1
      `
      
      const [characterRows] = await sequelizeConn.query(characterQuery, { 
        replacements: [linkId, mediaId] 
      })

      if (characterRows && characterRows.length > 0) {
        const charData = characterRows[0]
        
        // Enhanced character information with formatted display
        mediaData.character_display = formatCharacterDisplay(charData)
      }
    }
    
    // Convert and clean up the response
    const detailedMedia = {
      ...convertMediaResponse(mediaData),
      
      // Enhanced view information
      view_name: mediaData.view_name,
      
      // Enhanced specimen information
      specimen_display: getSpecimenDisplayName(mediaData),
      specimen_notes: mediaData.specimen_description || null, // Add specimen description
      
      // Enhanced copyright information  
      copyright_holder: getCopyrightHolderName(mediaData),
      
      // Character information (if available)
      character_display: mediaData.character_display || null,
      
      // Direct taxon context (when media is associated with a taxon outside of character context)
      taxon_display: getDirectTaxonDisplayName(mediaData),
      
      // Media notes
      media_notes: mediaData.media_notes || null,
    }
    
    res.status(200).json({ media: detailedMedia })
    
  } catch (error) {
    console.error('Error fetching media details:', error)
    res.status(500).json({ message: 'Error while fetching media details.' })
  }
}

// Helper function to build specimen display name using utility functions
function getSpecimenDisplayName(mediaData) {
  if (!mediaData.specimen_id) return null
  
  // Create a record object with the expected field names for the utility functions
  const specimenRecord = {
    // Specimen fields
    specimen_id: mediaData.specimen_id,
    reference_source: mediaData.reference_source,
    institution_code: mediaData.institution_code,
    collection_code: mediaData.collection_code,
    catalog_number: mediaData.catalog_number,
    
    // Taxon fields (using the specimen-associated taxon data)
    genus: mediaData.specimen_genus,
    specific_epithet: mediaData.specimen_specific_epithet,
    subspecific_epithet: mediaData.specimen_subspecific_epithet,
    scientific_name_author: mediaData.specimen_author,
    scientific_name_year: mediaData.specimen_year,
    is_extinct: mediaData.specimen_is_extinct
  }
  
  // Use the utility function to get the specimen name
  // showExtinctMarker=true, showAuthor=false, skipSubgenus=false
  return getSpecimenName(specimenRecord, null, true, false, false)
}

// Helper function to format complete character display with state information
function formatCharacterDisplay(charData) {
  if (!charData) return null
  
  // Start with the basic character display (number + cleaned name)
  let fullDisplay
  if (charData.character_name) {
    // Clean character name by removing trailing colon
    let characterName = charData.character_name.trim()
    if (characterName.endsWith(':')) {
      characterName = characterName.slice(0, -1).trim()
    }
    fullDisplay = characterName
  }
  if (!fullDisplay) return null
  
  // Add state information if available
  if (charData.state_name) {
    fullDisplay += ` :: ${charData.state_name} (${charData.state_number})`
  }
  
  return fullDisplay
}

// Helper function to get copyright holder name
function getCopyrightHolderName(mediaData) {
  if (mediaData.copyright_info) {
    return mediaData.copyright_info
  }
  
  if (mediaData.user_fname || mediaData.user_lname) {
    const parts = []
    if (mediaData.user_fname) parts.push(mediaData.user_fname)
    if (mediaData.user_lname) parts.push(mediaData.user_lname)
    return parts.join(' ')
  }
  
  return null
}

// Helper function to get direct taxon display name (when media is associated with taxon)
function getDirectTaxonDisplayName(mediaData) {
  // Only show direct taxon association if we have direct taxon data
  // and it's different from specimen taxon (to avoid duplication)
  if (!mediaData.direct_taxon_genus) return null
  
  // Check if this is the same taxon as the specimen's taxon
  if (mediaData.specimen_genus === mediaData.direct_taxon_genus &&
      mediaData.specimen_specific_epithet === mediaData.direct_taxon_specific_epithet &&
      mediaData.specimen_author === mediaData.direct_taxon_author &&
      mediaData.specimen_year === mediaData.direct_taxon_year) {
    // Don't show duplicate taxon information
    return null
  }
  
  // Create a record object for the getTaxonName utility
  const taxonRecord = {
    genus: mediaData.direct_taxon_genus,
    specific_epithet: mediaData.direct_taxon_specific_epithet,
    subspecific_epithet: mediaData.direct_taxon_subspecific_epithet,
    scientific_name_author: mediaData.direct_taxon_author,
    scientific_name_year: mediaData.direct_taxon_year,
    is_extinct: mediaData.direct_taxon_is_extinct
  }
  
  // Use the utility function to get the taxon name
  // showExtinctMarker=true, showAuthor=true, skipSubgenus=false
  return getTaxonName(taxonRecord, null, true, true, false)
}

export async function editMediaFiles(req, res) {
  const projectId = req.project.project_id
  const mediaIds = req.body.media_ids
  const values = req.body.media

  // Validate media_ids array
  if (!mediaIds || !Array.isArray(mediaIds) || mediaIds.length === 0) {
    return res.status(400).json({
      message: 'media_ids must be a non-empty array',
    })
  }

  // Validate that we're not accidentally updating the media field
  if (values.media) {
    console.error(
      'ERROR: Attempting to update media field directly:',
      values.media
    )
    return res.status(400).json({
      message:
        'Cannot update media field directly. Use cataloguing_status, specimen_id, view_id, etc.',
    })
  }

  const isInProject = await service.isMediaInProject(mediaIds, projectId)
  if (!isInProject) {
    return res.status(400).json({
      message: 'Not all media are in the specified project',
    })
  }

  const transaction = await sequelizeConn.transaction()
  try {
    const referenceId = values.reference_id
    if (referenceId) {
      const rows = await bibliographyService.getMediaIds(referenceId, mediaIds)
      const existingMediaIds = new Set(rows.map((r) => r.media_id))
      const newMediaIds = mediaIds.filter((id) => !existingMediaIds.has(id))
      await models.MediaFilesXBibliographicReference.bulkCreate(
        newMediaIds.map((mediaId) => ({
          reference_id: referenceId,
          media_id: mediaId,
          user_id: req.user.user_id,
        })),
        {
          transaction: transaction,
          individualHooks: true,
          ignoreDuplicates: true,
          user: req.user,
        }
      )
    }

    const folioId = values.folio_id
    if (folioId) {
      const rows = await folioService.getMediaIds(folioId, mediaIds)
      let position = await folioService.getMaxPositionForFolioMedia(folioId)
      const existingMediaIds = new Set(rows.map((r) => r.media_id))
      const newMediaIds = mediaIds.filter((id) => !existingMediaIds.has(id))
      await models.FoliosXMediaFile.bulkCreate(
        newMediaIds.map((mediaId) => ({
          folio_id: folioId,
          media_id: mediaId,
          user_id: req.user.user_id,
          position: ++position,
        })),
        {
          transaction: transaction,
          individualHooks: true,
          ignoreDuplicates: true,
          user: req.user,
        }
      )
    }

    // Remove any media field from values to prevent corruption
    const cleanValues = { ...values }
    delete cleanValues.media

    // Check current status before update
    const beforeUpdate = await models.MediaFile.findAll({
      where: { media_id: mediaIds },
      transaction: transaction,
    })

    const updateResult = await models.MediaFile.update(cleanValues, {
      where: { media_id: mediaIds },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })

    const results = await models.MediaFile.findAll({
      where: {
        media_id: mediaIds,
      },
      transaction: transaction,
    })

    // Auto-set as exemplar if project has no exemplar and first curated image is in results
    const project = await models.Project.findByPk(projectId, { transaction })
    if (!project.exemplar_media_id) {
      // Find the first image that qualifies as exemplar
      const firstQualifyingImage = results.find(
        (media) =>
          media.media_type === 'image' &&
          media.cataloguing_status === 0 &&
          media.specimen_id &&
          media.view_id &&
          media.is_copyrighted !== null
      )
      if (firstQualifyingImage) {
        project.exemplar_media_id = firstQualifyingImage.media_id
        await project.save({
          transaction,
          user: req.user,
        })
      }
    }

    await transaction.commit()

    // Double-check the database after commit
    const [finalCheck] = await sequelizeConn.query(
      `SELECT media_id, cataloguing_status FROM media_files WHERE media_id IN (?)`,
      { replacements: [mediaIds] }
    )

    const responseData = results.map((media) => convertMediaResponse(media))

    res.status(200).json({
      media: responseData,
    })
  } catch (e) {
    await transaction.rollback()
    res.status(500).json({ message: 'Failed to edit media with server error' })
  }
}

export async function downloadFilenames(req, res) {
  const projectId = req.params.projectId
  const rows = await service.getMediaFiles(projectId)
  const lines = ['Original File Name, Morphobank Media ID']
  for (const row of rows) {
    const mediaId = row.media_id
    const filename =
      row.media.ORIGINAL_FILENAME ?? 'original filename not available'
    lines.push(`"${filename}", "${mediaId}"`)
  }

  res.set({
    'Content-Type': 'application/csv',
    'Content-Disposition': 'attachment; filename=original_filenames.csv',
    'Cache-Control': 'private',
    'Last-Modified': new Date(),
    Pragma: 'no-store',
  })
  res.status(200).send(lines.join('\r\n'))
}

export async function getCitations(req, res) {
  const projectId = req.project.project_id
  const mediaId = req.params.mediaId
  const citations = await service.getCitations(projectId, mediaId)

  res.status(200).json({
    citations,
  })
}

export async function createCitation(req, res) {
  const projectId = req.project.project_id
  const mediaId = req.params.mediaId
  try {
    const media = await models.MediaFile.findByPk(mediaId)
    if (media == null) {
      res.status(404).json({ message: 'Unable to find media' })
      return
    }

    if (media.project_id != projectId) {
      res
        .status(403)
        .json({ message: 'Media is not assoicated with this project' })
      return
    }

    const values = req.body.citation
    const referenceId = req.body.citation.reference_id
    const bibliography = await models.BibliographicReference.findByPk(
      referenceId
    )
    if (bibliography == null) {
      res.status(404).json({ message: 'Unable to find bibliography' })
      return
    }

    if (bibliography.project_id != projectId) {
      res
        .status(403)
        .json({ message: 'Bibliography is not assoicated with this project' })
      return
    }

    // Check for duplicate citation
    const existingCitation =
      await models.MediaFilesXBibliographicReference.findOne({
        where: {
          media_id: media.media_id,
          reference_id: bibliography.reference_id,
        },
      })

    if (existingCitation) {
      res.status(400).json({ message: 'This citation already exists' })
      return
    }

    const citation = models.MediaFilesXBibliographicReference.build(values)
    citation.set({
      media_id: media.media_id,
      reference_id: bibliography.reference_id,
      user_id: req.user.user_id,
    })

    const transaction = await sequelizeConn.transaction()
    await citation.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
    res.status(200).json({ citation })
  } catch (e) {
    res
      .status(500)
      .json({ message: 'Failed to create citation with server error' })
  }
}

export async function editCitation(req, res) {
  const projectId = req.project.project_id
  const mediaId = req.params.mediaId
  const citationId = req.params.citationId

  const media = await models.MediaFile.findByPk(mediaId)
  if (media == null) {
    res.status(404).json({ message: 'Unable to find media' })
    return
  }

  if (media.project_id != projectId) {
    res
      .status(403)
      .json({ message: 'Media is not assoicated with this project' })
    return
  }

  const citation = await models.MediaFilesXBibliographicReference.findByPk(
    citationId
  )
  if (citation == null || citation.media_id != mediaId) {
    res.status(404).json({ message: 'Unable to find citation' })
    return
  }

  const values = req.body.citation

  // For editing, we only allow updating pp and notes, not reference_id
  const allowedFields = ['pp', 'notes']
  for (const key in values) {
    if (allowedFields.includes(key)) {
      citation.set(key, values[key])
    }
  }
  try {
    const transaction = await sequelizeConn.transaction()
    await citation.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
  } catch (e) {
    res
      .status(500)
      .json({ message: 'Failed to create citation with server error' })
    return
  }

  res.status(200).json({ citation })
}

export async function deleteCitations(req, res) {
  const projectId = req.project.project_id
  const mediaId = req.params.mediaId
  const citationIds = req.body.citation_ids

  const inProject = await service.isCitationInProject(
    projectId,
    mediaId,
    citationIds
  )
  if (!inProject) {
    return res.status(400).json({
      message: 'Not all media are in the specified project',
    })
  }

  const transaction = await sequelizeConn.transaction()
  try {
    await models.MediaFilesXBibliographicReference.destroy({
      where: {
        link_id: citationIds,
      },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })
    await transaction.commit()
    res.status(200).json({ citation_ids: citationIds })
  } catch (e) {
    await transaction.rollback()
    res.status(200).json({ message: "Error deleting media's citations" })
  }
}

export async function getFilterMediaIds(req, res) {
  const projectId = req.project.project_id
  const [cell, character, taxa, documents] = await Promise.all([
    service.getCellMedia(projectId),
    service.getCharacterMedia(projectId),
    service.getTaxonMedia(projectId),
    service.getDocumentMedia(projectId),
  ])
  res.status(200).json({
    cells: cell.map((c) => c.media_id),
    characters: character.map((c) => c.media_id),
    taxa: taxa.map((t) => t.media_id),
    documents: documents.map((d) => d.media_id),
  })
}

function convertMediaResponse(row) {
  const response = {
    media_id: parseInt(row.media_id),
    project_id: parseInt(row.project_id),
    user_id: parseInt(row.user_id),
    view_id: row.view_id ? parseInt(row.view_id) : undefined,
    specimen_id: row.specimen_id ? parseInt(row.specimen_id) : undefined,
    // Include media_type so frontend can show proper icons for 3D/video files
    media_type: row.media_type,
    notes: row.notes,
    published: row.published,
    cataloguing_status: row.cataloguing_status,
    is_sided: parseInt(row.is_sided) ?? 0,
    is_copyrighted:
      row.is_copyrighted == null ? null : parseInt(row.is_copyrighted),
    copyright_permission: row.copyright_permission,
    copyright_license: row.copyright_license,
    copyright_info: row.copyright_info,
    needs_attention: row.needs_attention,
    last_modified_on: row.last_modified_on,
    created_on: row.created_on,
    url: row.url,
    url_description: row.url_description,
  }
  
  // Add view name if available
  if (row.view_name) {
    response.view_name = row.view_name
  }
  
  // Build and add specimen name if specimen data is available
  if (row.specimen_id && row.reference_source !== undefined) {
    const specimenRecord = {
      specimen_id: row.specimen_id,
      reference_source: row.reference_source,
      institution_code: row.institution_code,
      collection_code: row.collection_code,
      catalog_number: row.catalog_number,
      genus: row.genus,
      specific_epithet: row.specific_epithet,
      subspecific_epithet: row.subspecific_epithet,
      scientific_name_author: row.scientific_name_author,
      scientific_name_year: row.scientific_name_year,
      is_extinct: row.is_extinct
    }
    // Use the utility function to get the specimen name
    // showExtinctMarker=true, showAuthor=false, skipSubgenus=false
    const specimenName = getSpecimenName(specimenRecord, null, true, false, false)
    if (specimenName) {
      response.specimen_name = specimenName
    }
  }
  
  return response
}

/**
 * Serve media file from S3
 * GET /projects/:projectId/media/serve/:mediaId/:fileSize
 */
export async function serveMediaFile(req, res) {
  try {
    const { projectId, mediaId, fileSize = 'original' } = req.params

    // Validate file size
    const supportedFileSizes = ['original', 'large', 'thumbnail']
    if (!supportedFileSizes.includes(fileSize)) {
      return res.status(400).json({
        error: 'Invalid file size',
        message: `File size '${fileSize}' is not supported. Supported sizes: ${supportedFileSizes.join(
          ', '
        )}`,
      })
    }

    // Get media file info from database
    const [mediaRows] = await sequelizeConn.query(
      `SELECT media_id, media FROM media_files WHERE project_id = ? AND media_id = ?`,
      { replacements: [projectId, mediaId] }
    )

    if (!mediaRows || mediaRows.length === 0) {
      return res.status(404).json({
        error: 'Media not found',
        message: 'The requested media file does not exist',
      })
    }

    const mediaData = mediaRows[0].media

    if (!mediaData || !mediaData[fileSize]) {
      return res.status(404).json({
        error: 'File size not found',
        message: `The requested file size '${fileSize}' is not available for this media. Available sizes: ${
          mediaData ? Object.keys(mediaData).join(', ') : 'none'
        }`,
      })
    }

    // Extract S3 key from the media data (new system) or construct it (old system)
    const mediaVersion = mediaData[fileSize]

    // Get S3 key first
    let s3Key
    if (mediaVersion.S3_KEY || mediaVersion.s3_key) {
      // New S3-based system - handle both uppercase and lowercase
      s3Key = mediaVersion.S3_KEY || mediaVersion.s3_key
    } else if (mediaVersion.FILENAME) {
      // Legacy local file system - construct S3 key
      const fileExtension = mediaVersion.FILENAME.split('.').pop() || 'jpg'
      const fileName = `${projectId}_${mediaId}_${fileSize}.${fileExtension}`
      s3Key = `media_files/images/${projectId}/${mediaId}/${fileName}`
    } else {
      return res.status(404).json({
        error: 'Invalid media data',
        message: `Media data is missing file information. Available data: ${JSON.stringify(mediaVersion)}`,
      })
    }

    // Extract extension from S3 key (the actual file extension)
    const s3Extension = s3Key.split('.').pop()?.toLowerCase() || ''
    
    // Get original filename from database
    const originalFileName = mediaData.ORIGINAL_FILENAME || 
                            mediaVersion.FILENAME || 
                            `${projectId}_${mediaId}_${fileSize}`
    
    // Create correct filename: basename from database + extension from S3
    // This handles cases where database has "archive.zip" but S3 has "file.tif"
    const correctFileName = s3Extension 
      ? replaceFileExtension(originalFileName, s3Extension)
      : originalFileName

    // Use default bucket from config
    const bucket = config.aws.defaultBucket

    if (!bucket) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Default S3 bucket not configured',
      })
    }

    // Get object from S3
    const result = await s3Service.getObject(bucket, s3Key)

    // Encode filename for Content-Disposition header (RFC 5987)
    // This handles filenames with non-ASCII characters
    const encodedFilename = encodeURIComponent(correctFileName)
    const contentDisposition = `attachment; filename="${correctFileName.replace(/[^\x00-\x7F]/g, '_')}"; filename*=UTF-8''${encodedFilename}`

    // Set appropriate headers
    // Use MIMETYPE from database if available, otherwise fall back to S3 content type
    const contentType = mediaVersion.MIMETYPE || result.contentType || 'application/octet-stream'
    
    res.set({
      'Content-Type': contentType,
      'Content-Length': result.contentLength,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Last-Modified': result.lastModified,
      'Content-Disposition': contentDisposition,
    })

    // Send the data
    res.send(result.data)
  } catch (error) {
    // console.error('Media serve error:', error.message)

    if (error.name === 'NoSuchKey' || error.message.includes('NoSuchKey')) {
      return res.status(404).json({
        error: 'File not found',
        message: 'The requested media file does not exist in S3',
      })
    }

    if (error.name === 'NoSuchBucket') {
      return res.status(404).json({
        error: 'Bucket not found',
        message: 'The specified bucket does not exist',
      })
    }

    if (error.name === 'AccessDenied') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient permissions to access the requested file',
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to serve media file',
    })
  }
}

/**
 * Serve multiple media files from S3
 * GET /projects/:projectId/media/serve/batch?mediaIds=123,456&fileSize=original
 */
export async function serveBatchMediaFiles(req, res) {
  try {
    const { projectId } = req.params
    const { mediaIds, fileSize = 'original' } = req.query

    if (!mediaIds) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'mediaIds parameter is required',
      })
    }

    // Validate file size
    const supportedFileSizes = ['original', 'large', 'thumbnail']
    if (!supportedFileSizes.includes(fileSize)) {
      return res.status(400).json({
        error: 'Invalid file size',
        message: `File size '${fileSize}' is not supported. Supported sizes: ${supportedFileSizes.join(
          ', '
        )}`,
      })
    }

    const mediaIdArray = mediaIds.split(',').map((id) => parseInt(id.trim()))

    // Get media files info from database
    const [mediaRows] = await sequelizeConn.query(
      `SELECT media_id, media FROM media_files WHERE project_id = ? AND media_id IN (?)`,
      { replacements: [projectId, mediaIdArray] }
    )

    if (!mediaRows || mediaRows.length === 0) {
      return res.status(404).json({
        error: 'Media not found',
        message: 'None of the requested media files exist',
      })
    }

    // Use default bucket from config
    const bucket = config.aws.defaultBucket

    if (!bucket) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Default S3 bucket not configured',
      })
    }

    const results = []
    const errors = []

    // Process each media file
    for (const mediaRow of mediaRows) {
      try {
        const mediaData = mediaRow.media
        if (!mediaData || !mediaData[fileSize]) {
          errors.push({
            mediaId: mediaRow.media_id,
            error: `File size '${fileSize}' not available`,
          })
          continue
        }

        // Extract S3 key from the media data (new system) or construct it (old system)
        const mediaVersion = mediaData[fileSize]
        let s3Key
        if (mediaVersion.S3_KEY) {
          // New S3-based system
          s3Key = mediaVersion.S3_KEY
        } else if (mediaVersion.FILENAME) {
          // Legacy local file system - construct S3 key
          const fileExtension = mediaVersion.FILENAME.split('.').pop() || 'jpg'
          const fileName = `${projectId}_${mediaRow.media_id}_${fileSize}.${fileExtension}`
          s3Key = `media_files/images/${projectId}/${mediaRow.media_id}/${fileName}`
        } else {
          errors.push({
            mediaId: mediaRow.media_id,
            error: 'Media data is missing file information',
          })
          continue
        }

        // Get object from S3
        const result = await s3Service.getObject(bucket, s3Key)

        results.push({
          mediaId: mediaRow.media_id,
          data: result.data,
          contentType: result.contentType,
          contentLength: result.contentLength,
          lastModified: result.lastModified,
          s3Key,
        })
      } catch (error) {
        console.error(`Error serving media ${mediaRow.media_id}:`, error)
        errors.push({
          mediaId: mediaRow.media_id,
          error: error.message,
        })
      }
    }

    // Return response
    const response = {
      success: results.length > 0,
      message:
        errors.length > 0
          ? `Served ${results.length} files with ${errors.length} errors`
          : `Successfully served ${results.length} files`,
      data: {
        projectId,
        fileSize,
        files: results,
        totalServed: results.length,
        totalErrors: errors.length,
      },
    }

    if (errors.length > 0) {
      response.data.errors = errors
    }

    // Return appropriate status code
    const statusCode = results.length > 0 ? 200 : 400
    res.status(statusCode).json(response)
  } catch (error) {
    // console.error('Batch Media Serve Error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to serve batch media files',
    })
  }
}

/**
 * Get pre-signed URL for video file from S3
 * GET /projects/:projectId/video-url/:mediaId?download=true
 */
export async function getMediaVideoUrl(req, res) {
  try {
    const { projectId, mediaId } = req.params
    const { download } = req.query // Check if this is for download

    // Get media file info from database
    const [mediaRows] = await sequelizeConn.query(
      `SELECT media_id, media FROM media_files WHERE project_id = ? AND media_id = ?`,
      { replacements: [projectId, mediaId] }
    )

    if (!mediaRows || mediaRows.length === 0) {
      return res.status(404).json({
        error: 'Media not found',
        message: 'The requested media file does not exist',
      })
    }

    const mediaData = mediaRows[0].media

    // Check if this is a video file by looking at the original file's MIMETYPE
    if (!mediaData || !mediaData.original) {
      return res.status(404).json({
        error: 'Media data not found',
        message: 'The media file does not have original data',
      })
    }

    const originalMedia = mediaData.original
    const mimeType = originalMedia.MIMETYPE || ''

    // Validate that this is a video file
    if (!mimeType.startsWith('video/')) {
      return res.status(400).json({
        error: 'Invalid media type',
        message: 'This endpoint only supports video files',
      })
    }

    // Get S3 key for original video first
    let s3Key
    if (originalMedia.S3_KEY || originalMedia.s3_key) {
      // New S3-based system - handle both uppercase and lowercase
      s3Key = originalMedia.S3_KEY || originalMedia.s3_key
    } else if (originalMedia.FILENAME) {
      // Legacy local file system - construct S3 key
      const fileExtension = originalMedia.FILENAME.split('.').pop() || 'mp4'
      const fileName = `${projectId}_${mediaId}_original.${fileExtension}`
      s3Key = `media_files/images/${projectId}/${mediaId}/${fileName}`
    } else {
      return res.status(404).json({
        error: 'Invalid media data',
        message: 'Media data is missing file information',
      })
    }

    // Extract extension from S3 key (the actual file extension)
    const s3Extension = s3Key.split('.').pop()?.toLowerCase() || 'mp4'
    
    // Get original filename from database
    const originalFilename = mediaData.ORIGINAL_FILENAME || `video_${mediaId}.${s3Extension}`
    
    // Create correct filename: basename from database + extension from S3
    const correctFilename = s3Extension 
      ? replaceFileExtension(originalFilename, s3Extension)
      : originalFilename

    // Use default bucket from config
    const bucket = config.aws.defaultBucket

    if (!bucket) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Default S3 bucket not configured',
      })
    }

    // Generate pre-signed URL options
    const urlOptions = {}
    
    // If download=true, add Content-Disposition header to force download
    if (download === 'true') {
      // Sanitize filename for Content-Disposition header
      const safeFilename = correctFilename.replace(/[^\w\s.-]/g, '_')
      urlOptions.responseContentDisposition = `attachment; filename="${safeFilename}"`
    }

    // Generate pre-signed URL (valid for 1 hour)
    const signedUrl = await s3Service.getSignedUrl(bucket, s3Key, 3600, urlOptions)

    res.json({
      success: true,
      url: signedUrl,
      expiresIn: 3600,
      mediaId: parseInt(mediaId),
      projectId: parseInt(projectId),
      filename: correctFilename,
    })
  } catch (error) {
    console.error('Video URL generation error:', error.message)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate video URL',
    })
  }
}

/**
 * Get pre-signed URL for any media file from S3
 * This avoids proxy timeout issues for large files
 * GET /projects/:projectId/media-url/:mediaId?fileSize=original&download=true
 */
export async function getMediaPresignedUrl(req, res) {
  try {
    const { projectId, mediaId } = req.params
    const { fileSize = 'original', download } = req.query

    // Validate file size
    const supportedFileSizes = ['original', 'large', 'thumbnail']
    if (!supportedFileSizes.includes(fileSize)) {
      return res.status(400).json({
        error: 'Invalid file size',
        message: `File size '${fileSize}' is not supported. Supported sizes: ${supportedFileSizes.join(', ')}`,
      })
    }

    // Get media file info from database
    const [mediaRows] = await sequelizeConn.query(
      `SELECT media_id, media FROM media_files WHERE project_id = ? AND media_id = ?`,
      { replacements: [projectId, mediaId] }
    )

    if (!mediaRows || mediaRows.length === 0) {
      return res.status(404).json({
        error: 'Media not found',
        message: 'The requested media file does not exist',
      })
    }

    const mediaData = mediaRows[0].media

    if (!mediaData || !mediaData[fileSize]) {
      return res.status(404).json({
        error: 'File size not found',
        message: `The requested file size '${fileSize}' is not available for this media`,
      })
    }

    const mediaVersion = mediaData[fileSize]

    // Get S3 key first
    let s3Key
    if (mediaVersion.S3_KEY || mediaVersion.s3_key) {
      // New S3-based system - handle both uppercase and lowercase
      s3Key = mediaVersion.S3_KEY || mediaVersion.s3_key
    } else if (mediaVersion.FILENAME) {
      // Legacy local file system - construct S3 key
      const fileExtension = mediaVersion.FILENAME.split('.').pop() || 'jpg'
      const fileName = `${projectId}_${mediaId}_${fileSize}.${fileExtension}`
      s3Key = `media_files/images/${projectId}/${mediaId}/${fileName}`
    } else {
      return res.status(404).json({
        error: 'Invalid media data',
        message: 'Media data is missing file information',
      })
    }

    // Extract extension from S3 key (the actual file extension)
    const s3Extension = s3Key.split('.').pop()?.toLowerCase() || ''
    
    // Get original filename from database
    const originalFilename = mediaData.ORIGINAL_FILENAME || 
                            mediaVersion.FILENAME || 
                            `${projectId}_${mediaId}_${fileSize}`
    
    // Create correct filename: basename from database + extension from S3
    // This handles cases where database has "archive.zip" but S3 has "file.tif"
    const correctFilename = s3Extension 
      ? replaceFileExtension(originalFilename, s3Extension)
      : originalFilename

    // Use default bucket from config
    const bucket = config.aws.defaultBucket

    if (!bucket) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Default S3 bucket not configured',
      })
    }

    // Generate pre-signed URL options
    const urlOptions = {}
    
    // If download=true, add Content-Disposition header to force download
    if (download === 'true') {
      // Sanitize filename for Content-Disposition header
      const safeFilename = correctFilename.replace(/[^\w\s.-]/g, '_')
      urlOptions.responseContentDisposition = `attachment; filename="${safeFilename}"`
    }

    // Generate pre-signed URL (valid for 1 hour)
    const signedUrl = await s3Service.getSignedUrl(bucket, s3Key, 3600, urlOptions)

    res.json({
      success: true,
      url: signedUrl,
      expiresIn: 3600,
      mediaId: parseInt(mediaId),
      projectId: parseInt(projectId),
      filename: correctFilename,
      fileSize: fileSize,
    })
  } catch (error) {
    console.error('Media presigned URL generation error:', error.message)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to generate media URL',
    })
  }
}

export async function create3DMediaFile(req, res) {
  const projectId = req.params.projectId

  // Set extended timeout for large 3D file uploads
  req.setTimeout(1800000) // 30 minutes
  res.setTimeout(1800000)

  const media = models.MediaFile.build(req.body)

  // Ensure that the specimen_id is within the same project.
  if (
    media.specimen_id &&
    media.specimen_id !== '' &&
    media.specimen_id !== 'null'
  ) {
    const specimen = await models.Specimen.findByPk(media.specimen_id)
    if (specimen == null || specimen.project_id != projectId) {
      res.status(404).json({ message: 'Specimen is not found' })
      return
    }
  } else {
    media.specimen_id = null
  }

  // Ensure that the media view is within the same project.
  if (media.view_id && media.view_id !== '' && media.view_id !== 'null') {
    const view = await models.MediaView.findByPk(media.view_id)
    if (view == null || view.project_id != projectId) {
      res.status(404).json({ message: 'View is not found' })
      return
    }
  } else {
    media.view_id = null
  }

  if (media.is_copyrighted == 0) {
    media.copyright_permission = 0
  }

  // Set media type - use extension-based detection for 3D files
  let mediaType = MEDIA_TYPES.MODEL_3D // 3D media type string
  if (req.file && req.file.originalname) {
    const detectedType = convertMediaTypeFromExtension(req.file.originalname)
    if (detectedType === MEDIA_TYPES.MODEL_3D) {
      mediaType = MEDIA_TYPES.MODEL_3D // 3D files use string value
    }
  }

  // Validate specimen and view IDs before setting cataloguing status
  try {
    const validated = await validateSpecimenAndView(media.specimen_id, media.view_id, req.project.project_id)
    media.specimen_id = validated.specimen_id
    media.view_id = validated.view_id
  } catch (validationError) {
    res.status(400).json({ message: validationError.message })
    return
  }

  // Determine cataloguing status - if specimen and view are provided, auto-release
  const cataloguingStatus = (media.specimen_id && media.view_id) ? 0 : 1

  media.set({
    project_id: req.project.project_id,
    user_id: req.user.user_id,
    media_type: mediaType,
    cataloguing_status: cataloguingStatus, // 0 if specimen/view provided, 1 if needs curation
  })

  const transaction = await sequelizeConn.transaction()
  const mediaUploader = new S3MediaUploader(transaction, req.user)
  try {
    await media.save({
      transaction,
      user: req.user,
    })

    if (req.file) {
      await mediaUploader.setNonImageMedia(media, 'media', req.file)
    }

    await media.save({
      transaction,
      user: req.user,
      shouldSkipLogChange: true,
    })

    await transaction.commit()
    mediaUploader.commit()
  } catch (e) {
    await transaction.rollback()
    await mediaUploader.rollback()
    res
      .status(500)
      .json({ message: 'Failed to create 3D media with server error' })
    return
  }

  res.status(200).json({ media: convertMediaResponse(media) })
}

export async function createVideoMediaFile(req, res) {
  const projectId = req.params.projectId

  // Set extended timeout for large video file uploads
  req.setTimeout(1800000) // 30 minutes
  res.setTimeout(1800000)

  if (!req.file) {
    res.status(400).json({ message: 'No video file provided' })
    return
  }

  const media = models.MediaFile.build(req.body)

  // Ensure that the specimen_id is within the same project.
  if (
    media.specimen_id &&
    media.specimen_id !== '' &&
    media.specimen_id !== 'null'
  ) {
    const specimen = await models.Specimen.findByPk(media.specimen_id)
    if (specimen == null || specimen.project_id != projectId) {
      res.status(404).json({ message: 'Specimen is not found' })
      return
    }
  } else {
    media.specimen_id = null
  }

  // Ensure that the media view is within the same project.
  if (media.view_id && media.view_id !== '' && media.view_id !== 'null') {
    const view = await models.MediaView.findByPk(media.view_id)
    if (view == null || view.project_id != projectId) {
      res.status(404).json({ message: 'View is not found' })
      return
    }
  } else {
    media.view_id = null
  }

  if (media.is_copyrighted == 0) {
    media.copyright_permission = 0
  }

  // Set media type for video
  let mediaType = MEDIA_TYPES.VIDEO // Video media type string
  if (req.file && req.file.mimetype) {
    const detectedType = convertMediaTypeFromMimeType(req.file.mimetype)
    if (detectedType === MEDIA_TYPES.VIDEO) {
      mediaType = MEDIA_TYPES.VIDEO // Video files use string value
    }
  }

  // Determine cataloguing status - if specimen and view are provided, auto-release
  const cataloguingStatus = (media.specimen_id && media.view_id) ? 0 : 1

  media.set({
    project_id: req.project.project_id,
    user_id: req.user.user_id,
    media_type: mediaType,
    cataloguing_status: cataloguingStatus, // 0 if specimen/view provided, 1 if needs curation
  })

  const transaction = await sequelizeConn.transaction()
  const mediaUploader = new S3MediaUploader(transaction, req.user)
  const videoProcessor = new VideoProcessor()
  
  try {
    await media.save({
      transaction,
      user: req.user,
    })

    if (req.file) {
      // For video files, upload the original file and try to generate thumbnails
      await mediaUploader.setNonImageMedia(media, 'media', req.file)
      
      // Try to generate video thumbnails
      let tempVideoPath = null
      let tempDir = null
      
      try {
        tempVideoPath = req.file.path || `/tmp/video_${Date.now()}_${req.file.originalname}`
        
        // Write buffer to temporary file if needed
        if (req.file.buffer && !req.file.path) {
          await fs.writeFile(tempVideoPath, req.file.buffer)
        }
        
        // Extract video metadata and generate thumbnails
        const metadata = await videoProcessor.extractMetadata(tempVideoPath)
        tempDir = `/tmp/thumbnails_${Date.now()}`
        const thumbnailData = await videoProcessor.generateThumbnails(tempVideoPath, tempDir, metadata)
        
        // Upload thumbnails to S3 if they were generated
        if (thumbnailData.large.path && thumbnailData.thumbnail.path) {
          await mediaUploader.uploadVideoThumbnails(media, thumbnailData)
          console.log('Video thumbnails generated and uploaded successfully')
        } else {
          console.log('Video uploaded successfully, but thumbnail generation was skipped (FFmpeg not available)')
        }
        
      } catch (videoError) {
        console.warn('Video thumbnail generation failed:', videoError.message)
        console.log('Video uploaded successfully without thumbnails')
      } finally {
        // Always clean up temporary files, even if there was an error
        if (tempVideoPath || tempDir) {
          try {
            const cleanupPaths = [tempVideoPath, tempDir].filter(path => path)
            await videoProcessor.cleanup(cleanupPaths)
          } catch (cleanupError) {
            console.warn('Failed to cleanup temporary files:', cleanupError.message)
          }
        }
      }
    }

    await media.save({
      transaction,
      user: req.user,
      shouldSkipLogChange: true,
    })

    await transaction.commit()
    mediaUploader.commit()
    
      } catch (e) {
      await transaction.rollback()
      await mediaUploader.rollback()
      
      console.error('Video upload error:', e)
      res
        .status(500)
        .json({ 
          message: 'Failed to create video media with server error',
          details: process.env.NODE_ENV === 'development' ? e.message : undefined
        })
    return
  }

  res.status(200).json({ media: convertMediaResponse(media) })
}

export async function createStacksMediaFile(req, res) {
  const projectId = req.params.projectId
  const values = req.body

  // Set extended timeout for large stack/ZIP file uploads
  req.setTimeout(1800000) // 30 minutes
  res.setTimeout(1800000)

  // Don't create media if the zip file is missing.
  if (!req.file) {
    res.status(400).json({ message: 'No zip file in request' })
    return
  }

  // Validate that the uploaded file is actually a ZIP file
  const allowedMimeTypes = [
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream', // Some systems send this for ZIP files
  ]

  if (
    !allowedMimeTypes.includes(req.file.mimetype) &&
    !req.file.originalname.toLowerCase().endsWith('.zip')
  ) {
    res.status(400).json({
      message:
        'Uploaded file must be a ZIP archive. Please ensure you are uploading a .zip file.',
    })
    return
  }

  // Validate ZIP file size (max 1.5GB)
  const maxZipSize = 1536 * 1024 * 1024 // 1.5GB
  if (req.file.size > maxZipSize) {
    res.status(400).json({
      message:
        'ZIP file is too large. Maximum size is 1.5GB. Please split your files into smaller archives.',
    })
    return
  }

  // Ensure that the specimen is within the same project.
  if (
    values.specimen_id &&
    values.specimen_id !== '' &&
    values.specimen_id !== 'null'
  ) {
    const specimen = await models.Specimen.findByPk(values.specimen_id)
    if (specimen == null || specimen.project_id != projectId) {
      res.status(404).json({ message: 'Specimen is not found' })
      return
    }
  } else {
    // Set specimen_id to null if it's empty or invalid
    values.specimen_id = null
  }

  // Ensure that the view is within the same project.
  if (values.view_id && values.view_id !== '' && values.view_id !== 'null') {
    const view = await models.MediaView.findByPk(values.view_id)
    if (view == null || view.project_id != projectId) {
      res.status(404).json({ message: 'View is not found' })
      return
    }
  } else {
    // Set view_id to null if it's empty or invalid
    values.view_id = null
  }

  if (values.is_copyrighted == 0) {
    values.copyright_permission = 0
  }

  // Validate specimen and view IDs before setting cataloguing status
  try {
    const validated = await validateSpecimenAndView(values.specimen_id, values.view_id, req.project.project_id)
    values.specimen_id = validated.specimen_id
    values.view_id = validated.view_id
  } catch (validationError) {
    res.status(400).json({ message: validationError.message })
    return
  }

  // Determine cataloguing status - if specimen and view are provided, auto-release
  const cataloguingStatus = (values.specimen_id && values.view_id) ? 0 : 1

  // Create a single media record for the ZIP file
  const media = models.MediaFile.build(values)
  media.set({
    project_id: req.project.project_id,
    user_id: req.user.user_id,
    cataloguing_status: cataloguingStatus,
    media_type: MEDIA_TYPES.IMAGE, // Use image type for stack files (contains medical images)
  })

  const transaction = await sequelizeConn.transaction()
  const mediaUploader = new S3MediaUploader(transaction, req.user)
  let files = []

  try {
    // Save the media record first
    await media.save({
      transaction,
      user: req.user,
    })

    // Upload the entire ZIP file as non-image media
    await mediaUploader.setNonImageMedia(media, 'media', req.file)

    // Extract the ZIP to find the first image file for thumbnail generation
    files = await unzip(req.file.path)

    if (files.length === 0) {
      await transaction.rollback()
      await mediaUploader.rollback()
      res
        .status(400)
        .json({ message: 'ZIP file is empty or contains no valid files' })
      return
    }

    // Find the first suitable image file for thumbnail generation
    const imageExtensions = ['png', 'jpg', 'jpeg', 'tif', 'tiff', 'gif', 'bmp', 'webp']
    const firstImageFile = files.find((file) => {
      // Skip macOS metadata files and system files
      if (
        file.originalname.startsWith('__MACOSX/') ||
        file.originalname.startsWith('._') ||
        file.originalname.startsWith('.DS_Store') ||
        file.originalname.includes('/.DS_Store') ||
        file.originalname.startsWith('Thumbs.db') ||
        file.originalname.includes('/Thumbs.db')
      ) {
        return false
      }

      // Skip directories
      if (!file.originalname.includes('.')) {
        return false
      }

      const extension = file.originalname.split('.').pop().toLowerCase()
      return imageExtensions.includes(extension)
    })

    // Generate thumbnails if we found a suitable image file
    if (firstImageFile) {
      try {
        // Get existing media data
        const existingMedia = media.media || {}
        
        // Process the first image file to generate thumbnails
        const sharp = (await import('sharp')).default
        const image = sharp(firstImageFile.path)
        const metadata = await image.metadata()

        // Validate image dimensions for security
        if (metadata.width > 10000 || metadata.height > 10000) {
          throw new Error('Image dimensions too large for processing')
        }

        if (!metadata.width || !metadata.height) {
          throw new Error('Invalid image metadata - corrupted file')
        }

        // Generate large and thumbnail versions
        const sizes = {
          large: { maxWidth: 800, maxHeight: 800 },
          thumbnail: { width: 120, height: 120 },
        }

        for (const [sizeName, dimensions] of Object.entries(sizes)) {
          let processedImage = image

          if (sizeName === 'large') {
            // For large, maintain aspect ratio and compress if larger than 800px
            if (
              metadata.width > dimensions.maxWidth ||
              metadata.height > dimensions.maxHeight
            ) {
              processedImage = image.resize(
                dimensions.maxWidth,
                dimensions.maxHeight,
                {
                  fit: 'inside',
                  withoutEnlargement: true,
                }
              )
            }
          } else if (sizeName === 'thumbnail') {
            // For thumbnail, resize to exact dimensions
            processedImage = image.resize(dimensions.width, dimensions.height, {
              fit: 'cover',
            })
          }

          // Convert to buffer with compression - always use JPEG for consistency
          const buffer = await processedImage
            .jpeg({ quality: 85, progressive: true })
            .toBuffer()

          const processedMetadata = await processedImage.metadata()

          // Generate S3 key for thumbnail
          const fileName = `${media.project_id}_${media.media_id}_${sizeName}.jpg`
          const s3Key = `media_files/images/${media.project_id}/${media.media_id}/${fileName}`

          // Upload thumbnail to S3
          const result = await s3Service.putObject(
            config.aws.defaultBucket,
            s3Key,
            buffer,
            'image/jpeg'
          )

          // Add thumbnail data to existing media
          existingMedia[sizeName] = {
            S3_KEY: s3Key,
            S3_ETAG: result.etag,
            WIDTH: processedMetadata.width,
            HEIGHT: processedMetadata.height,
            FILESIZE: buffer.length,
            MIMETYPE: 'image/jpeg',
            EXTENSION: 'jpg',
            PROPERTIES: {
              height: processedMetadata.height,
              width: processedMetadata.width,
              mimetype: 'image/jpeg',
              filesize: buffer.length,
              version: sizeName,
            },
          }

          mediaUploader.uploadedFiles.push({
            bucket: config.aws.defaultBucket,
            key: s3Key,
            etag: result.etag,
          })
        }

        // Update the media data with thumbnails
        media.set('media', existingMedia)
        
      } catch (thumbnailError) {
        // Log specific error types for better debugging
        if (thumbnailError.message.includes('Input file contains unsupported image format')) {
          console.warn('Unsupported image format for thumbnail generation:', firstImageFile.originalname)
        } else if (thumbnailError.message.includes('Input file is corrupt')) {
          console.warn('Corrupted image file for thumbnail generation:', firstImageFile.originalname)
        } else if (thumbnailError.message.includes('dimensions too large')) {
          console.warn('Image too large for thumbnail processing:', firstImageFile.originalname)
        } else {
          console.warn('Failed to generate thumbnails from first image file:', thumbnailError.message)
        }
        // Continue without thumbnails - the ZIP file is still uploaded
      }
    } else {
      console.log('No suitable image file found in ZIP for thumbnail generation')
      // Add a generic archive icon for thumbnail
      const existingMedia = media.media || {}
      existingMedia.thumbnail = {
        USE_ICON: 'archive',
        PROPERTIES: {
          version: 'thumbnail',
        },
      }
      media.set('media', existingMedia)
    }

    // Save the media with thumbnail data
    await media.save({
      transaction,
      user: req.user,
      shouldSkipLogChange: true,
    })

    await transaction.commit()
    mediaUploader.commit()

    // Clean up temporary files
    try {
      await cleanupTempDirectory(path.dirname(files[0]?.path || ''))
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files:', cleanupError)
    }

  } catch (e) {
    await transaction.rollback()
    await mediaUploader.rollback()
    console.error('Error creating stack media:', e)

    // Clean up temporary files on error
    try {
      if (files && files.length > 0) {
        await cleanupTempDirectory(path.dirname(files[0].path))
      }
    } catch (cleanupError) {
      console.error('Error cleaning up temporary files on error:', cleanupError)
    }

    // Provide more specific error messages based on error type
    let errorMessage = 'Failed to create stack media with server error'
    let statusCode = 500

    if (e.message.includes('ZIP archive')) {
      errorMessage = 'Invalid ZIP archive or security constraint violated'
      statusCode = 400
    } else if (e.message.includes('Specimen is not found') || e.message.includes('View is not found')) {
      errorMessage = e.message
      statusCode = 400
    } else if (e.message.includes('S3') || e.message.includes('upload')) {
      errorMessage = 'Failed to upload file to storage'
      statusCode = 500
    }

    res.status(statusCode).json({
      message: errorMessage,
      error: e.message,
    })
    return
  }

  res.status(200).json({
    media: convertMediaResponse(media),
    message: 'Successfully uploaded stack archive.',
  })
}
