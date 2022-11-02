import * as projectService from '../services/projects-service.js'
import * as ProjectDetailService from '../services/project-detail-service.js'

async function getProjects(req, res, next) {
  try {
    const projects = await projectService.getProjects()
    res.status(200).json(projects)
  } catch (e) {
    console.error('Error while getting projects list.', e)
    res.status(500).json({ message: 'Error while fetching project list.' })
  }
}

async function getProjectsById(req, res) {
  const projectId = req.params.id
  try {
    const result = await ProjectDetailService.getProjectDetails(projectId)
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting project details (controller).', e)
    res.status(500).json({
      message: 'Error while fetching project details.',
    })
  }
}

async function getProjectTitles(req, res) {
  const sort_by = req.params.sort_by

  try {
    const result = await projectService.getProjectTitles(sort_by)
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting project titles (controller).', e)
    res.status(500).json({
      message: 'Error while fetching project titles.',
    })
  }
}

async function getAuthorsWithProjects(req, res) {
  try {
    const result = await projectService.getAuthorsWithProjects()
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting authors (controller).', e)
    res.status(500).json({ message: 'Error while fetching authors.' })
  }
}

async function getJournalsWithProjects(req, res) {
  try {
    const result = await projectService.getJournalsWithProjects()
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting journals (controller).', e)
    res.status(500).json({ message: 'Error while fetching journals.' })
  }
}

async function getInstitutionsWithProjects(req, res) {
  try {
    const result = await projectService.getInstitutionsWithProjects()
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting institutions (controller).', e)
    res.status(500).json({ message: 'Error while fetching institutions.' })
  }
}

export {
  getProjects,
  getProjectsById,
  getProjectTitles,
  getAuthorsWithProjects,
  getJournalsWithProjects,
  getInstitutionsWithProjects,
}
