import { QueryTypes } from 'sequelize'
import sequelizeConn from '../../util/db.js'
import { Handler, HandlerErrors } from './handler.js'
import { models } from '../../models/init-models.js'
import { PartitionModelDuplicator } from '../partition-model-duplicator.js'
import { time } from '../../util/util.js'

export class PartitionPublishHandler extends Handler {
  constructor() {
    super()
  }

  async process(parameters) {
    const projectId = parseInt(parameters.project_id)
    if (!projectId) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Project ID is not defined'
      )
    }

    const project = await models.Project.findByPk(projectId)
    if (project === null) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Project ${projectId} does not exist'
      )
    }

    const userId = parseInt(parameters.user_id)
    if (!userId) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'User ID is not defined'
      )
    }

    const user = await models.User.findByPk(userId)
    if (user === null) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'User ${userId} does not exist'
      )
    }

    const partitionId = parseInt(parameters.partition_id)
    if (!partitionId) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Partition ID is not defined'
      )
    }

    const partition = await models.Partition.findByPk(partitionId)
    if (partition === null) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Partition ${partitionId} does not exist'
      )
    }

    const overriddenFieldNames = new Map([['user_id', userId]])
    const transaction = await sequelizeConn.transaction()

    const modelDuplicator = new PartitionModelDuplicator(
      models.Project,
      projectId,
      partitionId
    )
    modelDuplicator.setTransaction(transaction)
    modelDuplicator.setDuplicatedTables(DUPLICATED_TABLES)
    modelDuplicator.setIgnoredTables(IGNORED_TABLES)
    modelDuplicator.setNumberedTables(NUMBERED_TABLES)
    modelDuplicator.setOverriddenFieldNames(overriddenFieldNames)
    const clonedProjectId = await modelDuplicator.duplicate()

    const clonedProject = await models.Project.findOne({
      where: {
        project_id: clonedProjectId,
      },
      transaction: transaction,
    })
    if (clonedProject.exemplar_media_id) {
      const newExemplarMediaId = modelDuplicator.getDuplicateRecordId(
        models.MediaFile,
        clonedProject.exemplar_media_id
      )
      clonedProject.exemplar_media_id = newExemplarMediaId
    }

    await clonedProject.update(
      {
        name: clonedProject.name + ` (from P${projectId})`,
        created_on: time(),
        last_accessed_on: time(),
        user_id: userId,
        group_id: null,
        partitioned_from_project_id: projectId,
        ancestor_project_id: projectId,
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

    const [rows] = await sequelizeConn.query(
      'SELECT matrix_id FROM matrices WHERE project_id = ?',
      {
        replacements: [clonedProjectId],
        transaction: transaction,
      }
    )
    for (const row of rows) {
      const matrixId = row.matrix_id
      await sequelizeConn.query(
        `
        UPDATE matrix_taxa_order
        SET position=@tmp_position:=@tmp_position+1
        WHERE matrix_id = ? AND (@tmp_position:=0)+1
        ORDER BY position`,
        {
          replacements: [matrixId],
          transaction: transaction,
          type: QueryTypes.UPDATE,
        }
      )
      await sequelizeConn.query(
        `
        UPDATE matrix_character_order
        SET position=@tmp_position:=@tmp_position+1
        WHERE matrix_id = ? AND (@tmp_position:=0)+1
        ORDER BY position`,
        {
          replacements: [matrixId],
          transaction: transaction,
          type: QueryTypes.UPDATE,
        }
      )
    }

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
    //   * Email the user that the project was completed.

    // Create a new task to email the user that the partition publication was successful
    await models.TaskQueue.create(
      {
        user_id: userId,
        priority: 500,
        entity_key: null,
        row_key: null,
        handler: 'Email',
        parameters: {
          template: 'project_partition_request_approved',
          name: user.fname,
          to: user.email,
          projectId,
          clonedProjectId,
          partitionName: partition.name,
        },
      },
      {
        transaction: transaction,
        user: user,
      }
    )

    await transaction.commit()

    return {
      result: {
        vn_cloned_project_id: clonedProjectId,
      },
    }
  }

  getName() {
    return 'partitionPublish'
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
  models.ProjectDocumentFolder,
  models.ProjectDocument,
  models.BibliographicReference,
  models.CellsXMedium,
  models.CharacterState,
  models.CharactersXMedium,
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
  models.MatrixTaxaOrder,
  models.TaxaXBibliographicReference,
  models.MatrixFileUpload,
  models.MatrixAdditionalBlock,
  models.BibliographicAuthor,
  models.MediaLabel,
  models.MatrixImage,
]

const IGNORED_TABLES = [
  models.Folio,
  models.FoliosXMediaFile,
  models.Partition,
  models.TaxaXPartition,
  models.CharactersXPartition,
  models.User,
  models.ProjectsXUser,
  models.ProjectMemberGroup,
  models.ProjectGroup,
  models.ProjectDuplicationRequest,
  models.CuratorPotentialProject,
  models.CipresRequest,
  models.Institution,
  models.InstitutionsXProject,
  models.InstitutionsXUser,
]

const NUMBERED_TABLES = new Map([[models.MediaLabel, 'link_id']])
