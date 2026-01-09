import express from 'express'
import { authenticateToken } from './auth-interceptor.js'
import { authorizeUser } from './user-interceptor.js'
import { requireAdmin } from '../lib/auth-middleware.js'
import * as adminUsersController from '../controllers/admin-users-controller.js'

const router = express.Router()

// All routes require authentication and admin privileges
router.use(authenticateToken)
router.use(authorizeUser)
router.use(requireAdmin)

/**
 * @route GET /admin/users/stats
 * @desc Get user statistics for admin dashboard
 * @access Admin only
 */
router.get('/stats', adminUsersController.getUserStats)

/**
 * @route GET /admin/users
 * @desc List users with filters, pagination and sorting
 * @query { status, search, sortBy, sortOrder, page, perPage }
 * @access Admin only
 */
router.get('/', adminUsersController.listUsers)

/**
 * @route GET /admin/users/:id
 * @desc Get a single user with roles and institutions
 * @access Admin only
 */
router.get('/:id', adminUsersController.getUser)

/**
 * @route POST /admin/users
 * @desc Create a new user
 * @body { email, fname, lname, active, roleIds, institutionIds }
 * @access Admin only
 */
router.post('/', adminUsersController.createUser)

/**
 * @route PUT /admin/users/:id
 * @desc Update user details
 * @body { email, fname, lname, userclass }
 * @access Admin only
 */
router.put('/:id', adminUsersController.updateUser)

/**
 * @route DELETE /admin/users/:id
 * @desc Soft delete a user (set userclass to 255)
 * @access Admin only
 */
router.delete('/:id', adminUsersController.deleteUser)

/**
 * @route POST /admin/users/:id/activate
 * @desc Activate a user and optionally send activation email
 * @body { sendEmail: boolean }
 * @access Admin only
 */
router.post('/:id/activate', adminUsersController.activateUser)

/**
 * @route POST /admin/users/:id/deactivate
 * @desc Deactivate a user
 * @access Admin only
 */
router.post('/:id/deactivate', adminUsersController.deactivateUser)

/**
 * @route PUT /admin/users/:id/roles
 * @desc Update user's roles
 * @body { roleIds: number[] }
 * @access Admin only
 */
router.put('/:id/roles', adminUsersController.updateUserRoles)

/**
 * @route PUT /admin/users/:id/institutions
 * @desc Update user's institutions
 * @body { institutionIds: number[] }
 * @access Admin only
 */
router.put('/:id/institutions', adminUsersController.updateUserInstitutions)

/**
 * @route GET /admin/users/roles/all
 * @desc Get all available roles
 * @access Admin only
 */
router.get('/roles/all', adminUsersController.getRoles)

export default router

