import { models } from '../../models/init-models.js'
import { time } from '../../util/util.js'
import sequelizeConn from '../../util/db.js'
import { BaseModelDuplicator } from '../base-model-duplicator.js'
import { EmailManager } from '../email-manager.js'
import { Handler, HandlerErrors } from './handler.js'

/** 
 * A handler to duplicating projects.
 * 
 * @deprecated This task queue handler is kept for backward compatibility with existing queued tasks.
 * New duplication requests are handled directly via ProjectDuplicationService for immediate execution
 * and more reliable S3 file copying. See: src/services/project-duplication-service.js
 */
export class ProjectDuplicationHandler extends Handler {
  async process(parameters) {
    const requestId = parseInt(parameters.request_id)
    const projectDuplicationRequest =
      await models.ProjectDuplicationRequest.findByPk(requestId)
    if (projectDuplicationRequest == null) {
      console.error(`[PROJECT_DUPLICATION] ERROR: Duplication request ${requestId} not found in database`)
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        `Duplication request ${requestId} not found`
      )
    }

    if (projectDuplicationRequest.status != 50) {
      console.error(`[PROJECT_DUPLICATION] ERROR: Duplication request ${requestId} status is ${projectDuplicationRequest.status}, expected 50 (approved)`)
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        `Duplication request ${requestId} not approved (status: ${projectDuplicationRequest.status})`
      )
    }
    


    const userId = projectDuplicationRequest.user_id
    const projectId = projectDuplicationRequest.project_id
    


    const user = await models.User.findByPk(userId)
    if (user == null) {
      console.error(`[PROJECT_DUPLICATION] ERROR: User with ID ${userId} does not exist`)
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        `User with ID ${userId} does not exist`
      )
    }

    const project = await models.Project.findByPk(projectId)
    if (project == null) {
      console.error(`[PROJECT_DUPLICATION] ERROR: Project with ID ${projectId} does not exist`)
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        `Project with ID ${projectId} does not exist`
      )
    }
    



    const transaction = await sequelizeConn.transaction()
    
    try {



      
      const projectDuplicator = new BaseModelDuplicator(models.Project, projectId)
      projectDuplicator.setDuplicatedTables(DUPLICATED_TABLES)
      projectDuplicator.setIgnoredTables(IGNORED_TABLES)
      projectDuplicator.setNumberedTables(NUMBERED_TABLES)
      projectDuplicator.setTransaction(transaction)
      
      // Configure one-time use media handling based on user's choice
      if (projectDuplicationRequest.onetime_use_action !== null && projectDuplicationRequest.onetime_use_action !== undefined) {
        projectDuplicator.setOnetimeUseAction(projectDuplicationRequest.onetime_use_action)

      } else {

      }


      const clonedProjectId = await projectDuplicator.duplicate()

      const clonedProject = await models.Project.findOne({
        where: {
          project_id: clonedProjectId,
        },
        transaction: transaction,
      })
      
      if (!clonedProject) {
        throw new Error(`Cloned project ${clonedProjectId} not found after duplication`)
      }
      

      
      // Prepare update data
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
      


      // Update exemplar media ID if it exists
      if (clonedProject.exemplar_media_id) {

        
        // Check if the exemplar media was actually cloned (might have been filtered due to copyright restrictions)
        if (projectDuplicator.wasRecordCloned(models.MediaFile, clonedProject.exemplar_media_id)) {
          const newExemplarMediaId = projectDuplicator.getDuplicateRecordId(
            models.MediaFile,
            clonedProject.exemplar_media_id
          )
          updateData.exemplar_media_id = newExemplarMediaId

        } else {
          // Exemplar media was filtered out (e.g., due to one-time use copyright restrictions)
          updateData.exemplar_media_id = null

        }
      }

      await clonedProject.update(
        updateData,
        {
          transaction,
          shouldSkipLogChange: true,
        }
      )



      await models.ProjectsXUser.create(
        {
          created_on: time(),
          user_id: userId,
          project_id: clonedProjectId,
        },
        {
          transaction,
          shouldSkipLogChange: true,
        }
      )



      await projectDuplicationRequest.update(
        {
          status: 100 /* Completed */,
          new_project_number: clonedProjectId,
        },
        {
          transaction,
          shouldSkipLogChange: true,
        }
      )


      // Create a new task to generate the project overview stats because we don't
      // want an error from project overview to affect project duplication and also
      // be retryable.

      await models.TaskQueue.create(
        {
          user_id: userId,
          priority: 300,
          entity_key: null,
          row_key: null,
          handler: 'ProjectOverview',
          parameters: {
            project_ids: [clonedProjectId],
          },
        },
        {
          transaction: transaction,
          user: user,
        }
      )


      // TODO(kenzley): We should create an task queue handers to perform other
      // asynchronous actions based on the completion of the duplication. Namely,
      // We should add entries to the task queue to:
      //   * Reindex the entire project to allow search.

      // Create a new task to email the user that the project was successful
      // duplicated.

      await models.TaskQueue.create(
        {
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
        },
        {
          transaction: transaction,
          user: user,
        }
      )



      await transaction.commit()
      

      const emailManager = new EmailManager()
      emailManager.email('project_duplication_request_completed', {
        projectId,
        clonedProjectId,
      })
      

      
      return {
        result: {
          vn_cloned_project_id: clonedProjectId,
        },
      }
    } catch (error) {
      console.error(`[PROJECT_DUPLICATION] ERROR during duplication of project ${projectId}:`, {
        error: error.message,
        stack: error.stack,
        requestId,
        projectId,
        userId
      })
      
      await transaction.rollback()

      
      throw error
    }
  }

  getName() {
    return 'ProjectDuplication'
  }
}

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
]

const NUMBERED_TABLES = new Map([[models.MediaLabel, 'link_id']])
