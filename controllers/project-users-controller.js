import * as service from '../services/project-user-service.js'

export async function getProjectUsers(req, res) {
  const projectId = req.project.project_id
  const users = await service.getUsersInProject(projectId)
  res.status(200).json({ users })
}
