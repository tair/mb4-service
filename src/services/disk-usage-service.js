import { models } from '../models/init-models.js'
import DiskUsageTracker from './disk-usage-tracker.js'

/**
 * Disk Usage Service
 * Provides administrative functions for managing project disk usage
 */
export class DiskUsageService {
  /**
   * Validate disk usage for a specific project
   * @param {number} projectId - Project ID to validate
   * @returns {Promise<Object>} Validation results
   */
  static async validateProject(projectId) {
    const result = await DiskUsageTracker.validateAndRecalculate(projectId)
    
    return {
      project_id: result.project_id,
      calculated_usage: result.new_usage,
      stored_usage: result.old_usage,
      discrepancy: result.discrepancy,
      is_accurate: result.discrepancy < 1024, // Allow 1KB tolerance
      calculated_mb: result.new_mb,
      stored_mb: result.old_mb
    }
  }

  /**
   * Validate disk usage for all projects
   * @returns {Promise<Array>} Array of validation results
   */
  static async validateAllProjects() {
    const projects = await models.Project.findAll({
      where: { deleted: 0 },
      attributes: ['project_id', 'name']
    })

    const results = []
    for (const project of projects) {
      try {
        const validation = await this.validateProject(project.project_id)
        results.push({
          ...validation,
          project_name: project.name
        })
      } catch (error) {
        results.push({
          project_id: project.project_id,
          project_name: project.name,
          error: error.message
        })
      }
    }

    return results
  }

  /**
   * Recalculate disk usage for a specific project
   * @param {number} projectId - Project ID to recalculate
   * @returns {Promise<Object>} Recalculation result
   */
  static async recalculateProject(projectId) {
    return await DiskUsageTracker.validateAndRecalculate(projectId)
  }

  /**
   * Recalculate disk usage for all projects
   * @returns {Promise<Array>} Array of recalculation results
   */
  static async recalculateAllProjects() {
    return await DiskUsageTracker.recalculateAllProjects()
  }

  /**
   * Get projects that exceed their disk usage limit
   * @returns {Promise<Array>} Array of projects over limit
   */
  static async getProjectsOverLimit() {
    const projects = await models.Project.findAll({
      where: {
        deleted: 0,
        disk_usage: {
          [models.Sequelize.Op.gt]: models.Sequelize.col('disk_usage_limit')
        }
      },
      attributes: ['project_id', 'name', 'disk_usage', 'disk_usage_limit', 'user_id'],
      include: [{
        model: models.User,
        as: 'User',
        attributes: ['user_id', 'fname', 'lname', 'email']
      }]
    })

    return projects.map(project => ({
      project_id: project.project_id,
      project_name: project.name,
      owner: project.User ? {
        user_id: project.User.user_id,
        name: `${project.User.fname} ${project.User.lname}`,
        email: project.User.email
      } : null,
      disk_usage: project.disk_usage,
      disk_usage_limit: project.disk_usage_limit,
      usage_mb: (project.disk_usage / 1048576).toFixed(2),
      limit_mb: (project.disk_usage_limit / 1048576).toFixed(2),
      over_limit_mb: ((project.disk_usage - project.disk_usage_limit) / 1048576).toFixed(2),
      usage_percentage: ((project.disk_usage / project.disk_usage_limit) * 100).toFixed(1)
    }))
  }

  /**
   * Get disk usage statistics for all projects
   * @returns {Promise<Object>} Usage statistics
   */
  static async getUsageStatistics() {
    const stats = await models.Project.findOne({
      where: { deleted: 0 },
      attributes: [
        [models.Sequelize.fn('COUNT', models.Sequelize.col('project_id')), 'total_projects'],
        [models.Sequelize.fn('SUM', models.Sequelize.col('disk_usage')), 'total_usage'],
        [models.Sequelize.fn('SUM', models.Sequelize.col('disk_usage_limit')), 'total_limit'],
        [models.Sequelize.fn('AVG', models.Sequelize.col('disk_usage')), 'avg_usage'],
        [models.Sequelize.fn('MAX', models.Sequelize.col('disk_usage')), 'max_usage'],
        [models.Sequelize.fn('MIN', models.Sequelize.col('disk_usage')), 'min_usage']
      ],
      raw: true
    })

    const overLimitCount = await models.Project.count({
      where: {
        deleted: 0,
        disk_usage: {
          [models.Sequelize.Op.gt]: models.Sequelize.col('disk_usage_limit')
        }
      }
    })

    return {
      total_projects: parseInt(stats.total_projects) || 0,
      projects_over_limit: overLimitCount,
      total_usage_bytes: parseInt(stats.total_usage) || 0,
      total_limit_bytes: parseInt(stats.total_limit) || 0,
      avg_usage_bytes: parseInt(stats.avg_usage) || 0,
      max_usage_bytes: parseInt(stats.max_usage) || 0,
      min_usage_bytes: parseInt(stats.min_usage) || 0,
      total_usage_gb: ((parseInt(stats.total_usage) || 0) / 1073741824).toFixed(2),
      total_limit_gb: ((parseInt(stats.total_limit) || 0) / 1073741824).toFixed(2),
      avg_usage_mb: ((parseInt(stats.avg_usage) || 0) / 1048576).toFixed(2),
      max_usage_mb: ((parseInt(stats.max_usage) || 0) / 1048576).toFixed(2),
      utilization_percentage: stats.total_limit > 0 
        ? ((parseInt(stats.total_usage) / parseInt(stats.total_limit)) * 100).toFixed(1)
        : '0.0'
    }
  }

  /**
   * Get projects with highest disk usage
   * @param {number} limit - Number of projects to return (default: 10)
   * @returns {Promise<Array>} Array of projects sorted by usage
   */
  static async getTopUsageProjects(limit = 10) {
    const projects = await models.Project.findAll({
      where: { deleted: 0 },
      attributes: ['project_id', 'name', 'disk_usage', 'disk_usage_limit', 'user_id'],
      include: [{
        model: models.User,
        as: 'User',
        attributes: ['user_id', 'fname', 'lname', 'email']
      }],
      order: [['disk_usage', 'DESC']],
      limit: limit
    })

    return projects.map(project => ({
      project_id: project.project_id,
      project_name: project.name,
      owner: project.User ? {
        user_id: project.User.user_id,
        name: `${project.User.fname} ${project.User.lname}`,
        email: project.User.email
      } : null,
      disk_usage: project.disk_usage,
      disk_usage_limit: project.disk_usage_limit,
      usage_mb: (project.disk_usage / 1048576).toFixed(2),
      limit_mb: (project.disk_usage_limit / 1048576).toFixed(2),
      usage_percentage: project.disk_usage_limit > 0 
        ? ((project.disk_usage / project.disk_usage_limit) * 100).toFixed(1)
        : 'N/A'
    }))
  }

  /**
   * Update disk usage limit for a project
   * @param {number} projectId - Project ID
   * @param {number} newLimit - New limit in bytes
   * @param {Object} user - User making the change
   * @returns {Promise<Object>} Update result
   */
  static async updateProjectLimit(projectId, newLimit, user) {
    const project = await models.Project.findByPk(projectId)
    if (!project) {
      throw new Error(`Project ${projectId} not found`)
    }

    const oldLimit = project.disk_usage_limit
    await project.update(
      { disk_usage_limit: newLimit },
      { user: user }
    )

    return {
      project_id: projectId,
      project_name: project.name,
      old_limit: oldLimit,
      new_limit: newLimit,
      old_limit_mb: (oldLimit / 1048576).toFixed(2),
      new_limit_mb: (newLimit / 1048576).toFixed(2),
      current_usage: project.disk_usage,
      current_usage_mb: (project.disk_usage / 1048576).toFixed(2)
    }
  }

  /**
   * Format bytes to human readable format
   * @param {number} bytes - Number of bytes
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted string
   */
  static formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  /**
   * Parse human readable size to bytes
   * @param {string} size - Size string like "5GB", "100MB", etc.
   * @returns {number} Size in bytes
   */
  static parseSize(size) {
    const units = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    }

    const match = size.toString().toUpperCase().match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/)
    if (!match) {
      throw new Error('Invalid size format. Use format like "5GB", "100MB", etc.')
    }

    const [, number, unit] = match
    return Math.floor(parseFloat(number) * units[unit])
  }
}

export default DiskUsageService
