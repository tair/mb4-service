import DiskUsageService from '../services/disk-usage-service.js'
import { body, param, query, validationResult } from 'express-validator'

/**
 * Get disk usage statistics
 */
export async function getUsageStatistics(req, res) {
  try {
    const stats = await DiskUsageService.getUsageStatistics()
    res.json(stats)
  } catch (error) {
    console.error('Error getting usage statistics:', error)
    res.status(500).json({ 
      message: 'Failed to get usage statistics',
      error: error.message 
    })
  }
}

/**
 * Get projects over their disk usage limit
 */
export async function getProjectsOverLimit(req, res) {
  try {
    const projects = await DiskUsageService.getProjectsOverLimit()
    res.json(projects)
  } catch (error) {
    console.error('Error getting projects over limit:', error)
    res.status(500).json({ 
      message: 'Failed to get projects over limit',
      error: error.message 
    })
  }
}

/**
 * Get top projects by disk usage
 */
export async function getTopUsageProjects(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10
    const projects = await DiskUsageService.getTopUsageProjects(limit)
    res.json(projects)
  } catch (error) {
    console.error('Error getting top usage projects:', error)
    res.status(500).json({ 
      message: 'Failed to get top usage projects',
      error: error.message 
    })
  }
}

/**
 * Validate disk usage for a specific project
 */
export async function validateProjectDiskUsage(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const projectId = parseInt(req.params.projectId)
    const validation = await DiskUsageService.validateProject(projectId)
    res.json(validation)
  } catch (error) {
    console.error('Error validating project disk usage:', error)
    res.status(500).json({ 
      message: 'Failed to validate project disk usage',
      error: error.message 
    })
  }
}

/**
 * Validate disk usage for all projects
 */
export async function validateAllProjectsDiskUsage(req, res) {
  try {
    const validations = await DiskUsageService.validateAllProjects()
    
    // Separate accurate and inaccurate projects
    const accurate = validations.filter(v => !v.error && v.is_accurate)
    const inaccurate = validations.filter(v => !v.error && !v.is_accurate)
    const errors = validations.filter(v => v.error)

    res.json({
      total_projects: validations.length,
      accurate_count: accurate.length,
      inaccurate_count: inaccurate.length,
      error_count: errors.length,
      accurate_projects: accurate,
      inaccurate_projects: inaccurate,
      error_projects: errors
    })
  } catch (error) {
    console.error('Error validating all projects disk usage:', error)
    res.status(500).json({ 
      message: 'Failed to validate all projects disk usage',
      error: error.message 
    })
  }
}

/**
 * Recalculate disk usage for a specific project
 */
export async function recalculateProjectDiskUsage(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const projectId = parseInt(req.params.projectId)
    const result = await DiskUsageService.recalculateProject(projectId)
    
    if (!result) {
      return res.status(404).json({ message: 'Project not found' })
    }

    res.json(result)
  } catch (error) {
    console.error('Error recalculating project disk usage:', error)
    res.status(500).json({ 
      message: 'Failed to recalculate project disk usage',
      error: error.message 
    })
  }
}

/**
 * Recalculate disk usage for all projects
 */
export async function recalculateAllProjectsDiskUsage(req, res) {
  try {
    const results = await DiskUsageService.recalculateAllProjects()
    
    // Separate successful and failed recalculations
    const successful = results.filter(r => !r.error)
    const failed = results.filter(r => r.error)

    res.json({
      total_projects: results.length,
      successful_count: successful.length,
      failed_count: failed.length,
      successful_projects: successful,
      failed_projects: failed,
      total_size_change: successful.reduce((sum, r) => sum + r.difference, 0)
    })
  } catch (error) {
    console.error('Error recalculating all projects disk usage:', error)
    res.status(500).json({ 
      message: 'Failed to recalculate all projects disk usage',
      error: error.message 
    })
  }
}

/**
 * Update disk usage limit for a project
 */
export async function updateProjectDiskLimit(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const projectId = parseInt(req.params.projectId)
    const { limit } = req.body
    
    let limitBytes
    if (typeof limit === 'string') {
      // Parse human readable format like "5GB"
      limitBytes = DiskUsageService.parseSize(limit)
    } else {
      // Assume it's already in bytes
      limitBytes = parseInt(limit)
    }

    if (limitBytes < 0) {
      return res.status(400).json({ message: 'Disk limit cannot be negative' })
    }

    const result = await DiskUsageService.updateProjectLimit(projectId, limitBytes, req.user)
    res.json(result)
  } catch (error) {
    console.error('Error updating project disk limit:', error)
    res.status(500).json({ 
      message: 'Failed to update project disk limit',
      error: error.message 
    })
  }
}

/**
 * Get disk usage for a specific project
 */
export async function getProjectDiskUsage(req, res) {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const projectId = parseInt(req.params.projectId)
    
    // Get both validation and top-level project info
    const [validation, project] = await Promise.all([
      DiskUsageService.validateProject(projectId),
      DiskUsageService.getTopUsageProjects(1000) // Get all projects to find this one
    ])

    const projectInfo = project.find(p => p.project_id === projectId)
    
    if (!projectInfo) {
      return res.status(404).json({ message: 'Project not found' })
    }

    res.json({
      ...projectInfo,
      validation: validation,
      formatted_usage: DiskUsageService.formatBytes(projectInfo.disk_usage),
      formatted_limit: DiskUsageService.formatBytes(projectInfo.disk_usage_limit)
    })
  } catch (error) {
    console.error('Error getting project disk usage:', error)
    res.status(500).json({ 
      message: 'Failed to get project disk usage',
      error: error.message 
    })
  }
}

// Validation middleware
export const validateProjectId = [
  param('projectId').isInt({ min: 1 }).withMessage('Project ID must be a positive integer')
]

export const validateDiskLimit = [
  body('limit').notEmpty().withMessage('Disk limit is required')
    .custom((value) => {
      if (typeof value === 'string') {
        try {
          DiskUsageService.parseSize(value)
          return true
        } catch (error) {
          throw new Error('Invalid size format. Use format like "5GB", "100MB", etc.')
        }
      } else if (typeof value === 'number') {
        if (value < 0) {
          throw new Error('Disk limit cannot be negative')
        }
        return true
      } else {
        throw new Error('Disk limit must be a number or size string')
      }
    })
]

export const validateTopUsageQuery = [
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000')
]
