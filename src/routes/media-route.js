import express from 'express'
import * as controller from '../controllers/media-controller.js'
import mediaLabelsRouter from './media-labels-route.js'
import { upload } from './upload.js'
import { requireEntityEditPermission, EntityType } from '../lib/auth-middleware.js'

const mediaRouter = express.Router({ mergeParams: true })

mediaRouter.get('/', controller.getMediaFiles)
mediaRouter.get('/filter/ids', controller.getFilterMediaIds)
mediaRouter.get('/download/filenames', controller.downloadFilenames)

mediaRouter.post('/delete', requireEntityEditPermission(EntityType.MEDIA), controller.deleteMediaFiles)
mediaRouter.post('/edit', requireEntityEditPermission(EntityType.MEDIA), controller.editMediaFiles)

mediaRouter.post('/create', requireEntityEditPermission(EntityType.MEDIA), upload.single('file'), controller.createMediaFile)
mediaRouter.post(
  '/create/batch',
  requireEntityEditPermission(EntityType.MEDIA),
  upload.single('file'),
  controller.createMediaFiles
)
mediaRouter.post('/create/3d', requireEntityEditPermission(EntityType.MEDIA), upload.single('file'), controller.create3DMediaFile)
mediaRouter.post('/create/video', requireEntityEditPermission(EntityType.MEDIA), upload.single('file'), controller.createVideoMediaFile)
mediaRouter.post('/create/stacks', requireEntityEditPermission(EntityType.MEDIA), upload.single('file'), controller.createStacksMediaFile)

mediaRouter.get('/:mediaId', controller.getMediaFile)
mediaRouter.get('/:mediaId/details', controller.getMediaFileDetails)
mediaRouter.post(
  '/:mediaId/edit',
  requireEntityEditPermission(EntityType.MEDIA),
  upload.single('file'),
  controller.editMediaFile
)

mediaRouter.get('/:mediaId/citations', controller.getCitations)
mediaRouter.post('/:mediaId/citations/create', requireEntityEditPermission(EntityType.MEDIA), controller.createCitation)
mediaRouter.post(
  '/:mediaId/citations/:citationId/edit',
  requireEntityEditPermission(EntityType.MEDIA),
  controller.editCitation
)
mediaRouter.post('/:mediaId/citations/delete', requireEntityEditPermission(EntityType.MEDIA), controller.deleteCitations)

// This is a sub-route focused on /media/<media ID>/labels
mediaRouter.use('/:mediaId/labels', mediaLabelsRouter)

export default mediaRouter
