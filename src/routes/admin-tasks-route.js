import express from 'express'
import { authenticateToken } from './auth-interceptor.js'
import { authorizeUser } from './user-interceptor.js'
import { requireAdmin } from '../lib/auth-middleware.js'
import * as adminTasksController from '../controllers/admin-tasks-controller.js'

const router = express.Router()

// All routes require authentication and admin privileges
router.use(authenticateToken)
router.use(authorizeUser)
router.use(requireAdmin)

/**
 * @route GET /admin/tasks/summary
 * @desc Get task queue summary with counts by status and handler
 * @access Admin only
 */
router.get('/summary', adminTasksController.getTaskSummary)

/**
 * @route GET /admin/tasks/history
 * @desc Get paginated task history with filtering
 * @query { page, limit, status, handler, search }
 * @access Admin only
 */
router.get('/history', adminTasksController.getTaskHistory)

/**
 * @route GET /admin/tasks/failures
 * @desc Get recent task failures with details
 * @query { limit }
 * @access Admin only
 */
router.get('/failures', adminTasksController.getRecentFailures)

/**
 * @route GET /admin/tasks/cipres
 * @desc Get CIPRES request status summary and recent jobs
 * @access Admin only
 */
router.get('/cipres', adminTasksController.getCipresStatus)

/**
 * @route GET /admin/tasks/scheduler
 * @desc Get scheduler status with job health
 * @access Admin only
 */
router.get('/scheduler', adminTasksController.getSchedulerStatus)

/**
 * @route GET /admin/tasks/handlers
 * @desc Get list of available task handlers
 * @access Admin only
 */
router.get('/handlers', adminTasksController.getHandlers)

/**
 * @route POST /admin/tasks/retry/:taskId
 * @desc Retry a failed task
 * @access Admin only
 */
router.post('/retry/:taskId', adminTasksController.retryTask)

/**
 * @route POST /admin/tasks/trigger/:jobName
 * @desc Trigger a scheduler job manually
 * @access Admin only
 */
router.post('/trigger/:jobName', adminTasksController.triggerSchedulerJob)

export default router

