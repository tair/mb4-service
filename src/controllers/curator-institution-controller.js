import { models } from '../models/init-models.js'
import { getRoles } from '../services/user-roles-service.js'
import sequelizeConn from '../util/db.js'
import { Op, Sequelize } from 'sequelize'

/**
 * List all institutions (for curator management)
 * GET /curator/institutions
 */
export async function listInstitutions(req, res) {
  try {
    const userRoles = await getRoles(req.user?.user_id)
    const hasAccess = userRoles.includes('admin') || userRoles.includes('curator')
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin or curator role required'
      })
    }

    const { page = 1, limit = 50, search, active } = req.query
    const offset = (page - 1) * limit

    // Build where conditions
    const whereConditions = {}
    
    if (search) {
      whereConditions.name = { [Op.like]: `%${search}%` }
    }
    
    if (active !== undefined && active !== '') {
      // Handle boolean strings from query params
      if (active === 'true' || active === '1') {
        whereConditions.active = 1
      } else if (active === 'false' || active === '0') {
        whereConditions.active = 0
      } else {
        whereConditions.active = parseInt(active)
      }
    }

    const institutions = await models.Institution.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: models.User,
          as: 'creator',
          attributes: ['user_id', 'fname', 'lname', 'email'],
          required: false
        }
      ],
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset: offset
    })

    // Add usage count for each institution
    const institutionsWithUsage = await Promise.all(
      institutions.rows.map(async (institution) => {
        const usageCount = await getInstitutionUsageCount(institution.institution_id)
        return {
          ...institution.toJSON(),
          usageCount
        }
      })
    )

    res.json({
      success: true,
      data: {
        institutions: institutionsWithUsage,
        pagination: {
          total: institutions.count,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(institutions.count / limit)
        }
      }
    })
  } catch (error) {
    console.error('Error listing institutions:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch institutions'
    })
  }
}

/**
 * Get a specific institution with usage details
 * GET /curator/institutions/:id
 */
export async function getInstitution(req, res) {
  try {
    const userRoles = await getRoles(req.user?.user_id)
    const hasAccess = userRoles.includes('admin') || userRoles.includes('curator')
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin or curator role required'
      })
    }

    const institutionId = parseInt(req.params.id)
    
    const institution = await models.Institution.findByPk(institutionId, {
      include: [
        {
          model: models.User,
          as: 'creator',
          attributes: ['user_id', 'fname', 'lname', 'email'],
          required: false
        }
      ]
    })

    if (!institution) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Institution not found'
      })
    }

    const usageCount = await getInstitutionUsageCount(institutionId)
    
    // Get affiliated users
    const affiliatedUsers = await models.InstitutionsXUser.findAll({
      where: { institution_id: institutionId },
      include: [
        {
          model: models.User,
          as: 'user',
          attributes: ['user_id', 'fname', 'lname', 'email']
        }
      ],
      limit: 50
    })
    
    // Get affiliated projects
    const affiliatedProjects = await models.InstitutionsXProject.findAll({
      where: { institution_id: institutionId },
      include: [
        {
          model: models.Project,
          as: 'projects',
          attributes: ['project_id', 'name', 'published']
        }
      ],
      limit: 50
    })

    res.json({
      success: true,
      data: {
        ...institution.toJSON(),
        usageCount,
        affiliatedUsers: affiliatedUsers.map(u => u.user),
        affiliatedProjects: affiliatedProjects.map(p => p.projects)
      }
    })
  } catch (error) {
    console.error('Error fetching institution:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch institution'
    })
  }
}

/**
 * Update an institution (name, active status)
 * PUT /curator/institutions/:id
 */
export async function updateInstitution(req, res) {
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

    const institutionId = parseInt(req.params.id)
    const { name, active } = req.body

    const institution = await models.Institution.findByPk(institutionId, { transaction })

    if (!institution) {
      await transaction.rollback()
      return res.status(404).json({
        error: 'Not found',
        message: 'Institution not found'
      })
    }

    // Update name if provided
    if (name && name.trim() !== institution.name) {
      const trimmedName = name.trim()
      
      if (trimmedName.length > 100) {
        await transaction.rollback()
        return res.status(400).json({
          error: 'Invalid name',
          message: 'Institution name must be 100 characters or less'
        })
      }
      
      // Check for duplicate name
      const existingInstitution = await models.Institution.findOne({
        where: { 
          name: trimmedName,
          institution_id: { [Op.ne]: institutionId }
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

    // Update active status if provided
    if (active !== undefined) {
      institution.active = active ? 1 : 0
    }

    await institution.save({ transaction, user: req.user })
    await transaction.commit()

    res.json({
      success: true,
      message: 'Institution updated successfully',
      data: institution.toJSON()
    })
  } catch (error) {
    await transaction.rollback()
    console.error('Error updating institution:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update institution'
    })
  }
}

/**
 * Delete an institution (with optional remapping)
 * DELETE /curator/institutions/:id
 */
export async function deleteInstitution(req, res) {
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

    const institutionId = parseInt(req.params.id)
    const { remapToId } = req.body

    const institution = await models.Institution.findByPk(institutionId, { transaction })

    if (!institution) {
      await transaction.rollback()
      return res.status(404).json({
        error: 'Not found',
        message: 'Institution not found'
      })
    }

    // Check for references
    const usageCount = await getInstitutionUsageCount(institutionId, transaction)
    
    if (usageCount.total > 0) {
      if (!remapToId) {
        await transaction.rollback()
        return res.status(400).json({
          error: 'References exist',
          message: 'Institution has references and must be remapped before deletion',
          usageCount
        })
      }
      
      // Verify target institution exists
      const targetInstitution = await models.Institution.findByPk(remapToId, { transaction })
      if (!targetInstitution) {
        await transaction.rollback()
        return res.status(404).json({
          error: 'Target not found',
          message: 'Target institution for remapping not found'
        })
      }
      
      // Remap references
      await remapInstitutionReferences(institutionId, remapToId, transaction, req.user)
    }

    // Delete any associated curation requests
    await models.CurationRequest.destroy({
      where: {
        table_num: 93,
        row_id: institutionId
      },
      transaction,
      user: req.user
    })

    await institution.destroy({ transaction, individualHooks: true, user: req.user })
    await transaction.commit()

    res.json({
      success: true,
      message: 'Institution deleted successfully'
    })
  } catch (error) {
    await transaction.rollback()
    console.error('Error deleting institution:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete institution'
    })
  }
}

/**
 * Get institution usage count (for checking before deletion)
 * GET /curator/institutions/:id/usage
 */
export async function getInstitutionUsage(req, res) {
  try {
    const userRoles = await getRoles(req.user?.user_id)
    const hasAccess = userRoles.includes('admin') || userRoles.includes('curator')
    
    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin or curator role required'
      })
    }

    const institutionId = parseInt(req.params.id)
    
    const institution = await models.Institution.findByPk(institutionId)
    if (!institution) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Institution not found'
      })
    }

    const usageCount = await getInstitutionUsageCount(institutionId)

    res.json({
      success: true,
      data: {
        institution_id: institutionId,
        name: institution.name,
        usageCount
      }
    })
  } catch (error) {
    console.error('Error fetching institution usage:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch institution usage'
    })
  }
}

/**
 * Helper function to get institution usage count
 */
async function getInstitutionUsageCount(institutionId, transaction = null) {
  const options = transaction ? { transaction } : {}
  
  const userCount = await models.InstitutionsXUser.count({
    where: { institution_id: institutionId },
    ...options
  })
  
  const projectCount = await models.InstitutionsXProject.count({
    where: { institution_id: institutionId },
    ...options
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
  // Update user affiliations - handle potential duplicates
  const existingUserLinks = await models.InstitutionsXUser.findAll({
    where: { institution_id: toId },
    attributes: ['user_id'],
    transaction
  })
  const existingUserIds = existingUserLinks.map(l => l.user_id)
  
  // Delete links that would create duplicates
  if (existingUserIds.length > 0) {
    await models.InstitutionsXUser.destroy({
      where: { 
        institution_id: fromId,
        user_id: { [Op.in]: existingUserIds }
      },
      transaction,
      user
    })
  }
  
  // Update remaining links
  await models.InstitutionsXUser.update(
    { institution_id: toId },
    { 
      where: { institution_id: fromId },
      transaction,
      user
    }
  )
  
  // Update project affiliations - handle potential duplicates
  const existingProjectLinks = await models.InstitutionsXProject.findAll({
    where: { institution_id: toId },
    attributes: ['project_id'],
    transaction
  })
  const existingProjectIds = existingProjectLinks.map(l => l.project_id)
  
  // Delete links that would create duplicates
  if (existingProjectIds.length > 0) {
    await models.InstitutionsXProject.destroy({
      where: { 
        institution_id: fromId,
        project_id: { [Op.in]: existingProjectIds }
      },
      transaction,
      user
    })
  }
  
  // Update remaining links
  await models.InstitutionsXProject.update(
    { institution_id: toId },
    { 
      where: { institution_id: fromId },
      transaction,
      user
    }
  )
}

