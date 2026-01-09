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

