import { models } from '../models/init-models.js'
import { time } from '../util/util.js'
import sequelizeConn from '../util/db.js'
import { BaseModelDuplicator } from '../lib/base-model-duplicator.js'
import { EmailManager } from '../lib/email-manager.js'

/**
 * Service to handle project duplication directly without task queue
 * This ensures S3 files are copied immediately and consistently
 */
export class ProjectDuplicationService {
  
  /**
   * Execute project duplication asynchronously
   * This runs in the background and updates the request status when complete
   * 
   * @param {number} requestId - The duplication request ID
   * @returns {Promise<void>}
   */
  static async executeDuplication(requestId) {
    console.log(`[PROJECT_DUPLICATION_SERVICE] Starting duplication for request ${requestId}`)
    
    let transaction = null
    
    try {
      // Fetch the duplication request
      const projectDuplicationRequest = await models.ProjectDuplicationRequest.findByPk(requestId)
      
      if (!projectDuplicationRequest) {
        console.error(`[PROJECT_DUPLICATION_SERVICE] ERROR: Duplication request ${requestId} not found`)
        return
      }

      if (projectDuplicationRequest.status !== 50) {
        console.error(`[PROJECT_DUPLICATION_SERVICE] ERROR: Request ${requestId} status is ${projectDuplicationRequest.status}, expected 50 (approved)`)
        return
      }

      const userId = projectDuplicationRequest.user_id
      const projectId = projectDuplicationRequest.project_id
      
      console.log(`[PROJECT_DUPLICATION_SERVICE] Duplicating project ${projectId} for user ${userId}`)

      // Validate user exists
      const user = await models.User.findByPk(userId)
      if (!user) {
        console.error(`[PROJECT_DUPLICATION_SERVICE] ERROR: User ${userId} not found`)
        await this.markRequestFailed(requestId, 'User not found')
        return
      }

      // Validate project exists
      const project = await models.Project.findByPk(projectId)
      if (!project) {
        console.error(`[PROJECT_DUPLICATION_SERVICE] ERROR: Project ${projectId} not found`)
        await this.markRequestFailed(requestId, 'Project not found')
        return
      }

      // Start transaction for duplication
      transaction = await sequelizeConn.transaction()
      
      console.log(`[PROJECT_DUPLICATION_SERVICE] Creating duplicator for project ${projectId}`)
      
      // Create and configure the duplicator
      const projectDuplicator = new BaseModelDuplicator(models.Project, projectId)
      projectDuplicator.setDuplicatedTables(DUPLICATED_TABLES)
      projectDuplicator.setIgnoredTables(IGNORED_TABLES)
      projectDuplicator.setNumberedTables(NUMBERED_TABLES)
      projectDuplicator.setTransaction(transaction)
      
      // Configure one-time use media handling
      if (projectDuplicationRequest.onetime_use_action !== null && 
          projectDuplicationRequest.onetime_use_action !== undefined) {
        projectDuplicator.setOnetimeUseAction(projectDuplicationRequest.onetime_use_action)
        console.log(`[PROJECT_DUPLICATION_SERVICE] One-time use action set to: ${projectDuplicationRequest.onetime_use_action}`)
      }

      console.log(`[PROJECT_DUPLICATION_SERVICE] Starting duplication process...`)
      
      // Execute the duplication (this handles S3 copying)
      const clonedProjectId = await projectDuplicator.duplicate()
      
      console.log(`[PROJECT_DUPLICATION_SERVICE] Project duplicated successfully. New project ID: ${clonedProjectId}`)

      // Fetch the cloned project
      const clonedProject = await models.Project.findOne({
        where: { project_id: clonedProjectId },
        transaction
      })
      
      if (!clonedProject) {
        throw new Error(`Cloned project ${clonedProjectId} not found after duplication`)
      }
      
      // Prepare update data for cloned project
      const updateData = {
        created_on: time(),
        last_accessed_on: time(),
        user_id: userId,
        group_id: null,
        partition_published_on: null,
        partitioned_from_project_id: null,
        published: 0,
        published_on: null,
      }
      
      // Update exemplar media ID if it exists and was cloned
      if (clonedProject.exemplar_media_id) {
        if (projectDuplicator.wasRecordCloned(models.MediaFile, clonedProject.exemplar_media_id)) {
          const newExemplarMediaId = projectDuplicator.getDuplicateRecordId(
            models.MediaFile,
            clonedProject.exemplar_media_id
          )
          updateData.exemplar_media_id = newExemplarMediaId
          console.log(`[PROJECT_DUPLICATION_SERVICE] Updated exemplar media ID: ${newExemplarMediaId}`)
        } else {
          updateData.exemplar_media_id = null
          console.log(`[PROJECT_DUPLICATION_SERVICE] Exemplar media was filtered out (one-time use)`)
        }
      }

      // Update the cloned project
      await clonedProject.update(updateData, {
        transaction,
        shouldSkipLogChange: true,
      })

      console.log(`[PROJECT_DUPLICATION_SERVICE] Updated cloned project metadata`)

      // Create project-user association
      await models.ProjectsXUser.create({
        created_on: time(),
        user_id: userId,
        project_id: clonedProjectId,
      }, {
        transaction,
        shouldSkipLogChange: true,
      })

      console.log(`[PROJECT_DUPLICATION_SERVICE] Created project-user association`)

      // Mark the duplication request as completed
      await projectDuplicationRequest.update({
        status: 100, // Completed
        new_project_number: clonedProjectId,
      }, {
        transaction,
        shouldSkipLogChange: true,
      })

      console.log(`[PROJECT_DUPLICATION_SERVICE] Marked duplication request as completed`)

      // Create task for project overview generation
      await models.TaskQueue.create({
        user_id: userId,
        priority: 300,
        entity_key: null,
        row_key: null,
        handler: 'ProjectOverview',
        parameters: {
          project_ids: [clonedProjectId],
        },
      }, {
        transaction,
        user: user,
      })

      console.log(`[PROJECT_DUPLICATION_SERVICE] Queued project overview generation`)

      // Create task for completion email
      await models.TaskQueue.create({
        user_id: userId,
        priority: 500,
        entity_key: null,
        row_key: null,
        handler: 'Email',
        parameters: {
          template: 'project_duplication_request_approved',
          name: user.fname,
          to: user.email,
          clonedProjectId,
        },
      }, {
        transaction,
        user: user,
      })

      console.log(`[PROJECT_DUPLICATION_SERVICE] Queued completion email`)

      // Commit the transaction
      await transaction.commit()
      
      console.log(`[PROJECT_DUPLICATION_SERVICE] Transaction committed successfully`)
      
      // Send immediate completion notification email (outside transaction)
      try {
        const emailManager = new EmailManager()
        await emailManager.email('project_duplication_request_completed', {
          projectId,
          clonedProjectId,
        })
        console.log(`[PROJECT_DUPLICATION_SERVICE] Sent completion notification email`)
      } catch (emailError) {
        console.error(`[PROJECT_DUPLICATION_SERVICE] Failed to send completion email:`, emailError)
        // Don't fail the duplication if email fails
      }
      
      console.log(`[PROJECT_DUPLICATION_SERVICE] ✓ Duplication completed successfully for request ${requestId}. New project: ${clonedProjectId}`)
      
    } catch (error) {
      console.error(`[PROJECT_DUPLICATION_SERVICE] ✗ ERROR during duplication of request ${requestId}:`, {
        error: error.message,
        stack: error.stack,
        requestId
      })
      
      // Rollback transaction if it exists
      if (transaction) {
        try {
          await transaction.rollback()
          console.log(`[PROJECT_DUPLICATION_SERVICE] Transaction rolled back`)
        } catch (rollbackError) {
          console.error(`[PROJECT_DUPLICATION_SERVICE] Error rolling back transaction:`, rollbackError)
        }
      }
      
      // Mark the request as failed
      await this.markRequestFailed(requestId, error.message)
    }
  }
  
  /**
   * Mark a duplication request as failed
   * 
   * @param {number} requestId - The request ID
   * @param {string} errorMessage - The error message
   */
  static async markRequestFailed(requestId, errorMessage) {
    try {
      const request = await models.ProjectDuplicationRequest.findByPk(requestId)
      if (request) {
        await request.update({
          status: 150, // Failed status
          notes: `Duplication failed: ${errorMessage}`,
        }, {
          shouldSkipLogChange: true,
        })
        console.log(`[PROJECT_DUPLICATION_SERVICE] Marked request ${requestId} as failed`)
      }
    } catch (updateError) {
      console.error(`[PROJECT_DUPLICATION_SERVICE] Failed to mark request ${requestId} as failed:`, updateError)
    }
  }
}

// Configuration for duplication - same as in ProjectDuplicationHandler
const DUPLICATED_TABLES = [
  models.Project,
  models.Specimen,
  models.MediaView,
  models.MediaFile,
  models.Matrix,
  models.MatrixImage,
  models.CharacterOrdering,
  models.Character,
  models.Taxon,
  models.Folio,
  models.ProjectDocumentFolder,
  models.ProjectDocument,
  models.BibliographicReference,
  models.Partition,
  models.CellsXMedium,
  models.CharacterState,
  models.CharactersXMedium,
  models.FoliosXMediaFile,
  models.MediaFilesXBibliographicReference,
  models.TaxaXMedium,
  models.MediaFilesXDocument,
  models.TaxaXSpecimen,
  models.SpecimensXBibliographicReference,
  models.Cell,
  models.MatrixCharacterOrder,
  models.CellNote,
  models.CellsXBibliographicReference,
  models.CharactersXBibliographicReference,
  models.CharacterRule,
  models.CharacterRuleAction,
  models.CharactersXPartition,
  models.MatrixTaxaOrder,
  models.TaxaXBibliographicReference,
  models.TaxaXPartition,
  models.MatrixFileUpload,
  models.MatrixAdditionalBlock,
  models.BibliographicAuthor,
  models.MediaLabel,
]

const IGNORED_TABLES = [
  models.CipresRequest,
  models.User,
  models.ProjectsXUser,
  models.ProjectMemberGroup,
  models.ProjectGroup,
  models.ProjectDuplicationRequest,
  models.CuratorPotentialProject,
  models.Institution,
  models.InstitutionsXProject,
  models.InstitutionsXUser,
  models.ProjectsXOrcidWork,
  models.FeaturedProject,
]

const NUMBERED_TABLES = new Map([[models.MediaLabel, 'link_id']])

