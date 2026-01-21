import * as adminStatisticsService from '../services/admin-statistics-service.js'
import { parseDateRange } from '../util/date-parser.js'

/**
 * Admin Statistics Controller
 * 
 * Provides administrative endpoints for site and project statistics.
 * All endpoints require admin authentication.
 */

/**
 * Get site statistics with optional date range
 * GET /admin/statistics/site
 * 
 * Query params:
 *   - daterange: natural language date range (e.g., "today", "last week")
 *   - start: Unix timestamp for custom range start
 *   - end: Unix timestamp for custom range end
 * 
 * If start and end are provided, they override daterange for custom date selection.
 */
export async function getSiteStatistics(req, res) {
  try {
    const { daterange, start, end } = req.query
    
    let startTimestamp, endTimestamp, displayText
    
    // Check if custom timestamps are provided directly
    if (start && end) {
      startTimestamp = parseInt(start)
      endTimestamp = parseInt(end)
      displayText = 'Custom Range'
      
      // Validate custom range doesn't exceed 1 year (366 days)
      const maxRangeSeconds = 366 * 24 * 60 * 60
      if ((endTimestamp - startTimestamp) > maxRangeSeconds) {
        return res.status(400).json({
          success: false,
          message: 'Custom date range cannot exceed 1 year (366 days)'
        })
      }
    } else {
      // Parse natural language date range (defaults to "today")
      const dateRange = parseDateRange(daterange || 'today')
      startTimestamp = dateRange.start
      endTimestamp = dateRange.end
      displayText = dateRange.displayText
    }
    
    // Fetch all statistics in parallel
    const [
      totals,
      dateRangeTotals,
      memberProjectStats,
      loginSessionStats,
      downloadStats,
      uploadStats
    ] = await Promise.all([
      adminStatisticsService.getSiteTotals(),
      adminStatisticsService.getDateRangeStats(startTimestamp, endTimestamp),
      adminStatisticsService.getMemberProjectStats(startTimestamp, endTimestamp),
      adminStatisticsService.getLoginSessionStats(startTimestamp, endTimestamp),
      adminStatisticsService.getDownloadStats(startTimestamp, endTimestamp),
      adminStatisticsService.getUploadStats(startTimestamp, endTimestamp)
    ])
    
    res.status(200).json({
      success: true,
      data: {
        totals,
        dateRangeTotals,
        memberProjectStats,
        loginSessionStats,
        downloadStats,
        uploadStats,
        dateRange: {
          start: startTimestamp,
          end: endTimestamp,
          displayText
        }
      }
    })
  } catch (error) {
    console.error('Error fetching site statistics:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching site statistics',
      error: error.message
    })
  }
}

/**
 * Get all-time site totals only
 * GET /admin/statistics/site/totals
 */
export async function getSiteTotals(req, res) {
  try {
    const totals = await adminStatisticsService.getSiteTotals()
    
    res.status(200).json({
      success: true,
      data: totals
    })
  } catch (error) {
    console.error('Error fetching site totals:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching site totals',
      error: error.message
    })
  }
}

/**
 * Get all date range statistics at once for client-side caching
 * GET /admin/statistics/site/all-ranges
 */
export async function getAllDateRangeStats(req, res) {
  try {
    const [totals, allRangeStats] = await Promise.all([
      adminStatisticsService.getSiteTotals(),
      adminStatisticsService.getAllDateRangeStats()
    ])
    
    res.status(200).json({
      success: true,
      data: {
        totals,
        dateRanges: allRangeStats
      }
    })
  } catch (error) {
    console.error('Error fetching all date range stats:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching date range statistics',
      error: error.message
    })
  }
}

/**
 * Get detailed login information
 * GET /admin/statistics/site/login-info
 */
export async function getLoginInfo(req, res) {
  try {
    const { daterange } = req.query
    const dateRange = parseDateRange(daterange || 'today')
    
    const loginInfo = await adminStatisticsService.getLoginInfo(dateRange.start, dateRange.end)
    
    res.status(200).json({
      success: true,
      data: loginInfo
    })
  } catch (error) {
    console.error('Error fetching login info:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching login information',
      error: error.message
    })
  }
}

/**
 * Get detailed download information
 * GET /admin/statistics/site/download-info
 */
export async function getDownloadInfo(req, res) {
  try {
    const { daterange, download_type } = req.query
    const dateRange = parseDateRange(daterange || 'today')
    
    const downloadInfo = await adminStatisticsService.getDownloadInfo(
      dateRange.start,
      dateRange.end,
      download_type || null
    )
    
    res.status(200).json({
      success: true,
      data: downloadInfo
    })
  } catch (error) {
    console.error('Error fetching download info:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching download information',
      error: error.message
    })
  }
}

/**
 * Get detailed upload information
 * GET /admin/statistics/site/upload-info
 * 
 * Query params:
 *   - daterange: natural language date range
 *   - start: Unix timestamp for custom range start
 *   - end: Unix timestamp for custom range end
 *   - upload_type: optional filter by upload type
 */
export async function getUploadInfo(req, res) {
  try {
    const { daterange, start, end, upload_type } = req.query
    
    let startTimestamp, endTimestamp
    
    if (start && end) {
      startTimestamp = parseInt(start)
      endTimestamp = parseInt(end)
    } else {
      const dateRange = parseDateRange(daterange || 'today')
      startTimestamp = dateRange.start
      endTimestamp = dateRange.end
    }
    
    const uploadInfo = await adminStatisticsService.getUploadInfo(
      startTimestamp,
      endTimestamp,
      upload_type || null
    )
    
    res.status(200).json({
      success: true,
      data: uploadInfo
    })
  } catch (error) {
    console.error('Error fetching upload info:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching upload information',
      error: error.message
    })
  }
}

/**
 * Get registration information
 * GET /admin/statistics/site/registration-info
 * 
 * Query params:
 *   - daterange: natural language date range
 *   - start: Unix timestamp for custom range start
 *   - end: Unix timestamp for custom range end
 */
export async function getRegistrationInfo(req, res) {
  try {
    const { daterange, start, end } = req.query
    
    let startTimestamp, endTimestamp
    
    if (start && end) {
      startTimestamp = parseInt(start)
      endTimestamp = parseInt(end)
    } else {
      const dateRange = parseDateRange(daterange || 'today')
      startTimestamp = dateRange.start
      endTimestamp = dateRange.end
    }
    
    const registrationInfo = await adminStatisticsService.getRegistrationInfo(
      startTimestamp,
      endTimestamp
    )
    
    res.status(200).json({
      success: true,
      data: registrationInfo
    })
  } catch (error) {
    console.error('Error fetching registration info:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching registration information',
      error: error.message
    })
  }
}

/**
 * Get project publication information
 * GET /admin/statistics/site/project-pub-info
 * 
 * Query params:
 *   - daterange: natural language date range
 *   - start: Unix timestamp for custom range start
 *   - end: Unix timestamp for custom range end
 */
export async function getProjectPubInfo(req, res) {
  try {
    const { daterange, start, end } = req.query
    
    let startTimestamp, endTimestamp
    
    if (start && end) {
      startTimestamp = parseInt(start)
      endTimestamp = parseInt(end)
    } else {
      const dateRange = parseDateRange(daterange || 'today')
      startTimestamp = dateRange.start
      endTimestamp = dateRange.end
    }
    
    const projectPubInfo = await adminStatisticsService.getProjectPubInfo(
      startTimestamp,
      endTimestamp
    )
    
    res.status(200).json({
      success: true,
      data: projectPubInfo
    })
  } catch (error) {
    console.error('Error fetching project publication info:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching project publication information',
      error: error.message
    })
  }
}

/**
 * Get location information
 * GET /admin/statistics/site/location-info
 */
export async function getLocationInfo(req, res) {
  try {
    const { daterange } = req.query
    const dateRange = parseDateRange(daterange || 'today')
    
    const locationInfo = await adminStatisticsService.getLocationInfo(
      dateRange.start,
      dateRange.end
    )
    
    res.status(200).json({
      success: true,
      data: locationInfo
    })
  } catch (error) {
    console.error('Error fetching location info:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching location information',
      error: error.message
    })
  }
}

/**
 * Get project statistics with pagination
 * GET /admin/statistics/projects
 * Query params:
 *   - page: page number (default 1)
 *   - limit: items per page (default 50, max 100)
 *   - sort: sort field (default 'project_id')
 *   - order: sort order 'asc' or 'desc' (default 'desc')
 *   - search: search term for project name
 */
export async function getProjectStatistics(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50))
    const sort = req.query.sort || 'project_id'
    const order = req.query.order === 'asc' ? 'ASC' : 'DESC'
    const search = req.query.search || ''
    
    const offset = (page - 1) * limit
    
    const [totals, projectsResult] = await Promise.all([
      adminStatisticsService.getProjectStatsTotals(),
      adminStatisticsService.getProjectsListPaginated({ limit, offset, sort, order, search })
    ])
    
    res.status(200).json({
      success: true,
      data: {
        totals,
        projects: projectsResult.projects,
        pagination: {
          page,
          limit,
          totalItems: projectsResult.totalCount,
          totalPages: Math.ceil(projectsResult.totalCount / limit)
        }
      }
    })
  } catch (error) {
    console.error('Error fetching project statistics:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching project statistics',
      error: error.message
    })
  }
}

/**
 * Get detailed statistics for a single project
 * GET /admin/statistics/projects/:projectId
 */
export async function getProjectDetailedStats(req, res) {
  try {
    const projectId = parseInt(req.params.projectId)
    
    if (!projectId || isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID'
      })
    }
    
    const stats = await adminStatisticsService.getProjectDetailedStats(projectId)
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      })
    }
    
    res.status(200).json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('Error fetching project detailed stats:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching project detailed statistics',
      error: error.message
    })
  }
}

