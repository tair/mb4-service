import { models } from '../../models/init-models.js'
import { time } from '../../util/util.js'
import sequelizeConn from '../../util/db.js'
import { BaseModelDuplicator } from '../base-model-duplicator.js'
import { EmailManager } from '../email-manager.js'
import { Handler, HandlerErrors } from './handler.js'

/** A handler to duplicating projects. */
export class ProjectDuplicationHandler extends Handler {
  async process(parameters) {
    const requestId = parseInt(parameters.request_id)
    const projectDuplicationRequest =
      await models.ProjectDuplicationRequest.findByPk(requestId)
    if (projectDuplicationRequest == null) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Duplication request ${requestId} not found'
      )
    }

    if (projectDuplicationRequest.status != 50) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Duplication request ${requestId} not approved'
      )
    }

    const userId = projectDuplicationRequest.user_id
    const projectId = projectDuplicationRequest.project_id

    const user = await models.User.findByPk(userId)
    if (user == null) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'User with ID ${userId} does not exist'
      )
    }

    const project = await models.Project.findByPk(projectId)
    if (project == null) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Project with ID ${projectId} doest not exist'
      )
    }

    const transaction = await sequelizeConn.transaction()

    const projectDuplicator = new BaseModelDuplicator(models.Project, projectId)
    projectDuplicator.setDuplicatedTables(DUPLICATED_TABLES)
    projectDuplicator.setIgnoredTables(IGNORED_TABLES)
    projectDuplicator.setNumberedTables(NUMBERED_TABLES)
    projectDuplicator.setTransaction(transaction)

    const clonedProjectId = await projectDuplicator.duplicate()
    const clonedProject = await models.Project.findOne({
      where: {
        project_id: clonedProjectId,
      },
      transaction: transaction,
    })
    if (clonedProject.exemplar_media_id) {
      const newExemplarMediaId = projectDuplicator.getDuplicateRecordId(
        models.MediaFile,
        clonedProject.exemplar_media_id
      )
      clonedProject.exemplar_media_id = newExemplarMediaId
    }

    await clonedProject.update(
      {
        created_on: time(),
        last_accessed_on: time(),
        user_id: userId,
        group_id: null,
        partition_published_on: null,
        partitioned_from_project_id: null,
        published: 0,
        published_on: null,
      },
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
