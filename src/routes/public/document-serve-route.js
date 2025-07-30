import express from 'express'
import * as controller from '../../controllers/document-controller.js'

const documentServeRouter = express.Router({ mergeParams: true })

// Public routes for serving document files from S3 (no authentication required)
documentServeRouter.get(
  '/:projectId/serve/:documentId',
  controller.serveDocumentFile
)

export default documentServeRouter 