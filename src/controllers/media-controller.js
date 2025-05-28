import sequelizeConn from '../util/db.js'
import * as service from '../services/media-service.js'
import * as bibliographyService from '../services/bibliography-service.js'
import * as folioService from '../services/folios-service.js'
import { getMedia, convertMediaTypeFromMimeType } from '../util/media.js'
import { unzip } from '../util/zip.js'
import { models } from '../models/init-models.js'
import { MediaUploader } from '../lib/media-uploader.js'
import {
  ModelRefencialMapper,
  ModelReferencialConfig,
} from '../lib/datamodel/model-referencial-mapper.js'

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
  if (media.specimen_id) {
    const specimen = await models.Specimen.findByPk(media.specimen_id)
    if (specimen == null || specimen.project_id != projectId) {
      res.status(404).json({ message: 'Specimen is not found' })
      return
    }
  }

  // Ensure that the media view is within the same project.
  if (media.view_id) {
    const view = await models.MediaView.findByPk(media.view_id)
    if (view == null || view.project_id != projectId) {
      res.status(404).json({ message: 'View is not found' })
      return
    }
  }

  if (media.is_copyrighted == 0) {
    media.copyright_permission = 0
  }

  media.set({
    project_id: req.project.project_id,
    user_id: req.user.user_id,
    media_type: convertMediaTypeFromMimeType(req.file.mimetype),
  })

  const transaction = await sequelizeConn.transaction()
  const mediaUploader = new MediaUploader(transaction, req.user)
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
  } catch (e) {
    await transaction.rollback()
    mediaUploader.rollback()
    console.log(e)
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

  // Ensure that the specimen is within the same project.
  if (values.specimen_id) {
    const specimen = await models.Specimen.findByPk(values.specimen_id)
    if (specimen == null || specimen.project_id != projectId) {
      res.status(404).json({ message: 'Specimen is not found' })
      return
    }
  }

  // Ensure that the view is within the same project.
  if (values.view_id) {
    const view = await models.MediaView.findByPk(values.view_id)
    if (view == null || view.project_id != projectId) {
      res.status(404).json({ message: 'View is not found' })
      return
    }
  }

  if (values.is_copyrighted == 0) {
    values.copyright_permission = 0
  }

  const mediaFiles = []
  const transaction = await sequelizeConn.transaction()
  const mediaUploader = new MediaUploader(transaction, req.user)
  try {
    const files = await unzip(req.file.path)
    for (const file of files) {
      const media = models.MediaFile.build(values)
      media.set({
        project_id: req.project.project_id,
        user_id: req.user.user_id,
        cataloguing_status: 1,
        media_type: convertMediaTypeFromMimeType(req.file.mimetype),
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
    }

    await transaction.commit()
  } catch (e) {
    await transaction.rollback()
    mediaUploader.rollback()
    console.log(e)
    res
      .status(500)
      .json({ message: 'Failed to create media with server error' })
    return
  }

  res.status(200).json({
    media: mediaFiles.map((media) => convertMediaResponse(media)),
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
    console.log('Error deleting media', e)
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
  if (values.specimen_id) {
    const specimen = await models.Specimen.findByPk(values.specimen_id)
    if (specimen == null || specimen.project_id != projectId) {
      res.status(404).json({ message: 'Specimen is not found' })
      return
    }
  }

  // Ensure that the media view is within the same project.
  if (values.view_id) {
    const view = await models.MediaView.findByPk(values.view_id)
    if (view == null || view.project_id != projectId) {
      res.status(404).json({ message: 'View is not found' })
      return
    }
  }

  for (const column in values) {
    media.set(column, values[column])
  }

  const transaction = await sequelizeConn.transaction()
  const mediaUploader = new MediaUploader(transaction, req.user)
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
    res.status(200).json({ media: convertMediaResponse(media) })
  } catch (e) {
    await transaction.rollback()
    await mediaUploader.rollback()
    console.log(e)
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

    await models.MediaFile.update(values, {
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
    res.status(200).json({
      media: results.map((media) => convertMediaResponse(media)),
    })
  } catch (e) {
    await transaction.rollback()
    console.log(e)
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
    console.log(e)
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
    console.log(e)
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
    console.log('Error deleting citations', e)
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
    thumbnail: row.media ? getMedia(row.media, 'thumbnail') : undefined,
    icon: row.media ? getMedia(row.media, 'icon') : undefined,
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
