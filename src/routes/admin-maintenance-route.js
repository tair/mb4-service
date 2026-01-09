import express from 'express'
import { authenticateToken } from './auth-interceptor.js'
import { authorizeUser } from './user-interceptor.js'
import { requireAdmin } from '../lib/auth-middleware.js'
import * as maintenanceController from '../controllers/admin-maintenance-controller.js'

const router = express.Router()

// All routes require authentication and admin privileges
router.use(authenticateToken)
router.use(authorizeUser)
router.use(requireAdmin)

/**
 * @route GET /admin/maintenance
 * @desc Get current maintenance message settings
 * @access Admin only
 */
router.get('/', maintenanceController.getMaintenanceSettings)

/**
 * @route PUT /admin/maintenance
 * @desc Update maintenance message settings
 * @body { enabled: boolean, scheduleEnabled: boolean, message: string }
 * @access Admin only
 */
router.put('/', maintenanceController.updateMaintenanceSettings)

export default router

