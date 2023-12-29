import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'
import * as service from '../services/media-view-service.js'

export async function getMediaViews(req, res) {
  const projectId = req.project.project_id
  const views = await service.getMediaViews(projectId)
  res.status(200).json({ views })
}

export async function createViews(req, res) {
  const values = req.body
  const mediaView = models.MediaView.build(values)

  mediaView.set({
    project_id: req.project.project_id,
    user_id: req.user.user_id,
  })

  try {
    const transaction = await sequelizeConn.transaction()
    await mediaView.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
  } catch (e) {
    console.log(e)
    res.status(500).json({ message: 'Failed to create view with server error' })
    return
  }

  res.status(200).json({ view: mediaView })
}

export async function deleteViews(req, res) {
  const projectId = req.project.project_id
  const viewIds = req.body.view_ids
  const transaction = await sequelizeConn.transaction()
  await models.MediaView.destroy({
    where: {
      view_id: viewIds,
      project_id: projectId,
    },
    transaction: transaction,
    individualHooks: true,
    user: req.user,
  })
  await transaction.commit()
  res.status(200).json({ view_ids: viewIds })
}

export async function getView(req, res) {
  const projectId = req.project.project_id
  const viewId = req.params.viewId
  const mediaView = await models.MediaView.findByPk(viewId)
  if (mediaView == null || mediaView.project_id != projectId) {
    res.status(404).json({ message: 'Media View is not found' })
    return
  }
  res.status(200).json({
    view: mediaView,
  })
}

export async function editView(req, res) {
  const projectId = req.project.project_id
  const viewId = req.params.viewId
  const mediaView = await models.MediaView.findByPk(viewId)
  if (mediaView == null || mediaView.project_id != projectId) {
    res.status(404).json({ message: 'Media View is not found' })
    return
  }

  const values = req.body
  for (const column in values) {
    mediaView.set(column, values[column])
  }

  try {
    const transaction = await sequelizeConn.transaction()
    await mediaView.save({
      transaction,
      user: req.user,
    })
    await transaction.commit()
  } catch (e) {
    console.log(e)
    res
      .status(500)
      .json({ message: 'Failed to update media view with server error' })
    return
  }

  res.status(200).json({
    view: mediaView,
  })
}
