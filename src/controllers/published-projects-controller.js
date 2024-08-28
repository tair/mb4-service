import * as projectService from '../services/published-projects-service.js'
import * as projectDetailService from '../services/project-detail-service.js'

export async function getProjects(req, res) {
  try {
    const projects = await projectService.getProjects()
    res.status(200).json(projects)
  } catch (e) {
    console.error('Error while getting projects list.', e)
    res.status(500).json({ message: 'Error while fetching project list.' })
  }
}

export async function getProjectsById(req, res) {
  const projectId = req.params.projectId
  try {
    const result = await projectDetailService.getProjectDetails(projectId)
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting project details (controller).', e)
    res.status(500).json({
      message: 'Error while fetching project details.',
    })
  }
}

export async function getProjectTitles(req, res) {
  try {
    const result = await projectService.getProjectTitles()
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting project titles (controller).', e)
    res.status(500).json({
      message: 'Error while fetching project titles.',
    })
  }
}

export async function getAuthorsWithProjects(req, res) {
  try {
    const result = await projectService.getAuthorsWithProjects()
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting authors (controller).', e)
    res.status(500).json({ message: 'Error while fetching authors.' })
  }
}

export async function getJournalsWithProjects(req, res) {
  try {
    const result = await projectService.getJournalsWithProjects()
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting journals (controller).', e)
    res.status(500).json({ message: 'Error while fetching journals.' })
  }
}

export async function getInstitutionsWithProjects(req, res) {
  try {
    const result = await projectService.getInstitutionsWithProjects()
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting institutions (controller).', e)
    res.status(500).json({ message: 'Error while fetching institutions.' })
  }
}

export async function getProjectTaxonomy(req, res) {
  try {
    const result = await projectService.getProjectTaxonomy()
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting taxonomy (controller).', e)
    res.status(500).json({ message: 'Error while fetching taxonomy.' })
  }
}
