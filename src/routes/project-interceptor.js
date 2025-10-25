import { models } from '../models/init-models.js'
import { array_intersect } from '../util/util.js'

const ALL_PROJECT_ACCESS_ROLES = ['admin', 'curator']

/**
 * Authorize that the project eixsts and is not deleted and that the user is
 * a member of the project.
 */
export async function authorizeProject(req, res, next) {
  const logPrefix = `[PROJECT-AUTH-DEBUG] ${req.method} ${req.path}`
  
  console.log(`${logPrefix} - Starting project authorization check`)
  console.log(`${logPrefix} - Credential present:`, !!req.credential)
  console.log(`${logPrefix} - User present:`, !!req.user)
  
  // Make sure that the user was signed-in before we can authorize the project.
  if (!req.credential) {
    console.error(`${logPrefix} - ❌ FAILED: No credential found (user not authenticated)`)
    const error = new Error('Wrong password!')
    error.statusCode = 401
    next(error)
    return
  }

  const projectId = req.params.projectId
  console.log(`${logPrefix} - Checking access to project:`, projectId)
  console.log(`${logPrefix} - User ID:`, req.credential.user_id)
  console.log(`${logPrefix} - Is anonymous:`, req.credential.is_anonymous)
  
  const project = await models.Project.findByPk(projectId)

  if (project == null) {
    console.error(`${logPrefix} - ❌ FAILED: Project ${projectId} does not exist`)
    return res.status(404).json({ message: 'Project does not exist' })
  }

  if (project.deleted) {
    console.error(`${logPrefix} - ❌ FAILED: Project ${projectId} was deleted`)
    return res.status(404).json({ message: 'Project was deleted' })
  }

  console.log(`${logPrefix} - Project found:`, {
    project_id: project.project_id,
    name: project.name,
    user_id: project.user_id,
    deleted: project.deleted,
    published: project.published
  })

  // Set the project so that it's accessible in the controllers.
  req.project = project

  const permissions = []
  if (req.credential.is_anonymous) {
    console.log(`${logPrefix} - Anonymous user, checking project access`)
    console.log(`${logPrefix} - Credential project_id:`, req.credential.project_id)
    console.log(`${logPrefix} - Target project_id:`, project.project_id)
    
    if (req.credential.project_id != project.project_id) {
      console.error(`${logPrefix} - ❌ FAILED: Anonymous user not authorized for this project`)
      return res.status(401).json({
        message: 'User is not authorized to view this project',
      })
    }
    permissions.push('view')
    console.log(`${logPrefix} - ✅ Anonymous user granted 'view' permission`)
  } else if (canRoleAccessAnyProject(req.user?.roles)) {
    console.log(`${logPrefix} - User has admin/curator role:`, req.user.roles)
    permissions.push('view', 'edit', 'manage')

    // Update access time for admin/curator users accessing the project
    // Note: Global admins/curators may not be in projects_x_users table
    if (req.user?.user_id) {
      // Fire-and-forget: Don't block request on access time updates
      project
        .setUserAccessTime(req.user.user_id, false, req.user)
        .catch((err) => {
          console.warn(
            'Non-critical: Failed to update access time for admin/curator:',
            err.message
          )
        })
    }
    console.log(`${logPrefix} - ✅ Admin/curator granted full permissions`)
  } else if (req.user?.user_id == project.user_id) {
    console.log(`${logPrefix} - User is project owner`)
    permissions.push('view', 'edit', 'manage')

    // Update access time for project owner
    project.setUserAccessTime(req.user.user_id, true, req.user).catch((err) => {
      console.warn(
        'Non-critical: Failed to update access time for project owner:',
        err.message
      )
    })
    console.log(`${logPrefix} - ✅ Project owner granted full permissions`)
  } else {
    console.log(`${logPrefix} - Checking project membership for user:`, req.user.user_id)
    
    const projectUser = await models.ProjectsXUser.findOne({
      where: {
        user_id: req.user.user_id,
        project_id: project.project_id,
      },
    })
    
    if (!projectUser) {
      console.error(`${logPrefix} - ❌ FAILED: User ${req.user.user_id} is not a member of project ${projectId}`)
      return res.status(404).json({
        message: 'User is not a member of this project',
      })
    }
    
    console.log(`${logPrefix} - Project membership found:`, {
      user_id: projectUser.user_id,
      project_id: projectUser.project_id,
      membership_type: projectUser.membership_type
    })
    
    switch (projectUser.membership_type) {
      case 0: // Full User
      case 2: // Matrix Scorer
        permissions.push('edit', 'view')
        break
      default: // Observer, Bibliography maintainer
        permissions.push('view')
    }

    // Set the project user so that it can be read downstream too.
    req.project.user = projectUser

    // Update access time for project members
    project
      .setUserAccessTime(req.user.user_id, false, req.user)
      .catch((err) => {
        console.warn(
          'Non-critical: Failed to update access time for project member:',
          err.message
        )
      })
    
    console.log(`${logPrefix} - ✅ Project member granted permissions:`, permissions)
  }

  req.project.permissions = permissions
  console.log(`${logPrefix} - ✅ SUCCESS: Project authorization complete with permissions:`, permissions)

  next()
}

/**
 * Authorize that the project eixsts and is not deleted and is a public project
 */
export async function authorizePublishedProject(req, res, next) {
  const projectId = req.params.projectId
  const project = await models.Project.findByPk(projectId)

  if (project == null) {
    return res.status(404).json({ message: 'This project does not exist.' })
  }

  if (project.deleted) {
    return res.status(404).json({ message: 'This project was deleted.' })
  }

  if (!project.published) {
    return res
      .status(404)
      .json({ message: 'This project is not yet publicly available.' })
  }

  // Set the project so that it's accessible in the controllers
  req.project = project

  next()
}

function canRoleAccessAnyProject(role) {
  return role && array_intersect(role, ALL_PROJECT_ACCESS_ROLES).length > 0
}
