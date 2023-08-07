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
  } else if (req.user?.user_id == project.user_id) {
    permissions.push('view', 'edit', 'manage')
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
        permissions.push('edit', 'view')
        break
      default: // Observer, Character Annonator, Bibliography maintainer
        permissions.push('view')
    }
  }

  req.project = project
  req.project.permissions = permissions

  next()
}

function canRoleAccessAnyProject(role) {
  return role && array_intersect(role, ALL_PROJECT_ACCESS_ROLES).length > 0
}
