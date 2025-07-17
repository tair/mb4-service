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
import { FileUploader } from '../lib/file-uploader.js'
import { S3MediaUploader } from '../lib/s3-media-uploader.js'
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
      admin_user_id: project.admin_user_id,
      members: [],
      administrator: null,
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
      const project = resultMap.get(projectId)
      const memberName = projectUser.fname + ' ' + projectUser.lname
      
      // Add to members list
      project.members.push({
        name: memberName,
      })
      
      // Set administrator if this user is the project admin
      if (projectUser.user_id === project.admin_user_id) {
        project.administrator = memberName
      }
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

// Update project information including administrator transfer
export async function updateProject(req, res) {
  const projectId = req.params.projectId
  const project = await models.Project.findByPk(projectId)
  if (project == null) {
    res.status(404).json({ message: 'Project is not found' })
    return
  }

  const transaction = await sequelizeConn.transaction()

  try {
    // Handle administrator transfer (ownership change)
    if (req.body.user_id !== undefined) {
      const newAdminId = parseInt(req.body.user_id)
      
      // Check if the current user has permission to transfer ownership
      const userRoles = await getRoles(req.user.user_id)
      const canTransferOwnership = 
        project.user_id === req.user.user_id ||  // Current project owner
        userRoles.includes('admin') ||           // Global admin
        userRoles.includes('curator')            // Curator

      if (!canTransferOwnership) {
        await transaction.rollback()
        return res.status(403).json({ 
          message: 'Only the project administrator can transfer ownership' 
        })
      }

      // Verify the new administrator exists
      const newAdmin = await models.User.findByPk(newAdminId)
      if (!newAdmin) {
        await transaction.rollback()
        return res.status(404).json({ message: 'New administrator not found' })
      }

      // Transfer ownership
      project.user_id = newAdminId

      // Ensure the new administrator is also a project member with ADMIN privileges
      const existingMembership = await models.ProjectsXUser.findOne({
        where: {
          user_id: newAdminId,
          project_id: projectId,
        },
        transaction,
      })

      if (existingMembership) {
        // Update existing membership to ADMIN
        existingMembership.membership_type = MembershipType.ADMIN
        await existingMembership.save({ transaction, user: req.user })
      } else {
        // Add new administrator as project member
        await models.ProjectsXUser.create(
          {
            project_id: projectId,
            user_id: newAdminId,
            membership_type: MembershipType.ADMIN,
          },
          { transaction, user: req.user }
        )
      }
    }

    // Handle other project field updates
    const updatableFields = [
      'name', 'description', 'nsf_funded', 'exemplar_media_id',
      'allow_reviewer_login', 'reviewer_login_password', 'journal_title',
      'journal_url', 'journal_volume', 'journal_number', 'journal_year',
      'article_authors', 'article_title', 'article_pp', 'article_doi',
      'publish_cc0', 'publish_character_comments', 'publish_cell_comments',
      'publish_change_logs', 'publish_matrix_media_only'
    ]

    for (const field of updatableFields) {
      if (req.body[field] !== undefined) {
        project[field] = req.body[field]
      }
    }

    await project.save({
      transaction,
      user: req.user,
    })

    await transaction.commit()

    res.status(200).json({ message: 'Project updated successfully', project })
  } catch (error) {
    await transaction.rollback()
    console.error('Error updating project:', error)
    res.status(500).json({ message: 'Failed to update project' })
  }
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
    if (!name || nsf_funded === undefined || nsf_funded === null || nsf_funded === '') {
      return res.status(400).json({
        message: 'Project name and NSF funding status are required',
      })
    }
    //merge two changes here adding the current time and the transaction/rollback feature
    const transaction = await sequelizeConn.transaction()
    const currentTime = Math.floor(Date.now() / 1000)

    try {
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
          user_id: req.user.user_id,
          published: 0,
          last_accessed_on: currentTime,
        },
        { transaction, user: req.user }
      )

      await models.ProjectsXUser.create(
        {
          project_id: project.project_id,
          user_id: req.user.user_id,
          membership_type: MembershipType.ADMIN,
          last_accessed_on: currentTime,
        },
        { transaction, user: req.user }
      )

      await transaction.commit()
      res.status(201).json(project)
    } catch (error) {
      await transaction.rollback()
      throw error
    }

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
        user_id: req.user.user_id,
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

// Upload journal cover as a media file
export async function uploadJournalCover(req, res, next) {
  try {
    const { projectId } = req.params
    
    // Validate project exists and user has access
    const project = await models.Project.findByPk(projectId)
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Check if user has access to the project
    const projectUser = await models.ProjectsXUser.findOne({
      where: {
        project_id: projectId,
        user_id: req.user.user_id,
      },
    })

    if (!projectUser) {
      return res.status(403).json({ message: 'Access denied' })
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No journal cover file provided' })
    }

    const transaction = await sequelizeConn.transaction()
    const mediaUploader = new S3MediaUploader(transaction, req.user)
    
    try {
      // Create a new media file record
      const media = await models.MediaFile.create(
        {
          project_id: projectId,
          user_id: req.user.user_id,
          notes: 'Journal cover image',
          published: 0,
          access: 0,
          cataloguing_status: 1,
          media_type: 'image',
        },
        {
          transaction,
          user: req.user,
        }
      )

      // Process and upload the image using S3MediaUploader
      await mediaUploader.setMedia(media, 'media', req.file)
      
      await media.save({
        transaction,
        user: req.user,
        shouldSkipLogChange: true,
      })

      // Update the project to link to this media file
      project.exemplar_media_id = media.media_id
      await project.save({
        transaction,
        user: req.user,
        shouldSkipLogChange: true,
      })

      await transaction.commit()
      mediaUploader.commit()
      
      res.status(200).json({ 
        message: 'Journal cover uploaded successfully',
        media_id: media.media_id,
        project_id: projectId
      })
    } catch (error) {
      await transaction.rollback()
      await mediaUploader.rollback()
      throw error
    }
  } catch (error) {
    console.error('upload journal cover error', error)
    next(error)
  }
}
