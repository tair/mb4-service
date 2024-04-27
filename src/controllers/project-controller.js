import sequelizeConn from '../util/db.js'
import { getMedia } from '../util/media.js'
import { models } from '../models/init-models.js'
import * as institutionService from '../services/institution-service.js'
import * as projectService from '../services/projects-service.js'
import * as projectStatsService from '../services/project-stats-service.js'
import * as projectUserService from '../services/project-user-service.js'
import * as mediaService from '../services/media-service.js'

export async function getProjects(req, res) {
  const userId = req.user?.user_id
  if (userId == null) {
    res.status(200).json({ projects: [] })
    return
  }

  const projects = await projectService.getProjectsForUser(userId)

  const resultMap = new Map()
  const projectIds = []
  const mediaIds = []
  for (const project of projects) {
    const projectId = project.project_id
    projectIds.push(projectId)

    if (project.exemplar_media_id) {
      mediaIds.push(project.exemplar_media_id)
    }

    resultMap.set(projectId, {
      project_id: project.project_id,
      name: project.name,
      created_on: project.created_on,
      published: project.published,
      article_authors: project.article_authors,
      article_pp: project.article_pp,
      journal_year: project.journal_year,
      article_title: project.article_authors,
      journal_title: project.journal_title,
      journal_volume: project.journal_volume,
      journal_number: project.journal_number,
      journal_in_press: project.journal_in_press,
      last_accessed_on: project.last_accessed_on,
      user_last_accessed_on: project.user_last_accessed_on,
      members: [],
    })
  }

  if (mediaIds.length) {
    const media = await mediaService.getMediaByIds(mediaIds)
    for (const row of media) {
      if (row.media) {
        resultMap.get(row.project_id).media = getMedia(row.media, 'thumbnail')
      }
    }
  }

  if (projectIds.length) {
    const projectUsers = await projectUserService.getUsersInProjects(projectIds)
    for (const projectUser of projectUsers) {
      const projectId = projectUser.project_id
      resultMap.get(projectId).members.push({
        name: projectUser.fname + ' ' + projectUser.lname,
      })
    }
  }

  res.status(200).json({ projects: Array.from(resultMap.values()) })
}

export async function getOverview(req, res) {
  const projectId = req.params.projectId
  const userId = req.user?.user_id
  const summary = await projectService.getProject(projectId)
  // TODO(kenzley): Change this to output the media with the util/media.ts:getMedia method.
  const image_props = await mediaService.getImageProps(
    projectId,
    'small',
    summary.exemplar_media_id
  )
  const projectStats = await projectStatsService.getProjectStats(projectId)
  const recentChangesStats = userId
    ? await projectStatsService.getRecentChangesStats(projectId, userId)
    : null
  const institutions = await institutionService.fetchInstitutions(projectId)
  const taxa = await projectStatsService.getTaxaStats(projectId)
  const members = await projectStatsService.getMembersStats(projectId)
  const overview = {
    ...summary,
    stats: projectStats,
    recent_changes: recentChangesStats,
    institutions: institutions,
    image_props,
    taxa,
    members,
  }
  res.status(200).json({ overview })
}

export async function setCopyright(req, res) {
  const projectId = req.params.projectId
  const project = await models.Project.findByPk(projectId)
  if (project == null) {
    res.status(404).json({ message: 'Project is not found' })
    return
  }

  const transaction = await sequelizeConn.transaction()

  if (req.body.publish_cc0 !== undefined) {
    project.publish_cc0 = req.body.publish_cc0
  }

  await project.save({
    transaction,
    user: req.user,
  })

  await transaction.commit()

  res.status(200).json({ message: 'Project updated' })
}
