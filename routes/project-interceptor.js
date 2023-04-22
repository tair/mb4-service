import { models } from '../models/init-models.js'

/**
 * Authorize that the project eixsts and is not deleted and that the user is
 * a member of the project.
 */
export async function authorizeProject(req, res, next) {
  const projectId = req.params.projectId
  const project = await models.Project.findByPk(projectId)

  if (project == null) {
    return res.status(404).json({ message: 'Project does not exist' })
  }

  if (project.deleted) {
    return res.status(404).json({ message: 'Project was deleted' })
  }

  const projectUser = await models.ProjectsXUser.findOne({
    where: {
      user_id: req.user.user_id,
      project_id: project.project_id,
    },
  })



  req.project = project
  req.project_user = projectUser
  
  next()
}