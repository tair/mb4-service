import sequelizeConn from '../util/db.js'
import * as service from '../services/folios-service.js'
import * as mediaService from '../services/media-service.js'
import { models } from '../models/init-models.js'
import { parseIntArray } from '../util/util.js'

export async function getFolios(req, res) {
  const projectId = req.params.projectId
  try {
    const folios = await service.getFolios(projectId)
    res.status(200).json({
      folios: folios.map((row) => convertFolioResponse(row)),
    })
  } catch (err) {
    console.error(`Error: Cannot get folios for ${projectId}`, err)
    res.status(500).json({ message: 'Error while fetching folios.' })
  }
}

export async function createFolio(req, res) {
  const values = req.body.folio
  const folio = models.Folio.build(values)

  folio.set({
    project_id: req.project.project_id,
    user_id: req.user.user_id,
  })

  const transaction = await sequelizeConn.transaction()
  try {
    await folio.save({
      transaction,
      user: req.user,
    })

    await transaction.commit()

    res.status(200).json({ folio: convertFolioResponse(folio) })
  } catch (e) {
    await transaction.rollback()
    console.log(e)
    res
      .status(500)
      .json({ message: 'Failed to create folio with server error' })
  }
}

export async function deleteFolios(req, res) {
  const projectId = req.project.project_id
  const folioIds = req.body.folio_ids
  if (folioIds.length == 0) {
    return res.status(400).json({
      message: 'No folio is specified',
    })
  }

  const isInProject = await service.isFolioInProject(folioIds, projectId)
  if (!isInProject) {
    return res.status(400).json({
      message: 'Not all folio are in the specified project',
    })
  }

  const transaction = await sequelizeConn.transaction()
  try {
    await models.Folio.destroy({
      where: {
        folio_id: folioIds,
        project_id: projectId,
      },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })
    await transaction.commit()
    res.status(200).json({ folio_ids: folioIds })
  } catch (e) {
    await transaction.rollback()
    res.status(200).json({ message: 'Error deleting folio' })
    console.log('Error deleting folio', e)
  }
}

export async function getPublishedFolio(req, res) {
  const folioId = req.params.folioId
  const folio = await models.Folio.findByPk(folioId)
  if (folio == null || folio.published != 0) { // the published = 0 logic is adopted from V3
    res.status(404).json({ message: 'Folio is not found' })
    return
  }

  const project = await folio.getProjects()
  if (project.published != 1) {
    res.status(404).json({ message: 'Folio is not found' })
    return
  }

  res.status(200).json({ folio_id: folio.folio_id, project_id: project.project_id })
}

export async function getFolio(req, res) {
  const projectId = req.project.project_id
  const folioId = req.params.folioId
  const folio = await models.Folio.findByPk(folioId)
  if (folio == null || folio.project_id != projectId) {
    res.status(404).json({ message: 'Folio is not found' })
    return
  }

  res.status(200).json({ folio: convertFolioResponse(folio) })
}

export async function editFolio(req, res) {
  const projectId = req.project.project_id
  const folioId = req.params.folioId
  const folio = await models.Folio.findByPk(folioId)
  if (folio == null || folio.project_id != projectId) {
    res.status(404).json({ message: 'Folio is not found' })
    return
  }

  const values = req.body.folio

  for (const column in values) {
    folio.set(column, values[column])
  }

  const transaction = await sequelizeConn.transaction()
  try {
    await folio.save({
      transaction,
      user: req.user,
    })

    await transaction.commit()
    res.status(200).json({ folio: convertFolioResponse(folio) })
  } catch (e) {
    console.log(e)
    await transaction.rollback()
    res
      .status(500)
      .json({ message: 'Failed to create folio with server error' })
  }
}

export async function getMedia(req, res) {
  const projectId = req.project.project_id
  const folioId = req.params.folioId
  const media = await service.getMedia(projectId, folioId)
  res.status(200).json({
    media,
  })
}

export async function createMedia(req, res) {
  const projectId = req.project.project_id

  // If no media was selected, then we don't need to create any media. This will
  // return an empty array so that we can succeed the request.
  const mediaIds = parseIntArray(req.body.media_ids)
  if (mediaIds.length == 0) {
    res.status(200).json({ media: [] })
    return
  }

  const folioId = req.params.folioId
  const folio = await models.Folio.findByPk(folioId)
  if (folio == null || folio.project_id != projectId) {
    res.status(404).json({ message: 'Folio is not found' })
    return
  }

  const isInProject = await mediaService.isMediaInProject(mediaIds, projectId)
  if (!isInProject) {
    return res.status(400).json({
      message: 'Not all media are in the specified project',
    })
  }

  const transaction = await sequelizeConn.transaction()
  try {
    let position = await service.getMaxPositionForFolioMedia(folioId)
    const folioMedia = await models.FoliosXMediaFile.bulkCreate(
      mediaIds.map((mediaId) => ({
        folio_id: folioId,
        media_id: mediaId,
        position: ++position,
      })),
      {
        transaction: transaction,
        individualHooks: true,
        user: req.user,
      }
    )
    await transaction.commit()
    res.status(200).json({ media: folioMedia })
  } catch (e) {
    console.log(e)
    await transaction.rollback()
    res.status(500).json({ message: 'Failed to create media' })
  }
}

export async function reorderMedia(req, res) {
  const projectId = req.project.project_id
  const folioId = req.params.folioId
  const linkIds = req.param.link_ids
  const index = req.body.index
  const folio = await models.Folio.findByPk(folioId)
  if (folio == null || folio.project_id != projectId) {
    res.status(404).json({ message: 'Folio is not found' })
    return
  }

  try {
    await service.reorderMedia(folioId, linkIds, index)
    res.status(200).json({ status: true })
  } catch (e) {
    console.log(e)
    res.status(500).json({ message: 'Failed to create media' })
  }
}

export async function deleteMedia(req, res) {
  const linkIds = parseIntArray(req.body.link_ids)
  if (linkIds.length == 0) {
    return res.status(200).json({ link_ids: [] })
  }

  const projectId = req.project.project_id
  const folioId = req.params.folioId
  const folio = await models.Folio.findByPk(folioId)
  if (folio == null || folio.project_id != projectId) {
    res.status(404).json({ message: 'Folio is not found' })
    return
  }

  const transaction = await sequelizeConn.transaction()
  try {
    const inProject = await service.isLinkInFolio(folioId, linkIds)
    if (!inProject) {
      await transaction.rollback()
      return res.status(400).json({
        message: 'Not all media are in the specified folio',
      })
    }

    await models.FoliosXMediaFile.destroy({
      where: {
        link_id: linkIds,
      },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })
    await transaction.commit()
    res.status(200).json({ link_ids: linkIds })
  } catch (e) {
    await transaction.rollback()
    res.status(200).json({ message: "Error deleting folio's media" })
    console.log('Error deleting media', e)
  }
}

// TODO(kenzley): Implement a real search.
export async function searchMedia(req, res) {
  const projectId = req.project.project_id
  const folioId = req.params.folioId
  const projectMedia = await mediaService.getMediaFiles(projectId)
  const folioMedia = await service.getMedia(projectId, folioId)
  const folioMediaSet = new Set(folioMedia.map((m) => m.media_id))
  res.status(200).json({
    media_ids: projectMedia
      .filter((m) => !folioMediaSet.has(m.media_id))
      .map((m) => m.media_id),
  })
}

function convertFolioResponse(row) {
  return {
    folio_id: row.folio_id,
    name: row.name,
    description: row.description,
    published: row.published,
    user_id: row.user_id,
    created_on: row.created_on,
    last_modified_on: row.last_modified_on,
  }
}
