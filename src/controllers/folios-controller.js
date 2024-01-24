import * as service from '../services/folio-service.js'

import { models } from '../models/init-models.js'

export async function getFolios(req, res) {
  const projectId = req.params.projectId
  try {
    const folios = await service.getFolios(projectId)
    res.status(200).json({
      folios: folios.map((row) => convertFolioResponse(row)),
    })
  } catch (err) {
    console.error(`Error: Cannot get media files for ${projectId}`, err)
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

    res.status(200).json({ media: convertFolioResponse(media) })
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
        media_id: folioIds,
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

export async function getFolio(req, res) {
  throw 'Unimplemented'
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
    res.status(200).json({ folio: convertFolioResponse(media) })
  } catch (e) {
    await transaction.rollback()
    console.log(e)
    res
      .status(500)
      .json({ message: 'Failed to create folio with server error' })
  }
}

export async function getMedia(req, res) {
  throw 'Unimplemented'
}

export async function createMedia(req, res) {
  throw 'Unimplemented'
}

export async function editMedia(req, res) {
  throw 'Unimplemented'
}

export async function deleteMedia(req, res) {
  throw 'Unimplemented'
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