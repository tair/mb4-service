import express from 'express'
import * as controller from '../controllers/media-views-controller.js'
import { requireEntityEditPermission, EntityType } from '../lib/auth-middleware.js'

const mediaViewsRouter = express.Router({ mergeParams: true })

mediaViewsRouter.get('/', controller.getMediaViews)
mediaViewsRouter.post('/create', requireEntityEditPermission(EntityType.MEDIA_VIEW), controller.createViews)
mediaViewsRouter.post('/delete', requireEntityEditPermission(EntityType.MEDIA_VIEW), controller.deleteViews)

mediaViewsRouter.get('/:viewId', controller.getView)
mediaViewsRouter.post('/:viewId/edit', requireEntityEditPermission(EntityType.MEDIA_VIEW), controller.editView)

export default mediaViewsRouter
