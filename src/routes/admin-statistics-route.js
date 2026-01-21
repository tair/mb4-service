import express from 'express'
import { authenticateToken } from './auth-interceptor.js'
import { authorizeUser } from './user-interceptor.js'
import { requireAdmin } from '../lib/auth-middleware.js'
import * as adminStatisticsController from '../controllers/admin-statistics-controller.js'

const router = express.Router()

// All routes require authentication and admin privileges
router.use(authenticateToken)
router.use(authorizeUser)
router.use(requireAdmin)

/**
 * @route GET /admin/statistics/site
 * @desc Get site statistics with optional date range filter
 * @query { daterange } - Optional date range (defaults to "today")
 * @access Admin only
 */
router.get('/site', adminStatisticsController.getSiteStatistics)

/**
 * @route GET /admin/statistics/site/totals
 * @desc Get all-time site totals only
 * @access Admin only
 */
router.get('/site/totals', adminStatisticsController.getSiteTotals)

/**
 * @route GET /admin/statistics/site/all-ranges
 * @desc Get all date range statistics at once for client-side caching
 * @access Admin only
 */
router.get('/site/all-ranges', adminStatisticsController.getAllDateRangeStats)

/**
 * @route GET /admin/statistics/site/login-info
 * @desc Get detailed login information
 * @query { daterange } - Optional date range (defaults to "today")
 * @access Admin only
 */
router.get('/site/login-info', adminStatisticsController.getLoginInfo)

/**
 * @route GET /admin/statistics/site/download-info
 * @desc Get detailed download information
 * @query { daterange, download_type } - Optional date range and download type filter
 * @access Admin only
 */
router.get('/site/download-info', adminStatisticsController.getDownloadInfo)

/**
 * @route GET /admin/statistics/site/upload-info
 * @desc Get detailed upload information
 * @query { daterange, upload_type } - Optional date range and upload type filter
 * @access Admin only
 */
router.get('/site/upload-info', adminStatisticsController.getUploadInfo)

/**
 * @route GET /admin/statistics/site/registration-info
 * @desc Get registration trends
 * @query { daterange } - Optional date range (defaults to "today")
 * @access Admin only
 */
router.get('/site/registration-info', adminStatisticsController.getRegistrationInfo)

/**
 * @route GET /admin/statistics/site/project-pub-info
 * @desc Get project creation and publication trends
 * @query { daterange } - Optional date range (defaults to "today")
 * @access Admin only
 */
router.get('/site/project-pub-info', adminStatisticsController.getProjectPubInfo)

/**
 * @route GET /admin/statistics/site/location-info
 * @desc Get geographic location information
 * @query { daterange } - Optional date range (defaults to "today")
 * @access Admin only
 */
router.get('/site/location-info', adminStatisticsController.getLocationInfo)

/**
 * @route GET /admin/statistics/projects
 * @desc Get project statistics with pagination
 * @query { page, limit, sort, order, search } - Pagination and filtering options
 * @access Admin only
 */
router.get('/projects', adminStatisticsController.getProjectStatistics)

/**
 * @route GET /admin/statistics/projects/:projectId
 * @desc Get detailed statistics for a single project
 * @access Admin only
 */
router.get('/projects/:projectId', adminStatisticsController.getProjectDetailedStats)

export default router

