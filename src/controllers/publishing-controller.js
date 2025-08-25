import { models } from '../models/init-models.js'
import { getRoles } from '../services/user-roles-service.js'
import * as publishingService from '../services/publishing-service.js'
import { time } from '../util/util.js'
import sequelizeConn from '../util/db.js'
import { processTasks } from '../services/task-queue-service.js'

/**
 * Get publishing preferences form
 * Shows form if citation info is complete, otherwise redirects to project info
 */
export async function getPublishingPreferences(req, res) {
  try {
    const projectId = req.params.projectId
    const project = await models.Project.findByPk(projectId)

    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Check citation completeness first
    const citationValidation = await publishingService.validateCitationInfo(
      project
    )

    if (!citationValidation.isValid) {
      return res.status(200).json({
        redirect: true,
        message: citationValidation.message,
      })
    }

    // Return current publishing preferences
    const publishingFields = {
      project_id: project.project_id,
      publish_cc0: project.publish_cc0,
      nsf_funded: project.nsf_funded,
      extinct_taxa_identified: project.extinct_taxa_identified,
      publish_character_comments: project.publish_character_comments,
      publish_cell_comments: project.publish_cell_comments,
      publish_change_logs: project.publish_change_logs,
      publish_cell_notes: project.publish_cell_notes,
      publish_character_notes: project.publish_character_notes,
      publish_media_notes: project.publish_media_notes,
      publish_matrix_media_only: project.publish_matrix_media_only,
      publish_inactive_members: project.publish_inactive_members,
      no_personal_identifiable_info: project.no_personal_identifiable_info,
    }

    return res.status(200).json({ publishingFields })
  } catch (error) {
    console.error('Error in getPublishingPreferences:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

/**
 * Save publishing preferences
 * Updates project with new publishing settings and prepares for publication
 */
export async function savePublishingPreferences(req, res) {
  try {
    const projectId = req.params.projectId
    const userId = req.user.user_id

    const project = await models.Project.findByPk(projectId)
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Check permissions
    const userRoles = await getRoles(userId)
    const isCurator = userRoles.includes('curator')
    const isAdmin = userRoles.includes('admin')
    const isOwner = project.user_id === userId

    if (!isOwner && !isCurator && !isAdmin) {
      return res
        .status(403)
        .json({ message: 'You cannot change the project information' })
    }

    // Check if project is published and user lacks permissions
    if (project.published === 1 && !isCurator && !isAdmin) {
      return res.status(403).json({
        message:
          'Project is published, you cannot edit the project information.',
      })
    }

    const transaction = await sequelizeConn.transaction()

    try {
      // Update publishing preferences
      const updateData = {}
      const publishingFields = [
        'publish_cc0',
        'nsf_funded',
        'extinct_taxa_identified',
        'publish_character_comments',
        'publish_cell_comments',
        'publish_change_logs',
        'publish_cell_notes',
        'publish_character_notes',
        'publish_media_notes',
        'publish_matrix_media_only',
        'publish_inactive_members',
        'no_personal_identifiable_info',
      ]

      publishingFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field]
        }
      })

      await project.update(updateData, { transaction, user: req.user })

      // Set exemplar media to publish if it exists
      if (project.exemplar_media_id) {
        await sequelizeConn.query(
          'UPDATE media_files SET published = 0 WHERE media_id = ?',
          {
            replacements: [project.exemplar_media_id],
            transaction,
          }
        )
      }

      // Update matrix media flags if publish_matrix_media_only is set
      if (project.publish_matrix_media_only) {
        await publishingService.updateMatrixMediaFlags(
          projectId,
          project.exemplar_media_id,
          transaction
        )
      }

      // Create/update bibliographic reference [TODO: Uncomment]
      // await publishingService.createBibliographicReference(
      //   project,
      //   userId,
      //   transaction
      // )

      await transaction.commit()

      return res.status(200).json({
        message: 'Publishing preferences saved successfully',
        redirect: '/publish/form',
      })
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    console.error('Error in savePublishingPreferences:', error)
    res.status(500).json({ message: 'Error saving publishing preferences' })
  }
}

/**
 * Validate media for publishing
 * Checks if project has media files and validates their copyright information
 */
export async function validateMediaForPublishing(req, res) {
  try {
    const projectId = req.params.projectId
    const project = await models.Project.findByPk(projectId)

    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Check if project has any media
    const hasMedia = await publishingService.hasMediaFiles(projectId)
    if (!hasMedia) {
      return res.status(200).json({
        canPublish: false,
        warning: 'no_media',
        message: 'At least 1 media file is required to publish a project.',
      })
    }

    // Check if project has exemplar media set
    if (!project.exemplar_media_id) {
      return res.status(200).json({
        canPublish: false,
        warning: 'no_exemplar_media',
        message: 'An exemplar media file must be selected for the project.',
      })
    }

    // Verify exemplar media exists and is valid
    const exemplarMedia = await models.MediaFile.findByPk(
      project.exemplar_media_id
    )
    if (!exemplarMedia || exemplarMedia.project_id != projectId) {
      return res.status(200).json({
        canPublish: false,
        warning: 'invalid_exemplar_media',
        message:
          'The selected exemplar media file is invalid or does not exist.',
      })
    }

    // Check for media with incomplete copyright information
    const unfinishedMedia = await publishingService.getUnfinishedMedia(
      projectId,
      project.publish_matrix_media_only
    )

    if (unfinishedMedia.length > 0) {
      const mediaNumbers = unfinishedMedia.map((m) => `M${m.media_id}`)

      // Group media by reason types for better messaging
      const copyrightIssues = unfinishedMedia.filter((m) =>
        m.reasons.some((r) => r.includes('copyright'))
      )
      const missingInfoIssues = unfinishedMedia.filter((m) =>
        m.reasons.some(
          (r) => r.includes('missing_specimen') || r.includes('missing_view')
        )
      )

      let detailedMessage = `The following media files need their information completed: ${mediaNumbers.join(
        ', '
      )}`

      if (copyrightIssues.length > 0) {
        detailedMessage += `. ${copyrightIssues.length} media file(s) have incomplete copyright information`
      }

      if (missingInfoIssues.length > 0) {
        detailedMessage += `. ${missingInfoIssues.length} media file(s) are missing specimen or view information`
      }

      return res.status(200).json({
        canPublish: false,
        warning: 'media_warnings',
        message: detailedMessage,
        unfinishedMedia,
        mediaStats: {
          total: unfinishedMedia.length,
          copyrightIssues: copyrightIssues.length,
          missingInfoIssues: missingInfoIssues.length,
        },
      })
    }

    // All checks passed - ready to publish
    return res.status(200).json({
      canPublish: true,
      message: 'Project is ready for publication',
    })
  } catch (error) {
    console.error('Error in validateMediaForPublishing:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

/**
 * Publish project
 * Main function to publish a project with all validation and side effects
 */
export async function publishProject(req, res) {
  try {
    const projectId = req.params.projectId
    const userId = req.user.user_id

    const project = await models.Project.findByPk(projectId)
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Check permissions
    const userRoles = await getRoles(userId)
    const isCurator = userRoles.includes('curator')
    const isAdmin = userRoles.includes('admin')
    const isOwner = project.user_id === userId

    if (!isOwner && !isCurator && !isAdmin) {
      return res
        .status(403)
        .json({ message: 'You cannot publish this project' })
    }

    // Check if already published
    if (project.published === 1) {
      return res.status(400).json({ message: 'Project is already published' })
    }

    // Attempt to publish
    const publishResult = await publishingService.publishProject(
      projectId,
      userId,
      isCurator || isAdmin
    )

    if (!publishResult.success) {
      return res.status(400).json({
        message: publishResult.message,
        mediaErrors: publishResult.mediaErrors,
      })
    }

    // Schedule asynchronous tasks after successful publication
    try {
      //   // Get the updated project with author info
      const publishedProject = await models.Project.findByPk(projectId)
      // console.log('publishedProject', publishedProject)
      const user = await models.User.findByPk(userId)

      //   // Determine authors for DOI creation
      let authors = publishedProject.article_authors?.trim()
      if (!authors) {
        const projectOwner = await models.User.findByPk(
          publishedProject.user_id
        )
        if (projectOwner) {
          authors = `${projectOwner.fname || ''} ${
            projectOwner.lname || ''
          }`.trim()
        }
        if (!authors && user) {
          authors = `${user.fname || ''} ${user.lname || ''}`.trim()
        }
      }

      // Schedule DOI creation
      await models.TaskQueue.create(
        {
          user_id: userId,
          priority: 300,
          handler: 'DOICreation',
          parameters: {
            project_id: projectId,
            user_id: userId,
            authors: authors,
          },
        },
        {
          user: user,
        }
      )

      // Schedule project overview stats generation
      await models.TaskQueue.create(
        {
          user_id: userId,
          priority: 300,
          handler: 'ProjectOverview',
          parameters: {
            project_ids: [projectId],
          },
        },
        {
          user: user,
        }
      )

      //   // Schedule publication notification email
      const publishedMediaCount =
        await publishingService.getPublishedMediaCount(
          projectId,
          publishedProject.publish_matrix_media_only
        )

      await models.TaskQueue.create(
        {
          user_id: userId,
          priority: 500,
          handler: 'Email',
          parameters: {
            template: 'publication_notification',
            project_id: projectId,
            project_admin: `${user.fname} ${user.lname}, ${user.email}`,
            published_media_count: publishedMediaCount,
          },
        },
        {
          user: user,
        }
      )

      // Process the email task immediately
      await processTasks()

      // Schedule media screenshot notification if needed (>27 media)
      if (publishedMediaCount > 27) {
        await models.TaskQueue.create(
          {
            user_id: userId,
            priority: 500,
            handler: 'Email',
            parameters: {
              template: 'publication_media_notification',
              project_id: projectId,
            },
          },
          {
            user: user,
          }
        )
      }
    } catch (taskError) {
      // Log task scheduling errors but don't fail the publication
      console.error('Error scheduling post-publication tasks:', taskError)
    }

    return res.status(200).json({
      message: 'Project published successfully',
      projectId: projectId,
      publishedOn: time(),
      dumpResult: publishResult.dumpResult,
    })
  } catch (error) {
    console.error('Error in publishProject:', error)
    res.status(500).json({ message: 'Error publishing project' })
  }
}

/**
 * Validate citation info
 * Checks if citation info is complete and returns any warnings
 */
export async function validateCitationInfo(req, res) {
  try {
    const projectId = req.params.projectId
    const project = await models.Project.findByPk(projectId, {
      attributes: [
        'project_id',
        'name',
        'published',
        'published_on',
        'journal_in_press',
        'journal_title',
        'journal_year',
        'journal_url',
        'journal_volume',
        'article_pp',
        'article_title',
        'article_authors',
        'project_doi',
      ],
    })

    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    const citationValidation = await publishingService.validateCitationInfo(
      project
    )

    return res.status(200).json({
      project_id: project.project_id,
      name: project.name,
      published: project.published,
      published_on: project.published_on,
      project_doi: project.project_doi,
      citation_complete: citationValidation.isValid,
      citation_message: citationValidation.message,
    })
  } catch (error) {
    console.error('Error in validateCitationInfo:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

/**
 * Get unpublished items for a project
 * Returns documents, folios, matrices, and media that would be published when project is published
 */
export async function getUnpublishedItems(req, res) {
  try {
    const projectId = req.params.projectId
    const project = await models.Project.findByPk(projectId)

    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Query for unpublished items (published = 0 means "publish when project is published")
    const [documents, folios, matrices, media] = await Promise.all([
      // Documents
      models.ProjectDocument.findAll({
        where: {
          project_id: projectId,
          published: 1, // Will be published when project is published
        },
        attributes: ['document_id', 'title', 'description', 'uploaded_on'],
        order: [['uploaded_on', 'DESC']],
      }),

      // Folios
      models.Folio.findAll({
        where: {
          project_id: projectId,
          published: 1, // Will be published when project is published
        },
        attributes: ['folio_id', 'name', 'description', 'created_on'],
        order: [['created_on', 'DESC']],
      }),

      // Matrices
      models.Matrix.findAll({
        where: {
          project_id: projectId,
          published: 1, // Will be published when project is published
          deleted: 0, // Exclude deleted matrices
        },
        attributes: ['matrix_id', 'title', 'notes', 'created_on'],
        order: [['created_on', 'DESC']],
      }),

      // Media files
      models.MediaFile.findAll({
        where: {
          project_id: projectId,
          published: 1, // Will be published when project is published
        },
        attributes: ['media_id', 'notes', 'created_on'],
        order: [['created_on', 'DESC']],
      }),
    ])

    return res.status(200).json({
      documents: documents.map((doc) => ({
        document_id: doc.document_id,
        title: doc.title,
        description: doc.description,
        uploaded_on: doc.uploaded_on,
      })),
      folios: folios.map((folio) => ({
        folio_id: folio.folio_id,
        name: folio.name,
        description: folio.description,
        created_on: folio.created_on,
      })),
      matrices: matrices.map((matrix) => ({
        matrix_id: matrix.matrix_id,
        title: matrix.title,
        notes: matrix.notes,
        created_on: matrix.created_on,
      })),
      media: media.map((mediaFile) => ({
        media_id: mediaFile.media_id,
        notes: mediaFile.notes,
        created_on: mediaFile.created_on,
      })),
    })
  } catch (error) {
    console.error('Error in getUnpublishedItems:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
}

/**
 * Test route for DOI creation
 * Directly calls the DOI creation handler and returns what it outputs
 */
export async function testDOICreation(req, res) {
  try {
    const project_id = req.params.projectId
    const { user_id, authors } = req.body

    // Validate required parameters
    if (!project_id) {
      return res.status(400).json({
        status: 'error',
        message: 'project_id is required',
      })
    }

    if (!user_id) {
      return res.status(400).json({
        status: 'error',
        message: 'user_id is required',
      })
    }

    // Verify project exists
    const project = await models.Project.findByPk(project_id)
    if (!project) {
      return res.status(404).json({
        status: 'error',
        message: `Project ${project_id} not found`,
      })
    }

    // Verify user exists
    const user = await models.User.findByPk(user_id)
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: `User ${user_id} not found`,
      })
    }

    // Use provided authors or fallback to user name
    let finalAuthors = authors
    if (!finalAuthors) {
      finalAuthors = `${user.fname || ''} ${user.lname || ''}`.trim()
    }

    // Import and directly call the DOI creation handler
    const { DOICreationHandler } = await import(
      '../lib/task-handlers/doi-creation-handler.js'
    )
    const doiHandler = new DOICreationHandler()

    // Call the handler's process method directly with the same parameters
    const handlerResult = await doiHandler.process({
      project_id: project_id,
      user_id: user_id,
      authors: finalAuthors,
    })

    // Get the updated project to see if DOI was created
    const updatedProject = await models.Project.findByPk(project_id)

    // Get matrices to see if matrix DOIs were created
    const matrices = await models.Matrix.findAll({
      where: { project_id: project_id },
      attributes: ['matrix_id', 'title', 'matrix_doi'],
    })

    res.status(200).json({
      status: 'success',
      message: 'DOI creation handler called directly',
      handler_result: handlerResult,
      project: {
        project_id: updatedProject.project_id,
        name: updatedProject.name,
        project_doi: updatedProject.project_doi,
        doi: updatedProject.doi,
      },
      matrices: matrices.map((matrix) => ({
        matrix_id: matrix.matrix_id,
        title: matrix.title,
        matrix_doi: matrix.matrix_doi,
      })),
      parameters_used: {
        project_id: project_id,
        user_id: user_id,
        authors: finalAuthors,
      },
    })
  } catch (error) {
    console.error('Error in testDOICreation:', error)
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
      error: error.message,
      stack: error.stack,
    })
  }
}
