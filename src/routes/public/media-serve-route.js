import express from 'express'
import * as controller from '../../controllers/media-controller.js'

const mediaServeRouter = express.Router({ mergeParams: true })

// Public routes for serving media files from S3 (no authentication required)
mediaServeRouter.get(
  '/:projectId/serve/:mediaId/:fileSize?',
  controller.serveMediaFile
)
mediaServeRouter.get('/:projectId/serve/batch', controller.serveBatchMediaFiles)

// Get pre-signed URL for video files (avoids proxy overhead and enables streaming)
mediaServeRouter.get(
  '/:projectId/video-url/:mediaId',
  controller.getMediaVideoUrl
)

// Get pre-signed URL for any media file (avoids proxy timeout for large files like 3D models)
mediaServeRouter.get(
  '/:projectId/media-url/:mediaId',
  controller.getMediaPresignedUrl
)

export default mediaServeRouter
