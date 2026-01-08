import { models } from '../models/init-models.js'
import { getRoles } from '../services/user-roles-service.js'
import sequelizeConn from '../util/db.js'
import { Op } from 'sequelize'

// Status constants for curation requests
const REQUEST_STATUS = {
  NEW: 0,
  APPROVED: 1,
  REJECTED: 2,
}

// Request type for institutions
const REQUEST_TYPE_INSTITUTION = 1
const TABLE_NUM_INSTITUTIONS = 93

/**
 * Get all institution curation requests with filtering options
 * Available to admin and curator roles
 * GET /curation-requests/institutions
 */
export async function listInstitutionRequests(req, res) {
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
    const whereConditions = {
      request_type: REQUEST_TYPE_INSTITUTION,
      table_num: TABLE_NUM_INSTITUTIONS,
    }
    
    if (status !== undefined && status !== '') {
      whereConditions.status = parseInt(status)
    }

    // Get requests with user and institution information
    const requests = await models.CurationRequest.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: models.User,
          as: 'User',
          attributes: ['user_id', 'fname', 'lname', 'email'],
          required: false
        }
      ],
      order: [['created_on', 'DESC']],
      limit: parseInt(limit),
      offset: offset
    })

    // Fetch institution details for each request
    const requestsWithInstitutions = await Promise.all(
      requests.rows.map(async (request) => {
        const institution = await models.Institution.findByPk(request.row_id)
        const statusLabels = {
          0: 'New',
          1: 'Approved',
          2: 'Rejected'
        }
        
        return {
          ...request.toJSON(),
          institution: institution ? institution.toJSON() : null,
          statusLabel: statusLabels[request.status] || 'Unknown',
          createdOnFormatted: new Date(request.created_on * 1000).toISOString(),
          completedOnFormatted: request.completed_on 
            ? new Date(request.completed_on * 1000).toISOString() 
            : null
        }
      })
    )

    res.json({
      success: true,
      data: {
        requests: requestsWithInstitutions,
        pagination: {
          total: requests.count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(requests.count / limit)
        }
      }
    })
  } catch (error) {
    console.error('Error listing institution requests:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch institution requests'
    })
  }
}

/**
 * Get a specific institution request by ID
 * GET /curation-requests/institutions/:requestId
 */
export async function getInstitutionRequest(req, res) {
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
    
    const request = await models.CurationRequest.findOne({
      where: {
        request_id: requestId,
        request_type: REQUEST_TYPE_INSTITUTION,
        table_num: TABLE_NUM_INSTITUTIONS,
      },
      include: [
        {
          model: models.User,
          as: 'User',
          attributes: ['user_id', 'fname', 'lname', 'email'],
          required: false
        }
      ]
    })

    if (!request) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Institution request not found'
      })
    }

    // Fetch the institution
    const institution = await models.Institution.findByPk(request.row_id)

    const statusLabels = {
      0: 'New',
      1: 'Approved',
      2: 'Rejected'
    }

    const requestData = {
      ...request.toJSON(),
      institution: institution ? institution.toJSON() : null,
      statusLabel: statusLabels[request.status] || 'Unknown',
      createdOnFormatted: new Date(request.created_on * 1000).toISOString(),
      completedOnFormatted: request.completed_on 
        ? new Date(request.completed_on * 1000).toISOString() 
        : null
    }

    res.json({
      success: true,
      data: requestData
    })
  } catch (error) {
    console.error('Error fetching institution request:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch institution request'
    })
  }
}

/**
 * Update an institution request (approve, reject, or modify)
 * PUT /curation-requests/institutions/:requestId
 */
export async function updateInstitutionRequest(req, res) {
  const transaction = await sequelizeConn.transaction()
  
  try {
    const userRoles = await getRoles(req.user?.user_id)
    const hasAccess = userRoles.includes('admin') || userRoles.includes('curator')
    
    if (!hasAccess) {
      await transaction.rollback()
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin or curator role required'
      })
    }

    const requestId = parseInt(req.params.requestId)
    const { status, institutionName } = req.body

    // Validate status
    const validStatuses = [REQUEST_STATUS.NEW, REQUEST_STATUS.APPROVED, REQUEST_STATUS.REJECTED]
    if (status !== undefined && !validStatuses.includes(parseInt(status))) {
      await transaction.rollback()
      return res.status(400).json({
        error: 'Invalid status',
        message: 'Status must be one of: 0 (New), 1 (Approved), 2 (Rejected)'
      })
    }

    const request = await models.CurationRequest.findOne({
      where: {
        request_id: requestId,
        request_type: REQUEST_TYPE_INSTITUTION,
        table_num: TABLE_NUM_INSTITUTIONS,
      },
      include: [
        {
          model: models.User,
          as: 'User',
          attributes: ['user_id', 'fname', 'lname', 'email']
        }
      ],
      transaction
    })

    if (!request) {
      await transaction.rollback()
      return res.status(404).json({
        error: 'Not found',
        message: 'Institution request not found'
      })
    }

    // Prevent changing from approved to rejected (per spec)
    const oldStatus = request.status
    const newStatus = status !== undefined ? parseInt(status) : oldStatus

    if (oldStatus === REQUEST_STATUS.APPROVED && newStatus === REQUEST_STATUS.REJECTED) {
      await transaction.rollback()
      return res.status(400).json({
        error: 'Invalid status change',
        message: 'Once an institution is approved, it cannot be changed to rejected'
      })
    }

    // Fetch and update the institution
    const institution = await models.Institution.findByPk(request.row_id, { transaction })
    
    if (!institution) {
      await transaction.rollback()
      return res.status(404).json({
        error: 'Not found',
        message: 'Associated institution not found'
      })
    }

    // Update institution name if provided
    if (institutionName && institutionName.trim() !== institution.name) {
      const trimmedName = institutionName.trim()
      
      // Check for duplicate name
      const existingInstitution = await models.Institution.findOne({
        where: { 
          name: trimmedName,
          institution_id: { [Op.ne]: institution.institution_id }
        },
        transaction
      })
      
      if (existingInstitution) {
        await transaction.rollback()
        return res.status(409).json({
          error: 'Duplicate name',
          message: 'An institution with this name already exists'
        })
      }
      
      institution.name = trimmedName
    }

    // Update institution active status based on approval
    if (newStatus === REQUEST_STATUS.APPROVED) {
      institution.active = true
    }

    await institution.save({ transaction, user: req.user })

    // Update the curation request
    if (newStatus !== oldStatus) {
      request.status = newStatus
      request.completed_on = Math.floor(Date.now() / 1000)
    }

    await request.update({ 
      status: newStatus,
      completed_on: newStatus !== oldStatus ? Math.floor(Date.now() / 1000) : request.completed_on
    }, { transaction, user: req.user })

    await transaction.commit()

    const statusLabels = {
      0: 'New',
      1: 'Approved',
      2: 'Rejected'
    }

    res.json({
      success: true,
      message: 'Institution request updated successfully',
      data: {
        ...request.toJSON(),
        institution: institution.toJSON(),
        statusLabel: statusLabels[newStatus] || 'Unknown'
      }
    })

  } catch (error) {
    await transaction.rollback()
    console.error('Error updating institution request:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update institution request'
    })
  }
}

/**
 * Delete an institution request
 * DELETE /curation-requests/institutions/:requestId
 */
export async function deleteInstitutionRequest(req, res) {
  const transaction = await sequelizeConn.transaction()
  
  try {
    const userRoles = await getRoles(req.user?.user_id)
    const hasAccess = userRoles.includes('admin') || userRoles.includes('curator')
    
    if (!hasAccess) {
      await transaction.rollback()
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin or curator role required'
      })
    }

    const requestId = parseInt(req.params.requestId)
    const { deleteInstitution = false, remapToId } = req.body
    
    const request = await models.CurationRequest.findOne({
      where: {
        request_id: requestId,
        request_type: REQUEST_TYPE_INSTITUTION,
        table_num: TABLE_NUM_INSTITUTIONS,
      },
      transaction
    })
    
    if (!request) {
      await transaction.rollback()
      return res.status(404).json({
        error: 'Not found',
        message: 'Institution request not found'
      })
    }

    // If request is approved and we're not deleting the institution, only delete the request
    if (request.status === REQUEST_STATUS.APPROVED && !deleteInstitution) {
      await request.destroy({ transaction, user: req.user })
      await transaction.commit()
      
      return res.json({
        success: true,
        message: 'Institution request deleted successfully (institution remains active)'
      })
    }

    // If we need to delete the institution too
    if (deleteInstitution) {
      const institution = await models.Institution.findByPk(request.row_id, { transaction })
      
      if (institution) {
        // Check for references
        const usageCount = await getInstitutionUsageCount(institution.institution_id, transaction)
        
        if (usageCount.total > 0) {
          if (!remapToId) {
            await transaction.rollback()
            return res.status(400).json({
              error: 'References exist',
              message: 'Institution has references and must be remapped before deletion',
              usageCount
            })
          }
          
          // Remap references
          await remapInstitutionReferences(institution.institution_id, remapToId, transaction, req.user)
        }
        
        await institution.destroy({ transaction, individualHooks: true, user: req.user })
      }
    }

    await request.destroy({ transaction, user: req.user })
    await transaction.commit()

    res.json({
      success: true,
      message: 'Institution request and institution deleted successfully'
    })
  } catch (error) {
    await transaction.rollback()
    console.error('Error deleting institution request:', error)
    res.status(500).json({
      error: 'Internal server error', 
      message: 'Failed to delete institution request'
    })
  }
}

/**
 * Get institution request statistics for dashboard
 * GET /curation-requests/institutions/stats
 */
export async function getInstitutionRequestStats(req, res) {
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
    const stats = await models.CurationRequest.findAll({
      attributes: [
        'status',
        [sequelizeConn.fn('COUNT', sequelizeConn.col('status')), 'count']
      ],
      where: {
        request_type: REQUEST_TYPE_INSTITUTION,
        table_num: TABLE_NUM_INSTITUTIONS,
      },
      group: ['status']
    })

    const statusCounts = {
      new: 0,
      approved: 0, 
      rejected: 0,
      total: 0
    }

    stats.forEach(stat => {
      const count = parseInt(stat.get('count'))
      statusCounts.total += count
      
      switch (stat.status) {
        case REQUEST_STATUS.NEW:
          statusCounts.new = count
          break
        case REQUEST_STATUS.APPROVED:
          statusCounts.approved = count
          break
        case REQUEST_STATUS.REJECTED:
          statusCounts.rejected = count
          break
      }
    })

    // Get recent requests
    const recentRequests = await models.CurationRequest.findAll({
      where: {
        request_type: REQUEST_TYPE_INSTITUTION,
        table_num: TABLE_NUM_INSTITUTIONS,
      },
      include: [
        {
          model: models.User,
          as: 'User',
          attributes: ['fname', 'lname', 'email']
        }
      ],
      order: [['created_on', 'DESC']],
      limit: parseInt(limit)
    })

    const statusLabels = {
      0: 'New',
      1: 'Approved',
      2: 'Rejected'
    }

    // Fetch institution details for each request
    const recentRequestsFormatted = await Promise.all(
      recentRequests.map(async (request) => {
        const institution = await models.Institution.findByPk(request.row_id)
        return {
          ...request.toJSON(),
          institution: institution ? { 
            institution_id: institution.institution_id, 
            name: institution.name,
            active: institution.active
          } : null,
          statusLabel: statusLabels[request.status],
          createdOnFormatted: new Date(request.created_on * 1000).toISOString()
        }
      })
    )

    res.json({
      success: true,
      data: {
        counts: statusCounts,
        recent_requests: recentRequestsFormatted
      }
    })
  } catch (error) {
    console.error('Error fetching institution request stats:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch institution request statistics'
    })
  }
}

/**
 * Helper function to get institution usage count
 */
async function getInstitutionUsageCount(institutionId, transaction) {
  const userCount = await models.InstitutionsXUser.count({
    where: { institution_id: institutionId },
    transaction
  })
  
  const projectCount = await models.InstitutionsXProject.count({
    where: { institution_id: institutionId },
    transaction
  })
  
  return {
    users: userCount,
    projects: projectCount,
    total: userCount + projectCount
  }
}

/**
 * Helper function to remap institution references
 */
async function remapInstitutionReferences(fromId, toId, transaction, user) {
  // Update user affiliations
  await models.InstitutionsXUser.update(
    { institution_id: toId },
    { 
      where: { institution_id: fromId },
      transaction,
      user
    }
  )
  
  // Update project affiliations
  await models.InstitutionsXProject.update(
    { institution_id: toId },
    { 
      where: { institution_id: fromId },
      transaction,
      user
    }
  )
}

