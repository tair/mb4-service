import express from 'express'
import * as controller from '../../controllers/media-controller.js'

const mediaServeRouter = express.Router({ mergeParams: true })

// Public routes for serving media files from S3 (no authentication required)
mediaServeRouter.get(
  '/:projectId/serve/:mediaId/:fileSize?',
  controller.serveMediaFile
)
mediaServeRouter.get('/:projectId/serve/batch', controller.serveBatchMediaFiles)

export default mediaServeRouter
