import { models } from '../models/init-models.js'
import { array_intersect } from '../util/util.js'

const ALL_PROJECT_ACCESS_ROLES = ['admin', 'curator']

/**
 * Authorize that the project eixsts and is not deleted and that the user is
 * a member of the project.
 */
export async function authorizeProject(req, res, next) {
  // Make sure that the user was signed-in before we can authorize the project.
  if (!req.credential) {
    const error = new Error('Wrong password!')
    error.statusCode = 401
    next(error)
    return
  }

  const projectId = req.params.projectId
  const project = await models.Project.findByPk(projectId)

  if (project == null) {
    return res.status(404).json({ message: 'Project does not exist' })
  }

  if (project.deleted) {
    return res.status(404).json({ message: 'Project was deleted' })
  }

  // Set the project so that it's accessible in the controllers.
  req.project = project

  const permissions = []
  if (req.credential.is_anonymous) {
    if (req.credential.project_id != project.project_id) {
      return res.status(401).json({
        message: 'User is not authorized to view this project',
      })
    }
    permissions.push('view')
  } else if (canRoleAccessAnyProject(req.user?.roles)) {
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
  } else if (req.user?.user_id == project.user_id) {
    permissions.push('view', 'edit', 'manage')

    // Update access time for project owner
    project.setUserAccessTime(req.user.user_id, true, req.user).catch((err) => {
      console.warn(
        'Non-critical: Failed to update access time for project owner:',
        err.message
      )
    })
  } else {
    const projectUser = await models.ProjectsXUser.findOne({
      where: {
        user_id: req.user.user_id,
        project_id: project.project_id,
      },
    })
    if (!projectUser) {
      return res.status(404).json({
        message: 'User is not a member of this project',
      })
    }
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
  }

  req.project.permissions = permissions

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
