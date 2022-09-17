const projectsService = require('../services/project-service.js')
const projectDetailService = require('../services/project-detail-service.js')

async function getProjects(req, res, next) {
  try {
    const projects = await projectsService.getProjects()
    res.status(200).json(projects)
  } catch (e) {
    console.error('Error while getting projects list.', e)
    res.status(500).json({ message: 'Error while fetching project list.' })
  }
}

async function getProjectsById (req, res) {
  const projectId = req.params.id
  try {
    const result = await projectDetailService.getProjectDetails(projectId)
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting project details (controller).', e)
    res.status(500).json({ message: 'Error while fetching project details.' })
  }
}

module.exports = {
  getProjects,
  getProjectsById,
}
