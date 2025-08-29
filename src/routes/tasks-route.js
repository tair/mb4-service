import express from 'express'
import * as controller from '../controllers/tasks-controller.js'
import * as dataDumpController from '../controllers/datadump-controller.js'
import { authenticateToken } from './auth-interceptor.js'

const router = express.Router()

router.get('/process', controller.process)
router.get('/reset', controller.reset)
router.get('/reset-stuck', controller.resetStuck)
router.get('/debug-failures', controller.debugFailures)

// Task status endpoint (requires authentication)
router.get(
  '/:taskId/status',
  authenticateToken,
  dataDumpController.getSDDExportTaskStatus
)

export default router
