import * as publishedProjectService from '../services/published-projects-service.js'
import * as ProjectService from '../services/projects-service.js'

export async function getProjects(req, res) {
  try {
    const projects = await publishedProjectService.getProjects()
    res.status(200).json(projects)
  } catch (e) {
    console.error('Error while getting projects list.', e)
    res.status(500).json({ message: 'Error while fetching project list.' })
  }
}

export async function getProjectsById(req, res) {
  const projectId = req.params.projectId
  // console.log(projectId)
  try {
    const result = await ProjectService.getProject(projectId)
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting project summary by id (controller).', e)
    res.status(500).json({
      message: 'Error while fetching project summary.',
    })
  }
}

export async function getProjectTitles(req, res) {
  try {
    const result = await publishedProjectService.getProjectTitles()
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
    const result = await publishedProjectService.getAuthorsWithProjects()
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting authors (controller).', e)
    res.status(500).json({ message: 'Error while fetching authors.' })
  }
}

export async function getJournalsWithProjects(req, res) {
  try {
    const result = await publishedProjectService.getJournalsWithProjects()
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting journals (controller).', e)
    res.status(500).json({ message: 'Error while fetching journals.' })
  }
}

export async function getInstitutionsWithProjects(req, res) {
  try {
    const result = await publishedProjectService.getInstitutionsWithProjects()
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting institutions (controller).', e)
    res.status(500).json({ message: 'Error while fetching institutions.' })
  }
}

export async function getProjectTaxonomy(req, res) {
  try {
    const result = await publishedProjectService.getProjectTaxonomy()
    res.status(200).json(result)
  } catch (e) {
    console.error('Error while getting taxonomy (controller).', e)
    res.status(500).json({ message: 'Error while fetching taxonomy.' })
  }
}

export async function getProjectStats(req, res) {
  try {
    const { getProjectViewsForLast30Days, getMediaViewsForLast30Days, getMatrixDownloadsForLast30Days, getDocDownloadsForLast30Days } = await import('../services/published-stats-service.js')
    
    const [
      projectViewsForLast30Days,
      mediaViewsForLast30Days,
      matrixDownloadsForLast30Days,
      docDownloadsForLast30Days
    ] = await Promise.all([
      getProjectViewsForLast30Days(),
      getMediaViewsForLast30Days(),
      getMatrixDownloadsForLast30Days(),
      getDocDownloadsForLast30Days()
    ])

    const stats = {
      projectViewsForLast30Days,
      mediaViewsForLast30Days,
      matrixDownloadsForLast30Days,
      docDownloadsForLast30Days
    }

    res.status(200).json(stats)
  } catch (e) {
    console.error('Error while getting project stats (controller).', e)
    res.status(500).json({ message: 'Error while fetching project statistics.' })
  }
}
