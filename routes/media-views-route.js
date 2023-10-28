import express from 'express'
import * as controller from '../controllers/media-views-controller.js'

const mediaViewsRouter = express.Router({ mergeParams: true })

mediaViewsRouter.get('/', controller.getMediaViews)
mediaViewsRouter.post('/create', controller.createViews)
mediaViewsRouter.post('/delete', controller.deleteViews)

mediaViewsRouter.get('/:viewId', controller.getView)
mediaViewsRouter.post('/:viewId/edit', controller.editView)

export default mediaViewsRouter
