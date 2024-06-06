import sequelizeConn from '../util/db.js'
import { getMedia } from '../util/media.js'
import { models } from '../models/init-models.js'
import * as institutionService from '../services/institution-service.js'
import * as partitionService from '../services/partition-service.js'
import * as projectService from '../services/projects-service.js'
import * as projectStatsService from '../services/project-stats-service.js'
import * as projectUserService from '../services/project-user-service.js'
import { PartitionPublishHandler } from '../lib/task-handlers/partition-publish-handler.js'
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

export async function createDuplicationRequest(req, res) {
  const projectId = req.params.projectId
  const remarks = req.body.remarks
  const onetimeAction = req.body.onetimeAction

  try {
    const transaction = await sequelizeConn.transaction()
    await models.ProjectDuplicationRequest.create(
      {
        project_id: projectId,
        request_remarks: remarks,
        status: 1,
        user_id: req.user.user_id,
        onetime_use_action: onetimeAction,
        notes: remarks,
      },
      { transaction }
    )

    await transaction.commit()
    res.status(200)
  } catch (e) {
    console.error('Error making duplication request', e)
    res.status(500).json({ message: 'Could not create duplication request' })
  }
}

export async function getDuplicationRequestCriteria(req, res) {
  const projectId = req.params.projectId

  const oneTimeMedia = await mediaService.getOneTimeMediaFiles(projectId)

  const project = req.project
  const projectPublished = project.published == 1
  const hasAccess = project.permissions.includes('edit')

  res.status(200).json({ oneTimeMedia, projectPublished, hasAccess })
}

export async function partitionCreation(req, res) {
  // get project
  const project = req.project

  // check if not deleted
  if (project.deleted != 0) {
    return res.status(404)
  }

  // action can't be done by non (curator and admin) // check can do action function

  // check if not published

  // set user access time?

  // get project
}

export async function partitionSummary(req, res) {
  // get partition id
  const partitionId = req.params.partitionId

  // get partition
  const partition = await models.Partition.findByPk(partitionId)

  // check association between partition and project

  // get character, media, view, media labels, specimens, documents, taxa, and bib references
  const characters = await models.Ch

  // get onetime medias

  // send variables (id, partition, project, and array back to view)
}
export async function getProjectPartitions(req, res) {
  const projectId = req.params.projectId
  const partitions = await partitionService.getPartitions(projectId)
  console.log(partitions)

  return res.status(200).json(partitions)
}

export async function publishPartition(req, res) {
  // get partition id then retrieve the partition
  const partitionId = req.body.partitionId

  if (partitionId == null) {
    return res.status(404)
  }

  const partition = models.Partition.findByPk(partitionId)

  // check if partititon has BOTH taxon and characters
  const taxonIds = partitionService.getTaxaInPartitions(partition.partition_id)
  const characterIds = partitionService.getCharactersInPartitions(
    partition.partition_id
  )
  if (taxonIds.length == 0 || characterIds.length == 0) {
    // A partiton must have both characters and taxa to publish
    return res.status(500)
  }

  // create new instance of task queue and assign (partiton_id, project_id, and user_id)
  try {
    transaction = sequelizeConn.transaction()
    await models.TaskQueue.create(
      {
        user_id: req.user.userId,
        // what values do I enter for row_key and entity_key ( or table_num and row_id)
        priority: 300,
        entity_key: null,
        row_key: null,
        handler: 'partitionPublish',
        parameters: {
          project_id: req.project.project_id,
        },
      },
      {
        transaction: transaction,
        user: req.user,
      }
    )

    await transaction.commit()
    res.status(200)
  } catch (e) {
    console.error('Could not process partition publication request')
    res
      .status(500)
      .json({ message: 'Could not process partition publication request' })
  }

  // return project , partition, and render of array?
}
