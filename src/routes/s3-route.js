import express from 'express'
import * as controller from '../controllers/s3-controller.js'

const router = express.Router()

// PUT /s3/upload - Upload object to default S3 bucket
router.put('/upload', controller.uploadObject)

// PUT /s3/upload/bulk - Upload multiple objects (original, large, thumbnail) to default S3 bucket
router.put('/upload/bulk', controller.uploadBulkObjects)

// GET /s3/*key - Get object from default S3 bucket
// The * allows for capturing nested paths as a single parameter
router.get('/*', controller.getObject)

// HEAD /s3/*key - Check if object exists in default S3 bucket
router.head('/*', controller.checkObject)

export default router 