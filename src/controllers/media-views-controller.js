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
  const { name, names, ...otherData } = values

  // Handle both 'names' array (new format) and 'name' string (legacy format)
  let viewNames = []
  if (names && Array.isArray(names)) {
    // New format: array of names already split
    viewNames = names.map((n) => n.trim()).filter((n) => n)
  } else if (name) {
    // Legacy format: split by semicolon
    viewNames = name
      .split(';')
      .map((n) => n.trim())
      .filter((n) => n)
  }

  if (viewNames.length === 0) {
    res.status(400).json({
      status: 'error',
      message: 'At least one view name is required',
    })
    return
  }

  // Check for duplicate names in the input
  const uniqueNames = new Set(viewNames)
  if (uniqueNames.size !== viewNames.length) {
    res.status(400).json({
      status: 'error',
      message: 'Duplicate view names are not allowed in the input',
    })
    return
  }

  // Check for existing view names in the project
  const existingViews = await models.MediaView.findAll({
    where: {
      project_id: req.project.project_id,
      name: viewNames,
    },
  })

  if (existingViews.length > 0) {
    const existingNames = existingViews.map((view) => view.name)
    res.status(400).json({
      status: 'error',
      message: 'Some view names already exist in this project',
      existingNames,
    })
    return
  }

  const createdViews = []
  try {
    const transaction = await sequelizeConn.transaction()

    for (const viewName of viewNames) {
      const mediaView = models.MediaView.build({
        ...otherData,
        name: viewName,
        project_id: req.project.project_id,
        user_id: req.user.user_id,
      })

      await mediaView.save({
        transaction,
        user: req.user,
      })
      createdViews.push(mediaView)
    }

    await transaction.commit()

    if (createdViews.length === 1) {
      res.status(200).json({ view: createdViews[0] })
    } else {
      res.status(200).json({
        status: 'ok',
        message: `Successfully created ${createdViews.length} views`,
        views: createdViews,
      })
    }
  } catch (e) {
    console.error('Error creating media views:', e)
    res.status(500).json({
      status: 'error',
      message: 'Failed to create media views with server error',
    })
  }
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
