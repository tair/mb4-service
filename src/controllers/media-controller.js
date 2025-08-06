import sequelizeConn from '../util/db.js'
import * as service from '../services/media-service.js'
import * as bibliographyService from '../services/bibliography-service.js'
import * as folioService from '../services/folios-service.js'
import { getMedia, convertMediaTypeFromMimeType } from '../util/media.js'
import { unzip, cleanupTempDirectory } from '../util/zip.js'
import { models } from '../models/init-models.js'
import { S3MediaUploader } from '../lib/s3-media-uploader.js'
import {
  ModelRefencialMapper,
  ModelReferencialConfig,
} from '../lib/datamodel/model-referencial-mapper.js'
import s3Service from '../services/s3-service.js'
import config from '../config.js'
import path from 'path'

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
  let mediaType = 1 // Default to image
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

  // Validate ZIP file size (max 100MB)
  const maxZipSize = 100 * 1024 * 1024 // 100MB
  if (req.file.size > maxZipSize) {
    res.status(400).json({
      message:
        'ZIP file is too large. Maximum size is 100MB. Please split your files into smaller archives.',
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

  for (const column in values) {
    media.set(column, values[column])
  }

  const transaction = await sequelizeConn.transaction()
  const mediaUploader = new S3MediaUploader(transaction, req.user)
  try {
    if (req.file) {
      await mediaUploader.setMedia(media, 'media', req.file)
    }

    await media.save({
      transaction,
      user: req.user,
      shouldSkipLogChange: true,
    })

    await transaction.commit()
    mediaUploader.commit()
    res.status(200).json({ media: convertMediaResponse(media) })
  } catch (e) {
    await transaction.rollback()
    await mediaUploader.rollback()
    res
      .status(500)
      .json({ message: 'Failed to create media with server error' })
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
  const media = models.MediaFile.findByPk(mediaId)
  if (media == null || media.project_id != projectId) {
    res.status(404).json({ message: 'Media is not found' })
    return
  }

  res.status(200).json({ media: convertMediaResponse(media) })
}

export async function editMediaFiles(req, res) {
  const projectId = req.project.project_id
  const mediaIds = req.body.media_ids
  const values = req.body.media

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
  const referenceId = req.body.citation.reference_id
  const bibliography = await models.BibliographicReference.findByPk(referenceId)
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

  for (const key in values) {
    citation.set(key, values[key])
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
  return {
    media_id: parseInt(row.media_id),
    project_id: parseInt(row.project_id),
    user_id: parseInt(row.user_id),
    view_id: row.view_id ? parseInt(row.view_id) : undefined,
    specimen_id: row.specimen_id ? parseInt(row.specimen_id) : undefined,
    // Don't set thumbnail/icon - let frontend construct URLs using buildMediaUrl
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

    let s3Key
    if (mediaVersion.S3_KEY) {
      // New S3-based system
      s3Key = mediaVersion.S3_KEY
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

    // Set appropriate headers
    res.set({
      'Content-Type': result.contentType || 'application/octet-stream',
      'Content-Length': result.contentLength,
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Last-Modified': result.lastModified,
    })

    // Send the data
    res.send(result.data)
  } catch (error) {
    console.error('Media serve error:', error.message)

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
    console.error('Batch Media Serve Error:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to serve batch media files',
    })
  }
}
