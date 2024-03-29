import express from 'express'
import * as controller from '../controllers/media-controller.js'
import { upload } from './upload.js'

const mediaRouter = express.Router({ mergeParams: true })

mediaRouter.get('/', controller.getMediaFiles)
mediaRouter.post('/create', upload.single('file'), controller.createMediaFile)
mediaRouter.post('/delete', controller.deleteMediaFiles)
mediaRouter.post('/edit', controller.editMediaFiles)

mediaRouter.get('/:mediaId', controller.getMediaFile)
mediaRouter.post(
  '/:mediaId/edit',
  upload.single('file'),
  controller.editMediaFile
)

mediaRouter.get('/:mediaId/citations', controller.getCitations)
mediaRouter.post('/:mediaId/citations/create', controller.createCitation)
mediaRouter.post(
  '/:mediaId/citations/:citationId/edit',
  controller.editCitation
)
mediaRouter.post('/:mediaId/citations/delete', controller.deleteCitations)

export default mediaRouter
