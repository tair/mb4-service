import sequelizeConn from '../util/db.js'
import { getMedia } from '../util/media.js'
import { models } from '../models/init-models.js'
import { getRoles } from '../services/user-roles-service.js'
import * as institutionService from '../services/institution-service.js'
import * as partitionService from '../services/partition-service.js'
import * as projectService from '../services/projects-service.js'
import * as projectStatsService from '../services/project-stats-service.js'
import * as projectUserService from '../services/project-user-service.js'
import * as mediaService from '../services/media-service.js'
import CipresRequestService from '../services/cipres-request-service.js'
import axios from 'axios'
import { MembershipType } from '../models/projects-x-user.js'

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

export async function getPartitionSummary(req, res) {
  const projectId = req.params.projectId
  const partitionId = req.params.partitionId

  const partition = await models.Partition.findByPk(partitionId)

  const characterCount = await partitionService.getCharacterCount(partitionId)
  const taxaCount = await partitionService.getTaxaCount(partitionId)
  const bibliographicReferenceCount =
    await partitionService.getBibliographiesCount(partitionId, projectId)

  const { medias, viewCount, specimenCount, onetimeMedia } =
    await mediaService.getMediaSpecimensAndViews(projectId, partitionId)

  // functions that require the associated media Ids
  const documentCount = medias.length
    ? await partitionService.getDocumentCount(medias, projectId)
    : 0
  const labelCount = medias.length
    ? await partitionService.getMediaLabelsCount(medias)
    : 0

  const mediaCount = medias.length

  return res.status(200).json({
    partition,
    characterCount,
    taxaCount,
    mediaCount,
    onetimeMedia,
    viewCount,
    specimenCount,
    labelCount,
    documentCount,
    bibliographicReferenceCount,
  })
}

export async function getProjectPartitions(req, res) {
  const projectId = req.params.projectId
  const partitions = await partitionService.getPartitions(projectId)

  return res.status(200).json(partitions)
}

export async function publishPartition(req, res) {
  const partitionId = req.params.partitionId
  const onetimeAction = req.body.onetimeAction

  try {
    const transaction = await sequelizeConn.transaction()
    await models.TaskQueue.create(
      {
        user_id: req.user.user_id,
        priority: 300,
        completed_on: null,
        handler: 'partitionPublish',
        parameters: {
          user_id: req.user.user_id,
          project_id: req.project.project_id,
          partition_id: partitionId,
          onetimeAction: onetimeAction,
        },
      },
      {
        transaction: transaction,
        user: req.user,
      }
    )

    await transaction.commit()
    res.status(200).json({ message: 'success' })
  } catch (e) {
    console.error('Could not process partition publication request\n', e)
    return res
      .status(500)
      .json({ message: 'Could not process partition publication request' })
  }
}

export async function getCuratorProjects(req, res) {
  // Check if the user has curator permissions
  const userAccess = (await getRoles(req.user?.user_id)) || []
  if (!userAccess.includes('curator')) {
    return res.status(200).json({ projects: [] })
  }

  try {
    // Execute the SQL query to retrieve projects
    const projects = await models.Project.findAll({
      // only show projects that are not deleted and not published
      where: { deleted: 0, published: 0 },
      order: [['project_id', 'ASC']],
    })
    res.status(200).json({ projects })
  } catch (error) {
    console.error('Error retrieving curator projects:', error)
    res.status(500).json({ message: 'Error retrieving curator projects' })
  }
}

export async function getJournalList(req, res, next) {
  try {
    const journals = await projectService.getJournalList()
    res.json(journals)
  } catch (error) {
    console.error('Error retrieving journal list:', error)
    res.status(500).json({ message: 'Error retrieving journals' })
  }
}

export async function getJournalCover(req, res, next) {
  try {
    const { journalTitle } = req.query
    if (!journalTitle) {
      return res.status(400).json({ message: 'Journal title is required' })
    }

    const coverPath = projectService.getJournalCoverPath(journalTitle)
    res.json({ coverPath })
  } catch (error) {
    next(error)
  }
}

// Create a new project
export async function createProject(req, res, next) {
  try {
    // Extract data from request body
    const {
      name,
      nsf_funded,
      exemplar_media_id,
      allow_reviewer_login,
      reviewer_login_password,
      journal_title,
      journal_title_other,
      article_authors,
      article_title,
      article_doi,
      journal_year,
      journal_volume,
      journal_url,
      article_pp,
      description,
    } = req.body

    // Validate required fields
    if (!name || !nsf_funded) {
      return res.status(400).json({
        message: 'Project name and NSF funding status are required',
      })
    }

    // Create project with user object for changelog hook
    const project = await models.Project.create(
      {
        name,
        nsf_funded,
        exemplar_media_id,
        allow_reviewer_login,
        reviewer_login_password,
        journal_title: journal_title_other || journal_title,
        article_authors,
        article_title,
        article_doi,
        journal_year,
        journal_volume,
        journal_url,
        article_pp,
        description,
        user_id: req.user.id,
        published: 0,
      },
      {
        user: req.user, // Pass the user object for the changelog hook
      }
    )

    console.log('create project project done')
    // Add user as project admin
    await models.ProjectsXUser.create(
      {
        project_id: project.project_id,
        user_id: req.user.user_id,
        membership_type: MembershipType.ADMIN,
      },
      {
        user: req.user, // Pass the user object for the changelog hook
      }
    )

    res.status(201).json(project)
  } catch (error) {
    console.error('create project error', error)
    next(error)
  }
}

// Helper function to format author names
function getFormattedName(given, family, lastNameFirst = false) {
  let formattedName = ''
  const givenNames = given.split(' ')
  formattedName += givenNames[0].substring(0, 1) + '.'
  formattedName +=
    givenNames.length > 1 ? ' ' + givenNames[1].substring(0, 1) + '. ' : ' '
  formattedName += family
  return formattedName
}

// Retrieve article information from DOI
export async function retrieveDOI(req, res, next) {
  try {
    const { article_doi } = req.body

    if (!article_doi) {
      return res.status(400).json({
        status: 'error',
        errors: ['DOI is required'],
      })
    }

    // Validate DOI format
    if (!article_doi.match(/^10\..*\/\S+$/)) {
      return res.status(400).json({
        status: 'error',
        errors: ['Invalid DOI format'],
      })
    }

    // Call CrossRef API to get article metadata
    const response = await axios.get(
      `https://api.crossref.org/works/${encodeURIComponent(article_doi)}`
    )
    const data = response.data.message

    // Format author names
    const formattedAuthors =
      data.author
        ?.map((author) => {
          return getFormattedName(author.given || '', author.family || '')
        })
        .join(', ') || ''

    // Format the response
    const fields = {
      article_title: data.title?.[0] || '',
      article_authors: formattedAuthors,
      journal_title: data['container-title']?.[0] || '',
      journal_year: data.published?.['date-parts']?.[0]?.[0] || '',
      journal_volume: data.volume || '',
      journal_number: data.issue || '',
      article_pp: data.page || '',
      journal_url: data.URL || `https://doi.org/${article_doi}`,
    }

    res.json({
      status: 'ok',
      fields,
    })
  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({
        status: 'error',
        errors: ['Article not found'],
      })
    }
    next(error)
  }
}

export async function createBulkMediaViews(req, res) {
  try {
    const { projectId } = req.params
    const { name, ...otherData } = req.body

    // Validate project exists and user has access
    const project = await models.Project.findByPk(projectId)
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Check if user has access to the project
    const projectUser = await models.ProjectsXUser.findOne({
      where: {
        project_id: projectId,
        user_id: req.user.id,
      },
    })

    if (!projectUser) {
      return res.status(403).json({ message: 'Access denied' })
    }

    // Split names and create views
    const viewNames = name
      .split(',')
      .map((n) => n.trim())
      .filter((n) => n)

    if (viewNames.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'At least one view name is required',
      })
    }

    const createdViews = []
    for (const viewName of viewNames) {
      const view = await models.MediaView.create({
        project_id: projectId,
        name: viewName,
        ...otherData,
      })
      createdViews.push(view)
    }

    return res.json({
      status: 'ok',
      message: `Successfully created ${createdViews.length} views`,
      views: createdViews,
    })
  } catch (error) {
    console.error('Error creating bulk media views:', error)
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create media views',
    })
  }
}

export async function syncCipresJobs(req, res) {
  let ret = await CipresRequestService.syncCipresJobs()
  res.json({
      status: 'ok',
  })
}
