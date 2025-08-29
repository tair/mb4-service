import sequelizeConn from '../util/db.js'
import { getMedia } from '../util/media.js'
import { time } from '../util/util.js'
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
import { SDDExporter } from '../lib/project-export/sdd-exporter.js'
import axios from 'axios'
import { MembershipType } from '../models/projects-x-user.js'
import { EmailManager } from '../lib/email-manager.js'

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
      exemplar_media_id: project.exemplar_media_id,
      members: [],
      administrator: null,
    })
  }

  if (mediaIds.length) {
    const media = await mediaService.getMediaByIds(mediaIds)
    for (const row of media) {
      if (row.media) {
        const project = resultMap.get(row.project_id)
        if (project) {
          project.media = getMedia(row.media, 'thumbnail')
        }
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
        project.user_id === req.user.user_id || // Current project owner
        userRoles.includes('admin') || // Global admin
        userRoles.includes('curator') // Curator

      if (!canTransferOwnership) {
        await transaction.rollback()
        return res.status(403).json({
          message: 'Only the project administrator can transfer ownership',
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
      'name',
      'description',
      'nsf_funded',
      'exemplar_media_id',
      'allow_reviewer_login',
      'reviewer_login_password',
      'journal_title',
      'journal_url',
      'journal_volume',
      'journal_number',
      'journal_year',
      'article_authors',
      'article_title',
      'article_pp',
      'article_doi',
      'publish_cc0',
      'publish_character_comments',
      'publish_cell_comments',
      'publish_change_logs',
      'publish_matrix_media_only',
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

// Edit an existing project with optional file uploads
export async function editProject(req, res, next) {
  try {
    const projectId = req.params.projectId

    // Extract data from request body - handle both JSON and FormData
    let projectData = req.body

    // If projectData is a JSON string (from FormData), parse it
    if (req.body.projectData) {
      try {
        projectData = JSON.parse(req.body.projectData)
      } catch (parseError) {
        return res.status(400).json({
          message: 'Invalid project data format',
        })
      }
    }

    const project = await models.Project.findByPk(projectId)
    if (project == null) {
      res.status(404).json({ message: 'Project is not found' })
      return
    }

    const {
      name,
      nsf_funded,
      allow_reviewer_login,
      reviewer_login_password,
      journal_title,
      journal_title_other,
      article_authors,
      article_title,
      article_doi,
      journal_year,
      journal_volume,
      journal_number,
      journal_url,
      article_pp,
      description,
      disk_space_usage,
      publication_status,
      exemplar_media_id,
    } = projectData

    // Only validate required fields if this is a full project update (not just exemplar media update)
    const isOnlyExemplarUpdate =
      Object.keys(projectData).length === 1 &&
      'exemplar_media_id' in projectData

    if (!isOnlyExemplarUpdate) {
      // Validate required fields for full project updates
      if (
        !name ||
        nsf_funded === undefined ||
        nsf_funded === null ||
        nsf_funded === ''
      ) {
        return res.status(400).json({
          message: 'Project name and NSF funding status are required',
        })
      }
    }

    // Validate journal fields based on publication status
    if (publication_status === '0' || publication_status === '1') {
      // Published or In press - require basic journal fields
      const requiredFields = [
        'description',
        'article_authors',
        'article_title',
        'journal_year',
      ]

      if (!journal_title && !journal_title_other) {
        return res.status(400).json({
          message:
            'Journal title is required for published or in-press articles',
        })
      }

      for (const field of requiredFields) {
        const value = projectData[field]
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          return res.status(400).json({
            message: `${field.replace(
              /_/g,
              ' '
            )} is required for published or in-press articles`,
          })
        }
      }

      // Additional fields required only for Published status
      if (publication_status === '0') {
        const publishedRequiredFields = [
          'journal_url',
          'journal_volume',
          'article_pp',
        ]

        for (const field of publishedRequiredFields) {
          const value = projectData[field]
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            return res.status(400).json({
              message: `${field.replace(
                /_/g,
                ' '
              )} is required for published articles`,
            })
          }
        }
      }
    }

    const transaction = await sequelizeConn.transaction()
    let mediaUploader = null

    try {
      // Only update basic project fields if this is not just an exemplar update
      if (!isOnlyExemplarUpdate) {
        // Update basic project fields
        project.name = name
        project.nsf_funded = nsf_funded
        project.allow_reviewer_login = allow_reviewer_login
        project.reviewer_login_password = reviewer_login_password
        project.journal_title = journal_title_other || journal_title
        project.article_authors = article_authors
        project.article_title = article_title
        project.article_doi = article_doi
        project.journal_year = journal_year
        project.journal_volume = journal_volume
        project.journal_number = journal_number
        project.journal_url = journal_url
        project.article_pp = article_pp
        project.description = description
        project.disk_usage_limit =
          disk_space_usage || project.disk_usage_limit || 5368709120
        project.journal_in_press = publication_status || 2
      }

      // Update exemplar_media_id if provided
      if (exemplar_media_id !== undefined) {
        // Validate that the media exists and belongs to this project if setting an ID
        if (exemplar_media_id) {
          const media = await models.MediaFile.findOne({
            where: {
              media_id: exemplar_media_id,
              project_id: project.project_id,
            },
          })
          if (!media) {
            await transaction.rollback()
            return res.status(400).json({
              message:
                'Invalid exemplar media ID or media does not belong to this project',
            })
          }
        }
        project.exemplar_media_id = exemplar_media_id || null
      }

      // Handle file uploads if provided
      let journalCoverFile = req.files?.journal_cover?.[0]
      let exemplarMediaFile = req.files?.exemplar_media?.[0]

      // Ensure files are valid and not empty placeholders
      // This prevents bad request errors when user wants to keep existing images
      if (
        journalCoverFile &&
        (!journalCoverFile.originalname || journalCoverFile.size === 0)
      ) {
        journalCoverFile = null
      }
      if (
        exemplarMediaFile &&
        (!exemplarMediaFile.originalname || exemplarMediaFile.size === 0)
      ) {
        exemplarMediaFile = null
      }

      // Handle journal cover upload
      if (journalCoverFile) {
        mediaUploader = new S3MediaUploader(transaction, req.user)

        // Create a new media file record for journal cover
        const journalCoverMedia = await models.MediaFile.create(
          {
            project_id: project.project_id,
            user_id: req.user.user_id,
            notes: 'Journal cover image',
            published: 0,
            access: 0,
            cataloguing_status: 0, // Journal covers should NOT go to curation
            media_type: 'image',
          },
          {
            transaction,
            user: req.user,
          }
        )

        // Process and upload the journal cover image
        await mediaUploader.setMedia(
          journalCoverMedia,
          'media',
          journalCoverFile
        )

        await journalCoverMedia.save({
          transaction,
          user: req.user,
          shouldSkipLogChange: true,
        })

        // Update the project's journal_cover field (JSON field)
        project.journal_cover = {
          media_id: journalCoverMedia.media_id,
          filename: journalCoverFile.originalname,
        }

        // Commit the media uploader
        mediaUploader.commit()
      }

      // Handle exemplar media upload
      if (exemplarMediaFile) {
        if (!mediaUploader) {
          mediaUploader = new S3MediaUploader(transaction, req.user)
        }

        // Create a new media file record for exemplar media
        const exemplarMedia = await models.MediaFile.create(
          {
            project_id: project.project_id,
            user_id: req.user.user_id,
            notes: 'Exemplar media',
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

        // Process and upload the exemplar media
        await mediaUploader.setMedia(exemplarMedia, 'media', exemplarMediaFile)

        await exemplarMedia.save({
          transaction,
          user: req.user,
          shouldSkipLogChange: true,
        })

        // Update the project to link to this exemplar media
        project.exemplar_media_id = exemplarMedia.media_id

        // Commit the media uploader
        mediaUploader.commit()
      }

      // Save the updated project
      await project.save({
        transaction,
        user: req.user,
      })

      await transaction.commit()

      // Return the updated project with media info if files were uploaded
      const response = { ...project.toJSON() }
      if (journalCoverFile) {
        response.journal_cover_uploaded = true
      }
      if (exemplarMediaFile) {
        response.exemplar_media_uploaded = true
        response.exemplar_media_id = project.exemplar_media_id
      }

      res
        .status(200)
        .json({ message: 'Project updated successfully', project: response })
    } catch (error) {
      await transaction.rollback()
      if (mediaUploader) {
        await mediaUploader.rollback()
      }
      console.error('Error updating project:', error)
      res.status(500).json({ message: 'Failed to update project' })
    }
  } catch (error) {
    console.error('Error in editProject:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

export async function createDuplicationRequest(req, res) {
  const projectId = req.params.projectId
  const remarks = req.body.remarks
  const onetimeAction = req.body.onetimeAction

  try {
    const transaction = await sequelizeConn.transaction()

    // Get project details for email
    const project = await models.Project.findByPk(projectId)
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Get user details for email
    const user = await models.User.findByPk(req.user.user_id)
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const duplicationRequest = await models.ProjectDuplicationRequest.create(
      {
        project_id: projectId,
        request_remarks: remarks,
        status: 1,
        user_id: req.user.user_id,
        onetime_use_action: onetimeAction,
        notes: '', // Empty string for curator notes
        new_project_number: '0', // Placeholder - will be updated when duplication is completed
      },
      { transaction, user: req.user }
    )

    await transaction.commit()

    // Send email notification to curators
    try {
      const emailManager = new EmailManager()
      const requesterName =
        `${user.fname || ''} ${user.lname || ''}`.trim() || user.email

      const emailParams = {
        requester: requesterName,
        userEmailAddress: user.email,
        projectId: projectId,
        projectName: project.name || `Project ${projectId}`,
        note: remarks,
      }

      await emailManager.email('project_duplication_request', emailParams)
    } catch (emailError) {
      console.error('Error sending duplication request email:', emailError)
      // Don't fail the request if email fails, just log the error
    }

    res.status(200).json({
      success: true,
      message: 'Duplication request submitted successfully',
      requestId: duplicationRequest.request_id,
    })
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

// Create a new project with optional journal cover upload
// Delete a project (soft delete by setting deleted = 1)
export async function deleteProject(req, res, next) {
  try {
    const projectId = req.params.projectId
    const project = await models.Project.findByPk(projectId)

    if (project == null) {
      res.status(404).json({ message: 'Project is not found' })
      return
    }

    // Check if user has permission to delete this project
    // Only project owner or admin can delete
    if (project.user_id !== req.user.user_id && !req.user.is_admin) {
      res.status(403).json({ message: 'Not authorized to delete this project' })
      return
    }

    // Check if project is already deleted
    if (project.deleted) {
      res.status(400).json({ message: 'Project is already deleted' })
      return
    }

    const transaction = await sequelizeConn.transaction()
    try {
      // Soft delete by setting deleted = 1
      await project.update(
        {
          deleted: 1,
          last_accessed_on: time(),
        },
        {
          transaction,
          user: req.user,
        }
      )

      await transaction.commit()

      res.status(200).json({
        message: 'Project deleted successfully',
        project_id: projectId,
      })
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    console.error('Error deleting project:', error)
    res.status(500).json({
      message: 'Failed to delete project',
      error: error.message,
    })
  }
}

export async function createProject(req, res, next) {
  try {
    // Extract data from request body - handle both JSON and FormData
    let projectData = req.body

    // If projectData is a JSON string (from FormData), parse it
    if (req.body.projectData) {
      try {
        projectData = JSON.parse(req.body.projectData)
      } catch (parseError) {
        return res.status(400).json({
          message: 'Invalid project data format',
        })
      }
    }

    const {
      name,
      nsf_funded,
      allow_reviewer_login,
      reviewer_login_password,
      journal_title,
      journal_title_other,
      article_authors,
      article_title,
      article_doi,
      journal_year,
      journal_volume,
      journal_number,
      journal_url,
      article_pp,
      description,
      disk_space_usage,
      publication_status,
    } = projectData

    // Validate required fields
    if (
      !name ||
      nsf_funded === undefined ||
      nsf_funded === null ||
      nsf_funded === ''
    ) {
      return res.status(400).json({
        message: 'Project name and NSF funding status are required',
      })
    }

    // Validate journal fields based on publication status
    if (publication_status === '0' || publication_status === '1') {
      // Published or In press - require basic journal fields
      const requiredFields = [
        'description',
        'article_authors',
        'article_title',
        'journal_year',
      ]

      if (!journal_title && !journal_title_other) {
        return res.status(400).json({
          message:
            'Journal title is required for published or in-press articles',
        })
      }

      for (const field of requiredFields) {
        const value = projectData[field]
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          return res.status(400).json({
            message: `${field.replace(
              /_/g,
              ' '
            )} is required for published or in-press articles`,
          })
        }
      }

      // Additional fields required only for Published status
      if (publication_status === '0') {
        const publishedRequiredFields = [
          'journal_url',
          'journal_volume',
          'article_pp',
        ]

        for (const field of publishedRequiredFields) {
          const value = projectData[field]
          if (!value || (typeof value === 'string' && value.trim() === '')) {
            return res.status(400).json({
              message: `${field.replace(
                /_/g,
                ' '
              )} is required for published articles`,
            })
          }
        }
      }
    }
    // For publication_status === '2' (Article in prep or in review), no journal fields are required

    const transaction = await sequelizeConn.transaction()
    const currentTime = Math.floor(Date.now() / 1000)
    let mediaUploader = null

    try {
      // Create the project first
      const project = await models.Project.create(
        {
          name,
          nsf_funded,
          allow_reviewer_login,
          reviewer_login_password,
          journal_title: journal_title_other || journal_title,
          article_authors,
          article_title,
          article_doi,
          journal_year,
          journal_volume,
          journal_number,
          journal_url,
          article_pp,
          description,
          disk_usage_limit: disk_space_usage || 5368709120, // Default 5GB in bytes
          journal_in_press: publication_status || 2, // Default to "Article in prep or in review"
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

      // Handle file uploads if provided
      let journalCoverFile = req.files?.journal_cover?.[0]
      let exemplarMediaFile = req.files?.exemplar_media?.[0]

      // Ensure files are valid and not empty placeholders
      // This prevents bad request errors when user wants to keep existing images
      if (
        journalCoverFile &&
        (!journalCoverFile.originalname || journalCoverFile.size === 0)
      ) {
        journalCoverFile = null
      }
      if (
        exemplarMediaFile &&
        (!exemplarMediaFile.originalname || exemplarMediaFile.size === 0)
      ) {
        exemplarMediaFile = null
      }

      // Handle journal cover upload
      if (journalCoverFile) {
        mediaUploader = new S3MediaUploader(transaction, req.user)

        // Create a new media file record for journal cover
        const journalCoverMedia = await models.MediaFile.create(
          {
            project_id: project.project_id,
            user_id: req.user.user_id,
            notes: 'Journal cover image',
            published: 0,
            access: 0,
            cataloguing_status: 0, // Journal covers should NOT go to curation
            media_type: 'image',
          },
          {
            transaction,
            user: req.user,
          }
        )

        // Process and upload the journal cover image
        await mediaUploader.setMedia(
          journalCoverMedia,
          'media',
          journalCoverFile
        )

        await journalCoverMedia.save({
          transaction,
          user: req.user,
          shouldSkipLogChange: true,
        })

        // Update the project's journal_cover field (JSON field)
        project.journal_cover = {
          media_id: journalCoverMedia.media_id,
          filename: journalCoverFile.originalname,
        }

        // Commit the media uploader
        mediaUploader.commit()
      }

      // Handle exemplar media upload
      if (exemplarMediaFile) {
        if (!mediaUploader) {
          mediaUploader = new S3MediaUploader(transaction, req.user)
        }

        // Create a new media file record for exemplar media
        const exemplarMedia = await models.MediaFile.create(
          {
            project_id: project.project_id,
            user_id: req.user.user_id,
            notes: 'Exemplar media',
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

        // Process and upload the exemplar media
        await mediaUploader.setMedia(exemplarMedia, 'media', exemplarMediaFile)

        await exemplarMedia.save({
          transaction,
          user: req.user,
          shouldSkipLogChange: true,
        })

        // Update the project to link to this exemplar media
        project.exemplar_media_id = exemplarMedia.media_id

        // Commit the media uploader
        mediaUploader.commit()
      }

      // Save project if any fields were updated
      if (journalCoverFile || exemplarMediaFile) {
        await project.save({
          transaction,
          user: req.user,
          shouldSkipLogChange: true,
        })
      }

      await transaction.commit()

      // Return the project with media info if files were uploaded
      const response = { ...project.toJSON() }
      if (journalCoverFile) {
        response.journal_cover_uploaded = true
      }
      if (exemplarMediaFile) {
        response.exemplar_media_uploaded = true
        response.exemplar_media_id = project.exemplar_media_id
      }

      res.status(201).json(response)
    } catch (error) {
      await transaction.rollback()
      if (mediaUploader) {
        await mediaUploader.rollback()
      }
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

/**
 * Download project as SDD (Structured Descriptive Data) XML or ZIP with media
 */
export async function downloadProjectSDD(req, res) {
  try {
    const { projectId } = req.params
    const { partitionId, format = 'xml' } = req.query
    const userId = req.user?.user_id

    // Validate access using service function
    const { hasAccess, project, partition } =
      await projectService.validateProjectSDDAccess(
        projectId,
        userId,
        partitionId
      )

    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' })
    }

    if (partitionId && !partition) {
      return res.status(404).json({ message: 'Partition not found' })
    }

    console.log(
      `Starting SDD export for project ${projectId}${
        partitionId ? ` with partition ${partitionId}` : ''
      } in ${format} format`
    )

    // Create progress callback for logging
    const progressCallback = (progress) => {
      console.log(
        `[Project ${projectId}] ${progress.stage}: ${progress.message} (${progress.overallProgress}%)`
      )
    }

    // Create SDD exporter with progress tracking
    const exporter = new SDDExporter(projectId, partitionId, progressCallback)
    const projectName = project.name.replace(/[^a-zA-Z0-9]/g, '_')

    if (format === 'zip') {
      // Generate ZIP archive with SDD XML and media files
      const filename = `${projectName}_morphobank.zip`

      // Set headers for ZIP download
      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')

      // Set timeout for large downloads
      req.setTimeout(1800000) // 30 minutes
      res.setTimeout(1800000)

      // Stream ZIP directly to response
      await exporter.exportAsZip(res)

      console.log(`SDD ZIP export completed for project ${projectId}`)
    } else {
      // Generate XML only
      const sddXml = await exporter.export()
      const filename = `${projectName}_sdd.xml`

      // Set headers for XML download
      res.setHeader('Content-Type', 'application/xml')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.setHeader('Cache-Control', 'no-cache')

      console.log(`SDD XML export completed for project ${projectId}`)

      // Send the XML content
      res.send(sddXml)
    }
  } catch (error) {
    console.error('Error generating SDD export:', error)

    // If response hasn't been sent yet, send error
    if (!res.headersSent) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to generate SDD export',
        error: error.message,
      })
    }
  }
}
