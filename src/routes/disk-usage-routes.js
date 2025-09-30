import express from 'express'
import * as diskUsageController from '../controllers/disk-usage-controller.js'
import { requireAdmin } from '../lib/auth-middleware.js'

const router = express.Router()

// All disk usage routes require admin privileges
router.use(requireAdmin)

/**
 * @route GET /api/disk-usage/statistics
 * @desc Get overall disk usage statistics
 * @access Admin
 */
router.get('/statistics', diskUsageController.getUsageStatistics)

/**
 * @route GET /api/disk-usage/projects/over-limit
 * @desc Get projects that exceed their disk usage limit
 * @access Admin
 */
router.get('/projects/over-limit', diskUsageController.getProjectsOverLimit)

/**
 * @route GET /api/disk-usage/projects/top-usage
 * @desc Get projects with highest disk usage
 * @query limit - Number of projects to return (default: 10, max: 1000)
 * @access Admin
 */
router.get(
  '/projects/top-usage',
  diskUsageController.validateTopUsageQuery,
  diskUsageController.getTopUsageProjects
)

/**
 * @route GET /api/disk-usage/projects/:projectId
 * @desc Get disk usage information for a specific project
 * @access Admin
 */
router.get(
  '/projects/:projectId',
  diskUsageController.validateProjectId,
  diskUsageController.getProjectDiskUsage
)

/**
 * @route GET /api/disk-usage/validate/project/:projectId
 * @desc Validate disk usage accuracy for a specific project
 * @access Admin
 */
router.get(
  '/validate/project/:projectId',
  diskUsageController.validateProjectId,
  diskUsageController.validateProjectDiskUsage
)

/**
 * @route GET /api/disk-usage/validate/all
 * @desc Validate disk usage accuracy for all projects
 * @access Admin
 */
router.get('/validate/all', diskUsageController.validateAllProjectsDiskUsage)

/**
 * @route POST /api/disk-usage/recalculate/project/:projectId
 * @desc Recalculate and fix disk usage for a specific project
 * @access Admin
 */
router.post(
  '/recalculate/project/:projectId',
  diskUsageController.validateProjectId,
  diskUsageController.recalculateProjectDiskUsage
)

/**
 * @route POST /api/disk-usage/recalculate/all
 * @desc Recalculate and fix disk usage for all projects
 * @access Admin
 */
router.post('/recalculate/all', diskUsageController.recalculateAllProjectsDiskUsage)

/**
 * @route PUT /api/disk-usage/projects/:projectId/limit
 * @desc Update disk usage limit for a project
 * @body limit - New limit in bytes or human readable format (e.g., "5GB")
 * @access Admin
 */
router.put(
  '/projects/:projectId/limit',
  diskUsageController.validateProjectId,
  diskUsageController.validateDiskLimit,
  diskUsageController.updateProjectDiskLimit
)

export default router
