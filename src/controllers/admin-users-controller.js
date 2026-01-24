import { models } from '../models/init-models.js'
import { Op } from 'sequelize'
import { EmailManager } from '../lib/email-manager.js'
import { time } from '../util/util.js'

/**
 * Admin Users Controller
 * 
 * Provides administrative endpoints for managing all users in the system.
 * All endpoints require admin authentication.
 */

/**
 * List users with filters, pagination and sorting
 * GET /admin/users
 * 
 * Query params:
 * - status: 'active' | 'inactive' | 'deleted' | 'all'
 * - search: string (searches email, fname, lname)
 * - sortBy: 'email' | 'name' | 'lastLogin' | 'createdAt'
 * - sortOrder: 'asc' | 'desc'
 * - page: number (1-indexed)
 * - perPage: number (default 25)
 */
export async function listUsers(req, res) {
  try {
    const {
      status = 'active',
      search = '',
      sortBy = 'lname',
      sortOrder = 'asc',
      page = 1,
      perPage = 25,
    } = req.query

    // Build where clause based on status filter
    const where = {}
    
    if (status === 'active') {
      where.active = 1
      where.userclass = 0
    } else if (status === 'inactive') {
      where.active = 0
      where.userclass = 0
    } else if (status === 'deleted') {
      where.userclass = 255
    } else if (status !== 'all') {
      // Default to non-deleted users
      where.userclass = { [Op.ne]: 255 }
    }

    // Add search filter
    if (search) {
      where[Op.or] = [
        { email: { [Op.like]: `%${search}%` } },
        { fname: { [Op.like]: `%${search}%` } },
        { lname: { [Op.like]: `%${search}%` } },
      ]
    }

    // Build order clause
    const orderMap = {
      email: ['email'],
      name: ['lname', 'fname'],
      lastLogin: [models.User.sequelize.literal("JSON_EXTRACT(vars, '$.last_login')")],
      createdAt: ['approved_on'],
    }
    const orderFields = orderMap[sortBy] || ['lname', 'fname']
    const order = orderFields.map(field => [field, sortOrder.toUpperCase()])

    // Calculate pagination
    const limit = Math.min(parseInt(perPage) || 25, 100)
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit

    // Fetch users
    const { count, rows: users } = await models.User.findAndCountAll({
      where,
      attributes: [
        'user_id',
        'email',
        'fname',
        'lname',
        'active',
        'userclass',
        'accepted_terms_of_use',
        'last_confirmed_profile_on',
        'approved_on',
        'vars',
        'orcid',
      ],
      order,
      limit,
      offset,
    })

    // Transform users for response
    const userList = users.map(user => {
      const lastLogin = user.getVar('last_login')
      return {
        user_id: user.user_id,
        email: user.email,
        name: `${user.lname}, ${user.fname}`,
        fname: user.fname,
        lname: user.lname,
        active: user.active === 1,
        userclass: user.userclass,
        status: getStatusLabel(user.active, user.userclass),
        lastLoginAt: lastLogin ? new Date(lastLogin * 1000).toISOString() : null,
        acceptedTerms: user.accepted_terms_of_use === 1,
        hasUpdatedProfile: user.hasConfirmedProfile(),
        approvedOn: user.approved_on ? new Date(user.approved_on * 1000).toISOString() : null,
        orcid: user.orcid,
      }
    })

    res.json({
      success: true,
      data: {
        users: userList,
        pagination: {
          total: count,
          page: parseInt(page) || 1,
          perPage: limit,
          totalPages: Math.ceil(count / limit),
        },
      },
    })
  } catch (error) {
    console.error('Error listing users:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to list users',
    })
  }
}

/**
 * Get a single user with roles and institutions
 * GET /admin/users/:id
 */
export async function getUser(req, res) {
  try {
    const userId = parseInt(req.params.id)
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      })
    }

    const user = await models.User.findByPk(userId, {
      attributes: [
        'user_id',
        'email',
        'fname',
        'lname',
        'active',
        'userclass',
        'accepted_terms_of_use',
        'last_confirmed_profile_on',
        'approved_on',
        'confirmed_on',
        'advisor_user_id',
        'vars',
        'orcid',
      ],
      include: [
        {
          model: models.Institution,
          as: 'institutions',
          through: { attributes: [] },
          attributes: ['institution_id', 'name'],
        },
      ],
    })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    // Get user roles
    const userRoles = await models.UsersXRole.findAll({
      where: { user_id: userId },
      include: [
        {
          model: models.UserRole,
          as: 'role',
          attributes: ['role_id', 'name', 'code', 'description'],
        },
      ],
    })

    // Get advisor info if applicable
    let advisor = null
    if (user.advisor_user_id) {
      advisor = await models.User.findByPk(user.advisor_user_id, {
        attributes: ['user_id', 'fname', 'lname', 'email'],
      })
    }

    // Get student info from vars if applicable
    const isStudent = user.getVar('is_student')
    const studentAdvisorName = user.getVar('student_advisor_name')
    const studentAdvisorEmail = user.getVar('student_advisor_email')
    const registrationCountry = user.getVar('registration_country')
    const lastLogin = user.getVar('last_login')

    res.json({
      success: true,
      data: {
        user_id: user.user_id,
        email: user.email,
        fname: user.fname,
        lname: user.lname,
        active: user.active === 1,
        userclass: user.userclass,
        status: getStatusLabel(user.active, user.userclass),
        acceptedTerms: user.accepted_terms_of_use === 1,
        hasUpdatedProfile: user.hasConfirmedProfile(),
        lastConfirmedProfileOn: user.last_confirmed_profile_on
          ? new Date(user.last_confirmed_profile_on * 1000).toISOString()
          : null,
        approvedOn: user.approved_on
          ? new Date(user.approved_on * 1000).toISOString()
          : null,
        confirmedOn: user.confirmed_on
          ? new Date(user.confirmed_on * 1000).toISOString()
          : null,
        orcid: user.orcid,
        lastLoginAt: lastLogin ? new Date(lastLogin * 1000).toISOString() : null,
        registrationCountry: registrationCountry || null,
        isStudent: isStudent || false,
        advisor: advisor
          ? {
              user_id: advisor.user_id,
              name: `${advisor.fname} ${advisor.lname}`,
              email: advisor.email,
            }
          : studentAdvisorName
          ? {
              name: studentAdvisorName,
              email: studentAdvisorEmail,
            }
          : null,
        roles: userRoles.map(ur => ({
          role_id: ur.role.role_id,
          name: ur.role.name,
          code: ur.role.code,
          description: ur.role.description,
        })),
        institutions: user.institutions.map(inst => ({
          institution_id: inst.institution_id,
          name: inst.name,
        })),
      },
    })
  } catch (error) {
    console.error('Error getting user:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get user',
    })
  }
}

/**
 * Create a new user
 * POST /admin/users
 */
export async function createUser(req, res) {
  try {
    const { email, fname, lname, active = false, roleIds = [], institutionIds = [] } = req.body

    // Validate required fields
    if (!email || !fname || !lname) {
      return res.status(400).json({
        success: false,
        message: 'Email, first name, and last name are required',
      })
    }

    // Check for existing email
    const existingUser = await models.User.findOne({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists',
      })
    }

    // Create user without password (they'll need to use password reset)
    const newUser = await models.User.create({
      email: email.toLowerCase(),
      fname,
      lname,
      active: active ? 1 : 0,
      userclass: 0,
      approved_on: active ? time() : null,
    })

    // Assign roles
    if (roleIds.length > 0) {
      const roleRecords = roleIds.map(roleId => ({
        user_id: newUser.user_id,
        role_id: roleId,
      }))
      await models.UsersXRole.bulkCreate(roleRecords, { ignoreDuplicates: true })
    }

    // Assign institutions
    if (institutionIds.length > 0) {
      const institutionRecords = institutionIds.map(institutionId => ({
        user_id: newUser.user_id,
        institution_id: institutionId,
        created_on: time(),
      }))
      await models.InstitutionsXUser.bulkCreate(institutionRecords, { ignoreDuplicates: true })
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user_id: newUser.user_id,
      },
    })
  } catch (error) {
    console.error('Error creating user:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
    })
  }
}

/**
 * Update user details
 * PUT /admin/users/:id
 */
export async function updateUser(req, res) {
  try {
    const userId = parseInt(req.params.id)
    const { email, fname, lname, userclass } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      })
    }

    const user = await models.User.findByPk(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    // Check for email uniqueness if changing email
    if (email && email.toLowerCase() !== user.email) {
      const existingUser = await models.User.findOne({
        where: {
          email: email.toLowerCase(),
          user_id: { [Op.ne]: userId },
        },
      })
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'A user with this email already exists',
        })
      }
      user.email = email.toLowerCase()
    }

    // Update fields
    if (fname !== undefined) user.fname = fname
    if (lname !== undefined) user.lname = lname
    if (userclass !== undefined) user.userclass = userclass

    await user.save({ user: req.user })

    res.json({
      success: true,
      message: 'User updated successfully',
    })
  } catch (error) {
    console.error('Error updating user:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
    })
  }
}

/**
 * Soft delete a user (set userclass to 255)
 * DELETE /admin/users/:id
 */
export async function deleteUser(req, res) {
  try {
    const userId = parseInt(req.params.id)

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      })
    }

    // Prevent deleting self
    if (userId === req.user.user_id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account',
      })
    }

    const user = await models.User.findByPk(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    // Soft delete - set userclass to 255
    user.userclass = 255
    user.active = 0
    await user.save({ user: req.user })

    res.json({
      success: true,
      message: 'User deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
    })
  }
}

/**
 * Activate a user and send activation email
 * POST /admin/users/:id/activate
 */
export async function activateUser(req, res) {
  try {
    const userId = parseInt(req.params.id)
    const { sendEmail = true } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      })
    }

    const user = await models.User.findByPk(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    // Check if already active
    if (user.active === 1 && user.userclass === 0) {
      return res.status(400).json({
        success: false,
        message: 'User is already active',
      })
    }

    // Activate user
    const wasInactive = user.active === 0
    user.active = 1
    user.userclass = 0
    user.approved_on = time()
    await user.save({ user: req.user })

    // Send activation email if user was previously inactive
    if (sendEmail && wasInactive) {
      try {
        const emailManager = new EmailManager()
        await emailManager.email('account_activation', {
          to: user.email,
          name: `${user.fname} ${user.lname}`,
          email: user.email,
        })
      } catch (emailError) {
        console.error('Failed to send activation email:', emailError)
        // Don't fail the request if email fails
      }
    }

    res.json({
      success: true,
      message: 'User activated successfully',
      emailSent: sendEmail && wasInactive,
    })
  } catch (error) {
    console.error('Error activating user:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to activate user',
    })
  }
}

/**
 * Deactivate a user
 * POST /admin/users/:id/deactivate
 */
export async function deactivateUser(req, res) {
  try {
    const userId = parseInt(req.params.id)

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      })
    }

    // Prevent deactivating self
    if (userId === req.user.user_id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account',
      })
    }

    const user = await models.User.findByPk(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    // Deactivate user
    user.active = 0
    await user.save({ user: req.user })

    res.json({
      success: true,
      message: 'User deactivated successfully',
    })
  } catch (error) {
    console.error('Error deactivating user:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate user',
    })
  }
}

/**
 * Get all available roles
 * GET /admin/roles
 */
export async function getRoles(req, res) {
  try {
    const roles = await models.UserRole.findAll({
      attributes: ['role_id', 'name', 'code', 'description'],
      order: [['name', 'ASC']],
    })

    res.json({
      success: true,
      data: roles.map(role => ({
        role_id: role.role_id,
        name: role.name,
        code: role.code,
        description: role.description,
      })),
    })
  } catch (error) {
    console.error('Error getting roles:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get roles',
    })
  }
}

/**
 * Update user's roles
 * PUT /admin/users/:id/roles
 */
export async function updateUserRoles(req, res) {
  try {
    const userId = parseInt(req.params.id)
    const { roleIds = [] } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      })
    }

    const user = await models.User.findByPk(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    // Use transaction for role updates
    await models.User.sequelize.transaction(async (transaction) => {
      // Remove existing roles
      await models.UsersXRole.destroy({
        where: { user_id: userId },
        transaction,
      })

      // Add new roles
      if (roleIds.length > 0) {
        const roleRecords = roleIds.map(roleId => ({
          user_id: userId,
          role_id: roleId,
        }))
        await models.UsersXRole.bulkCreate(roleRecords, {
          transaction,
          ignoreDuplicates: true,
        })
      }
    })

    res.json({
      success: true,
      message: 'User roles updated successfully',
    })
  } catch (error) {
    console.error('Error updating user roles:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update user roles',
    })
  }
}

/**
 * Update user's institutions
 * PUT /admin/users/:id/institutions
 */
export async function updateUserInstitutions(req, res) {
  try {
    const userId = parseInt(req.params.id)
    const { institutionIds = [] } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      })
    }

    const user = await models.User.findByPk(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    // Use transaction for institution updates
    await models.User.sequelize.transaction(async (transaction) => {
      // Remove existing institutions
      await models.InstitutionsXUser.destroy({
        where: { user_id: userId },
        transaction,
      })

      // Add new institutions
      if (institutionIds.length > 0) {
        const institutionRecords = institutionIds.map(institutionId => ({
          user_id: userId,
          institution_id: institutionId,
          created_on: time(),
        }))
        await models.InstitutionsXUser.bulkCreate(institutionRecords, {
          transaction,
          ignoreDuplicates: true,
        })
      }
    })

    res.json({
      success: true,
      message: 'User institutions updated successfully',
    })
  } catch (error) {
    console.error('Error updating user institutions:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update user institutions',
    })
  }
}

/**
 * Get user statistics for admin dashboard
 * GET /admin/users/stats
 */
export async function getUserStats(req, res) {
  try {
    const [totalActive, totalInactive, totalDeleted, pendingApproval] = await Promise.all([
      models.User.count({
        where: { active: 1, userclass: 0 },
      }),
      models.User.count({
        where: { active: 0, userclass: 0 },
      }),
      models.User.count({
        where: { userclass: 255 },
      }),
      models.User.count({
        where: { active: 0, userclass: 0, approved_on: null },
      }),
    ])

    res.json({
      success: true,
      data: {
        totalActive,
        totalInactive,
        totalDeleted,
        pendingApproval,
        total: totalActive + totalInactive + totalDeleted,
      },
    })
  } catch (error) {
    console.error('Error getting user stats:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get user statistics',
    })
  }
}

/**
 * Helper function to get status label
 */
function getStatusLabel(active, userclass) {
  if (userclass === 255) return 'deleted'
  if (active === 1) return 'active'
  return 'inactive'
}

/**
 * Tables that contain user_id foreign key reference
 * Each entry contains: model name, column name referencing user
 */
const USER_LINKED_TABLES = [
  { model: 'Project', column: 'user_id', description: 'Project Owner' },
  { model: 'ProjectsXUser', column: 'user_id', description: 'Project Memberships' },
  { model: 'MediaFile', column: 'user_id', description: 'Media Files' },
  { model: 'Taxon', column: 'user_id', description: 'Taxa' },
  { model: 'Matrix', column: 'user_id', description: 'Matrices' },
  { model: 'Character', column: 'user_id', description: 'Characters' },
  { model: 'CharacterState', column: 'user_id', description: 'Character States' },
  { model: 'CharacterOrdering', column: 'user_id', description: 'Character Orderings' },
  { model: 'CharacterRule', column: 'user_id', description: 'Character Rules' },
  { model: 'CharacterRuleAction', column: 'user_id', description: 'Character Rule Actions' },
  { model: 'CharactersXPartition', column: 'user_id', description: 'Characters in Partitions' },
  { model: 'CharactersXMedium', column: 'user_id', description: 'Character Media Links' },
  { model: 'CharactersXBibliographicReference', column: 'user_id', description: 'Character Bibliography Links' },
  { model: 'Cell', column: 'user_id', description: 'Cells' },
  { model: 'CellNote', column: 'user_id', description: 'Cell Notes' },
  { model: 'CellsXMedium', column: 'user_id', description: 'Cell Media Links' },
  { model: 'CellsXBibliographicReference', column: 'user_id', description: 'Cell Bibliography Links' },
  { model: 'CellBatchLog', column: 'user_id', description: 'Cell Batch Logs' },
  { model: 'BibliographicReference', column: 'user_id', description: 'Bibliographic References' },
  { model: 'Specimen', column: 'user_id', description: 'Specimens' },
  { model: 'SpecimensXBibliographicReference', column: 'user_id', description: 'Specimen Bibliography Links' },
  { model: 'TaxaXMedium', column: 'user_id', description: 'Taxa Media Links' },
  { model: 'TaxaXSpecimen', column: 'user_id', description: 'Taxa Specimen Links' },
  { model: 'TaxaXPartition', column: 'user_id', description: 'Taxa in Partitions' },
  { model: 'TaxaXBibliographicReference', column: 'user_id', description: 'Taxa Bibliography Links' },
  { model: 'Folio', column: 'user_id', description: 'Folios' },
  { model: 'Partition', column: 'user_id', description: 'Partitions' },
  { model: 'MediaView', column: 'user_id', description: 'Media Views' },
  { model: 'MediaLabel', column: 'user_id', description: 'Media Labels' },
  { model: 'MediaFilesXDocument', column: 'user_id', description: 'Media Document Links' },
  { model: 'MediaFilesXBibliographicReference', column: 'user_id', description: 'Media Bibliography Links' },
  { model: 'MatrixTaxaOrder', column: 'user_id', description: 'Matrix Taxa Orders' },
  { model: 'MatrixFileUpload', column: 'user_id', description: 'Matrix File Uploads' },
  { model: 'ProjectDocument', column: 'user_id', description: 'Project Documents' },
  { model: 'ProjectDocumentFolder', column: 'user_id', description: 'Project Document Folders' },
  { model: 'ProjectGroup', column: 'user_id', description: 'Project Groups' },
  { model: 'ProjectDuplicationRequest', column: 'user_id', description: 'Duplication Requests' },
  { model: 'CurationRequest', column: 'user_id', description: 'Curation Requests' },
  { model: 'CipresRequest', column: 'user_id', description: 'CIPRES Requests' },
  { model: 'Institution', column: 'user_id', description: 'Institution Creator' },
  { model: 'InstitutionsXUser', column: 'user_id', description: 'Institution Memberships' },
  { model: 'UsersXRole', column: 'user_id', description: 'User Roles' },
  { model: 'TaskQueue', column: 'user_id', description: 'Task Queue' },
  { model: 'Annotation', column: 'user_id', description: 'Annotations' },
  { model: 'AnnotationEvent', column: 'user_id', description: 'Annotation Events' },
  { model: 'CuratorPotentialProject', column: 'approved_by_id', description: 'Curator Approvals' },
  { model: 'User', column: 'advisor_user_id', description: 'Student Advisees' },
]

/**
 * Get user's data usage across all tables
 * GET /admin/users/:id/usage
 */
export async function getUserUsage(req, res) {
  try {
    const userId = parseInt(req.params.id)

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      })
    }

    const user = await models.User.findByPk(userId, {
      attributes: ['user_id', 'email', 'fname', 'lname'],
    })

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      })
    }

    const usage = []

    for (const tableConfig of USER_LINKED_TABLES) {
      const model = models[tableConfig.model]
      if (!model) {
        continue
      }

      try {
        const count = await model.count({
          where: { [tableConfig.column]: userId },
        })

        if (count > 0) {
          usage.push({
            table: tableConfig.model,
            column: tableConfig.column,
            description: tableConfig.description,
            count,
          })
        }
      } catch (e) {
        console.warn(`Error counting ${tableConfig.model}:`, e.message)
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          user_id: user.user_id,
          email: user.email,
          name: `${user.fname} ${user.lname}`,
        },
        usage,
        totalRecords: usage.reduce((sum, item) => sum + item.count, 0),
      },
    })
  } catch (error) {
    console.error('Error getting user usage:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get user usage',
    })
  }
}

/**
 * Merge one user's data into another user
 * POST /admin/users/merge
 * 
 * This transfers all database records from sourceUserId to targetUserId.
 * The source user will have all their data transferred and can optionally be deleted.
 */
export async function mergeUsers(req, res) {
  try {
    const { sourceUserId, targetUserId, deleteSourceUser = false } = req.body

    // Validate input
    if (!sourceUserId || !targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Both sourceUserId and targetUserId are required',
      })
    }

    const sourceId = parseInt(sourceUserId)
    const targetId = parseInt(targetUserId)

    if (sourceId === targetId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot merge user into themselves',
      })
    }

    // Verify both users exist
    const [sourceUser, targetUser] = await Promise.all([
      models.User.findByPk(sourceId, {
        attributes: ['user_id', 'email', 'fname', 'lname', 'userclass'],
      }),
      models.User.findByPk(targetId, {
        attributes: ['user_id', 'email', 'fname', 'lname', 'userclass'],
      }),
    ])

    if (!sourceUser) {
      return res.status(404).json({
        success: false,
        message: 'Source user not found',
      })
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found',
      })
    }

    // Perform merge in a transaction
    const mergeResults = []

    await models.User.sequelize.transaction(async (transaction) => {
      for (const tableConfig of USER_LINKED_TABLES) {
        const model = models[tableConfig.model]
        if (!model) {
          continue
        }

        try {
          // For tables with unique constraints involving user_id,
          // we need to handle duplicates
          if (tableConfig.model === 'ProjectsXUser') {
            // Special handling for project memberships - avoid duplicate user in same project
            const existingMemberships = await model.findAll({
              where: { user_id: targetId },
              attributes: ['project_id'],
              transaction,
            })
            const existingProjectIds = existingMemberships.map(m => m.project_id)

            // Update only memberships that won't cause duplicates
            const [updated] = await model.update(
              { user_id: targetId },
              {
                where: {
                  user_id: sourceId,
                  project_id: { [Op.notIn]: existingProjectIds },
                },
                transaction,
              }
            )

            // Delete remaining source memberships (duplicates)
            const deleted = await model.destroy({
              where: { user_id: sourceId },
              transaction,
            })

            if (updated > 0 || deleted > 0) {
              mergeResults.push({
                table: tableConfig.model,
                description: tableConfig.description,
                transferred: updated,
                duplicatesRemoved: deleted,
              })
            }
          } else if (tableConfig.model === 'InstitutionsXUser') {
            // Special handling for institution memberships
            const existingMemberships = await model.findAll({
              where: { user_id: targetId },
              attributes: ['institution_id'],
              transaction,
            })
            const existingInstitutionIds = existingMemberships.map(m => m.institution_id)

            const [updated] = await model.update(
              { user_id: targetId },
              {
                where: {
                  user_id: sourceId,
                  institution_id: { [Op.notIn]: existingInstitutionIds },
                },
                transaction,
              }
            )

            const deleted = await model.destroy({
              where: { user_id: sourceId },
              transaction,
            })

            if (updated > 0 || deleted > 0) {
              mergeResults.push({
                table: tableConfig.model,
                description: tableConfig.description,
                transferred: updated,
                duplicatesRemoved: deleted,
              })
            }
          } else if (tableConfig.model === 'UsersXRole') {
            // Special handling for user roles
            const existingRoles = await model.findAll({
              where: { user_id: targetId },
              attributes: ['role_id'],
              transaction,
            })
            const existingRoleIds = existingRoles.map(r => r.role_id)

            const [updated] = await model.update(
              { user_id: targetId },
              {
                where: {
                  user_id: sourceId,
                  role_id: { [Op.notIn]: existingRoleIds },
                },
                transaction,
              }
            )

            const deleted = await model.destroy({
              where: { user_id: sourceId },
              transaction,
            })

            if (updated > 0 || deleted > 0) {
              mergeResults.push({
                table: tableConfig.model,
                description: tableConfig.description,
                transferred: updated,
                duplicatesRemoved: deleted,
              })
            }
          } else {
            // Standard update for other tables
            const [updated] = await model.update(
              { [tableConfig.column]: targetId },
              {
                where: { [tableConfig.column]: sourceId },
                transaction,
              }
            )

            if (updated > 0) {
              mergeResults.push({
                table: tableConfig.model,
                description: tableConfig.description,
                transferred: updated,
              })
            }
          }
        } catch (e) {
          console.warn(`Error updating ${tableConfig.model}:`, e.message)
          // Continue with other tables
        }
      }

      // Optionally delete/soft-delete the source user
      if (deleteSourceUser) {
        sourceUser.userclass = 255
        sourceUser.active = 0
        await sourceUser.save({ transaction, user: req.user })
      }
    })

    const totalTransferred = mergeResults.reduce((sum, r) => sum + (r.transferred || 0), 0)

    res.json({
      success: true,
      message: `Successfully merged user data. ${totalTransferred} records transferred.`,
      data: {
        sourceUser: {
          user_id: sourceUser.user_id,
          email: sourceUser.email,
          name: `${sourceUser.fname} ${sourceUser.lname}`,
          deleted: deleteSourceUser,
        },
        targetUser: {
          user_id: targetUser.user_id,
          email: targetUser.email,
          name: `${targetUser.fname} ${targetUser.lname}`,
        },
        mergeResults,
        totalTransferred,
      },
    })
  } catch (error) {
    console.error('Error merging users:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to merge users: ' + error.message,
    })
  }
}

