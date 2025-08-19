import { models } from '../models/init-models.js'
import { getRoles } from '../services/user-roles-service.js'
import { EmailManager } from '../lib/email-manager.js'
import sequelizeConn from '../util/db.js'
import { Op } from 'sequelize'

/**
 * Get all duplication requests with filtering options
 * Available to admin and curator roles
 * GET /duplication-requests
 */
export async function listDuplicationRequests(req, res) {
  try {
    // Check if user has admin or curator access
    const userRoles = await getRoles(req.user?.user_id)
    const hasAccess = userRoles.includes('admin') || userRoles.includes('curator')
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin or curator role required'
      })
    }

    const { status, page = 1, limit = 20 } = req.query
    const offset = (page - 1) * limit

    // Build where conditions
    const whereConditions = {}
    if (status) {
      whereConditions.status = parseInt(status)
    }

    // Get requests with user and project information
    const requests = await models.ProjectDuplicationRequest.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: models.User,
          as: 'User',
          attributes: ['user_id', 'fname', 'lname', 'email'],
          required: true
        },
        {
          model: models.Project,
          as: 'Project',
          attributes: ['project_id', 'name', 'published'],
          required: true
        }
      ],
      order: [['created_on', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    })

    // Add status labels for frontend
    const requestsWithLabels = requests.rows.map(request => {
      const statusLabels = {
        1: 'Newly Submitted',
        50: 'Approved',
        100: 'Completed',
        200: 'Denied'
      }
      
      return {
        ...request.toJSON(),
        statusLabel: statusLabels[request.status] || 'Unknown',
        createdOnFormatted: new Date(request.created_on * 1000).toISOString()
      }
    })

    res.json({
      success: true,
      data: {
        requests: requestsWithLabels,
        pagination: {
          total: requests.count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(requests.count / limit)
        }
      }
    })
  } catch (error) {
    console.error('Error listing duplication requests:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch duplication requests'
    })
  }
}

/**
 * Get a specific duplication request by ID
 * GET /duplication-requests/:requestId
 */
export async function getDuplicationRequest(req, res) {
  try {
    const userRoles = await getRoles(req.user?.user_id)
    const hasAccess = userRoles.includes('admin') || userRoles.includes('curator')
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin or curator role required'
      })
    }

    const requestId = parseInt(req.params.requestId)
    
    const request = await models.ProjectDuplicationRequest.findByPk(requestId, {
      include: [
        {
          model: models.User,
          as: 'User',
          attributes: ['user_id', 'fname', 'lname', 'email'],
          required: true
        },
        {
          model: models.Project,
          as: 'Project',
          attributes: ['project_id', 'name', 'published', 'created_on', 'user_id'],
          required: true,
          include: [
            {
              model: models.User,
              as: 'User',
              attributes: ['fname', 'lname', 'email']
            }
          ]
        }
      ]
    })

    if (!request) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Duplication request not found'
      })
    }

    const statusLabels = {
      1: 'Newly Submitted',
      50: 'Approved',
      100: 'Completed',
      200: 'Denied'
    }

    const requestData = {
      ...request.toJSON(),
      statusLabel: statusLabels[request.status] || 'Unknown',
      createdOnFormatted: new Date(request.created_on * 1000).toISOString()
    }

    res.json({
      success: true,
      data: requestData
    })
  } catch (error) {
    console.error('Error fetching duplication request:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch duplication request'
    })
  }
}

/**
 * Update a duplication request (approve, deny, or modify)
 * PUT /duplication-requests/:requestId
 */
export async function updateDuplicationRequest(req, res) {
  const transaction = await sequelizeConn.transaction()
  
  try {
    const userRoles = await getRoles(req.user?.user_id)
    const hasAccess = userRoles.includes('admin') || userRoles.includes('curator')
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin or curator role required'
      })
    }

    const requestId = parseInt(req.params.requestId)
    const { status, notes } = req.body

    // Validate status
    const validStatuses = [1, 50, 100, 200]
    if (status && !validStatuses.includes(parseInt(status))) {
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Status must be one of: 1 (Submitted), 50 (Approved), 100 (Completed), 200 (Denied)'
      })
    }

    const request = await models.ProjectDuplicationRequest.findByPk(requestId, {
      include: [
        {
          model: models.User,
          as: 'User',
          attributes: ['user_id', 'fname', 'lname', 'email']
        },
        {
          model: models.Project,
          as: 'Project',
          attributes: ['project_id', 'name']
        }
      ],
      transaction
    })

    if (!request) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Duplication request not found'
      })
    }

    const oldStatus = request.status
    const newStatus = parseInt(status) || oldStatus

    // Validation for denial - notes are required
    if (newStatus === 200 && oldStatus !== 200) {
      if (!notes || notes.trim().length === 0) {
        return res.status(400).json({
          error: 'Notes required',
          message: 'Notes field is required when denying a request'
        })
      }
    }

    // Update the request
    const updateData = {}
    if (status) updateData.status = newStatus
    if (notes !== undefined) updateData.notes = notes

    await request.update(updateData, { transaction, user: req.user })

    // Handle status change side effects
    if (newStatus !== oldStatus) {
      if (newStatus === 200 && oldStatus !== 200) {
        // Status changed to Denied - send denial email
        try {
          const emailManager = new EmailManager()
          const requesterName = `${request.User.fname || ''} ${request.User.lname || ''}`.trim() || request.User.email
          
          await emailManager.email('project_duplication_request_denied', {
            name: requesterName,
            to: request.User.email,
            projectId: request.project_id,
            projectName: request.Project.name,
            reason: notes || 'No additional notes provided'
          })
        } catch (emailError) {
          console.error('Failed to send denial email:', emailError)
          // Don't fail the request update if email fails
        }
      } else if (newStatus === 50 && oldStatus !== 50) {
        // Status changed to Approved - queue duplication task
        await models.TaskQueue.create({
          user_id: request.user_id,
          priority: 500,
          entity_key: null,
          row_key: null,
          handler: 'ProjectDuplication',
          parameters: {
            request_id: requestId
          }
        }, { transaction, user: req.user })
      }
    }

    await transaction.commit()

    const statusLabels = {
      1: 'Newly Submitted',
      50: 'Approved',
      100: 'Completed', 
      200: 'Denied'
    }

    res.json({
      success: true,
      message: 'Duplication request updated successfully',
      data: {
        ...request.toJSON(),
        statusLabel: statusLabels[newStatus] || 'Unknown'
      }
    })

  } catch (error) {
    await transaction.rollback()
    console.error('Error updating duplication request:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update duplication request'
    })
  }
}

/**
 * Delete a duplication request
 * DELETE /duplication-requests/:requestId
 */
export async function deleteDuplicationRequest(req, res) {
  try {
    const userRoles = await getRoles(req.user?.user_id)
    const hasAccess = userRoles.includes('admin') || userRoles.includes('curator')
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin or curator role required'
      })
    }

    const requestId = parseInt(req.params.requestId)
    
    const request = await models.ProjectDuplicationRequest.findByPk(requestId)
    
    if (!request) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Duplication request not found'
      })
    }

    // Only allow deletion of requests that are not completed or being processed
    if (request.status === 50) {
      return res.status(400).json({
        error: 'Cannot delete',
        message: 'Cannot delete approved requests that may be processing'
      })
    }

    await request.destroy()

    res.json({
      success: true,
      message: 'Duplication request deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting duplication request:', error)
    res.status(500).json({
      error: 'Internal server error', 
      message: 'Failed to delete duplication request'
    })
  }
}

/**
 * Get duplication request statistics for dashboard
 * GET /duplication-requests/stats
 */
export async function getDuplicationRequestStats(req, res) {
  try {
    const userRoles = await getRoles(req.user?.user_id)
    const hasAccess = userRoles.includes('admin') || userRoles.includes('curator')
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin or curator role required'
      })
    }

    // Get limit parameter from query, default to 5
    const { limit = 5 } = req.query

    // Get counts by status
    const stats = await models.ProjectDuplicationRequest.findAll({
      attributes: [
        'status',
        [sequelizeConn.fn('COUNT', sequelizeConn.col('status')), 'count']
      ],
      group: ['status']
    })

    const statusCounts = {
      newly_submitted: 0,
      approved: 0, 
      completed: 0,
      denied: 0,
      total: 0
    }

    stats.forEach(stat => {
      const count = parseInt(stat.get('count'))
      statusCounts.total += count
      
      switch (stat.status) {
        case 1:
          statusCounts.newly_submitted = count
          break
        case 50:
          statusCounts.approved = count
          break
        case 100:
          statusCounts.completed = count
          break
        case 200:
          statusCounts.denied = count
          break
      }
    })

    // Get recent requests
    const recentRequests = await models.ProjectDuplicationRequest.findAll({
      include: [
        {
          model: models.User,
          as: 'User',
          attributes: ['fname', 'lname', 'email']
        },
        {
          model: models.Project,
          as: 'Project',
          attributes: ['project_id', 'name']
        }
      ],
      order: [['created_on', 'DESC']],
      limit: parseInt(limit)
    })

    const statusLabels = {
      1: 'Newly Submitted',
      50: 'Approved',
      100: 'Completed',
      200: 'Denied'
    }

    const recentRequestsFormatted = recentRequests.map(request => ({
      ...request.toJSON(),
      statusLabel: statusLabels[request.status],
      createdOnFormatted: new Date(request.created_on * 1000).toISOString()
    }))

    res.json({
      success: true,
      data: {
        counts: statusCounts,
        recent_requests: recentRequestsFormatted
      }
    })
  } catch (error) {
    console.error('Error fetching duplication request stats:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch duplication request statistics'
    })
  }
}
