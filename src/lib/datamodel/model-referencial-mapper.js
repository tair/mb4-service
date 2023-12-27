import { models } from '../../models/init-models.js'
import sequelizeConn from '../../util/db.js'
import { Datamodel } from './datamodel.js'
import { TABLE_NUMBERS } from '../table-number.js'

export class ModelRefencialMapper {
  constructor(config, transaction, user) {
    this.config = config
    this.transaction = transaction
    this.user = user
  }

  async getUsageCount(ids) {
    const datamodel = Datamodel.getInstance()
    const primaryKey = datamodel.getPrimaryKey(this.config.getBaseModel())
    const models = this.config.getModels()
    const counts = {}
    for (const model of models) {
      const tableName = model.getTableName()
      const tableNumber = TABLE_NUMBERS[tableName]
      const [rows] = await sequelizeConn.query(
        `
          SELECT ${primaryKey}, COUNT(*) AS c
          FROM ${tableName}
          WHERE ${primaryKey} IN (?)
          GROUP BY ${primaryKey}`,
        { replacements: [ids] }
      )

      for (const row of rows) {
        const id = row[primaryKey]
        if (!(id in counts)) {
          counts[id] = {}
        }
        counts[id][tableNumber] = row.c
      }
    }
    return counts
  }

  async getUsages(model, id, remappedId) {
    const datamodel = Datamodel.getInstance()
    const modelPrimaryKey = datamodel.getPrimaryKey(model)
    const baseModelColumnName = this.config.getBaseModelColumName()
    const tableName = model.getTableName()
    const column = this.config.getModelColumnName(model)
    const [rows] = await sequelizeConn.query(
      `
        SELECT ${modelPrimaryKey}
        FROM ${tableName}
        WHERE ${baseModelColumnName} = ?
        AND ${column} NOT IN(
          SELECT ${column}
          FROM ${tableName}
          WHERE ${baseModelColumnName} = ?
        )
      `,
      {
        replacements: [id, remappedId],
        transaction: this.transaction,
      }
    )
    return rows.map((row) => parseInt(row[modelPrimaryKey]))
  }

  async moveReferences(remapIds) {
    const datamodel = Datamodel.getInstance()

    // This will move all references excluding ones that already have records in
    // remapIds.
    const models = this.config.getModels()
    for (const model of models) {
      const baseModelColumnName = this.config.getBaseModelColumName(model)
      const primaryKey = datamodel.getPrimaryKey(model)
      for (const [id, remapId] of remapIds.entries()) {
        const linkIds = await this.getUsages(model, id, remapId)
        if (linkIds.length == 0) {
          continue
        }

        await model.update(
          { [baseModelColumnName]: remapId },
          {
            where: { [primaryKey]: linkIds },
            transaction: this.transaction,
            individualHooks: true,
            user: this.user,
          }
        )
      }
    }

    // This will move all referenceds simply by updating ids to remapIds.
    const referencedModels = this.config.getReferencedModels()
    for (const model of referencedModels) {
      const baseModelColumnName = this.config.getBaseModelColumName(model)
      for (const [id, remapId] of remapIds.entries()) {
        await model.update(
          { [baseModelColumnName]: remapId },
          {
            where: {
              [baseModelColumnName]: id,
            },
            transaction: this.transaction,
            individualHooks: true,
            user: this.user,
          }
        )
      }
    }

    // This will move all referenceds simply by updating ids to remapIds for
    // numbered tables references.
    const numericLinkingModels = this.config.getNumericReferencedModels()
    for (const model of numericLinkingModels) {
      const tableNumber = TABLE_NUMBERS[model.getTableName()]
      const baseModelColumnName = this.config.getBaseModelColumName(model)
      for (const [id, remapId] of remapIds.entries()) {
        await model.update(
          { [baseModelColumnName]: remapId },
          {
            where: {
              table_num: tableNumber,
              [baseModelColumnName]: id,
            },
            transaction: this.transaction,
            individualHooks: true,
            user: this.user,
          }
        )
      }
    }
  }
}

class TaxaConfig {
  getBaseModel() {
    return models.Taxon
  }

  getModels() {
    return [
      models.TaxaXMedium,
      models.TaxaXSpecimen,
      models.TaxaXBibliographicReference,
      models.TaxaXPartition,
      models.MatrixTaxaOrder,
    ]
  }

  getReferencedModels() {
    return [
      models.Cell,
      models.CellsXMedium,
      models.CellNote,
      models.CellsXBibliographicReference,
    ]
  }

  getNumericReferencedModels() {
    return [models.Annotation]
  }

  /**
   * This is a column name for the foreign key to the base model. For the 'taxa'
   * table this may be 'taxon_id' which is the primary key for the 'taxa' table.
   */
  getBaseModelColumName(model) {
    switch (model) {
      case models.Annotation:
        return 'subspecifier_id'
      default:
        return 'taxon_id'
    }
  }

  getModelColumnName(model) {
    switch (model) {
      case models.TaxaXMedium:
        return 'media_id'
      case models.TaxaXSpecimen:
        return 'specimen_id'
      case models.TaxaXBibliographicReference:
        return 'reference_id'
      case models.TaxaXPartition:
        return 'partition_id'
      case models.MatrixTaxaOrder:
        return 'matrix_id'
      default:
        return null
    }
  }
}

class BibliographicReferencesConfig {
  getBaseModel() {
    return models.BibliographicReference
  }

  getModels() {
    return [
      models.MediaFilesXBibliographicReference,
      models.SpecimensXBibliographicReference,
      models.TaxaXBibliographicReference,
      models.CharactersXBibliographicReference,
      models.CellsXBibliographicReference,
    ]
  }

  getReferencedModels() {
    return []
  }

  getNumericReferencedModels() {
    return []
  }

  /**
   * This is a column name for the foreign key to the base model. For the 'taxa'
   * table this may be 'taxon_id' which is the primary key for the 'taxa' table.
   */
  getBaseModelColumName() {
    return 'reference_id'
  }

  getModelColumnName(model) {
    switch (model) {
      case models.MediaFilesXBibliographicReference:
        return 'media_id'
      case models.SpecimensXBibliographicReference:
        return 'specimen_id'
      case models.TaxaXBibliographicReference:
        return 'taxon_id'
      case models.CharactersXBibliographicReference:
        return 'character_id'
      case models.CellsXBibliographicReference:
        return 'taxon_id, character_id, matrix_id'
      default:
        return null
    }
  }
}

class SpecimensConfig {
  getBaseModel() {
    return models.Specimen
  }

  getModels() {
    return [models.SpecimensXBibliographicReference, models.MediaFile]
  }

  getReferencedModels() {
    return []
  }

  getNumericReferencedModels() {
    return []
  }

  /**
   * This is a column name for the foreign key to the base model. For the 'taxa'
   * table this may be 'taxon_id' which is the primary key for the 'taxa' table.
   */
  getBaseModelColumName() {
    return 'specimen_id'
  }

  getModelColumnName(model) {
    switch (model) {
      case models.SpecimensXBibliographicReference:
        return 'reference_id'
      default:
        return null
    }
  }
}

class DocumentsConfig {
  getBaseModel() {
    return models.ProjectDocument
  }

  getModels() {
    return [models.MediaFilesXDocument]
  }

  getReferencedModels() {
    return []
  }

  getNumericReferencedModels() {
    return []
  }

  getBaseModelColumName() {
    return 'document_id'
  }

  getModelColumnName(model) {
    switch (model) {
      case models.MediaFilesXDocument:
        return 'media_id'
      default:
        return null
    }
  }
}

class InstitutionsConfig {
  getBaseModel() {
    return models.Institution
  }

  getModels() {
    return [models.InstitutionsXProject, models.InstitutionsXUser]
  }

  getReferencedModels() {
    return []
  }

  getNumericReferencedModels() {
    return []
  }

  getBaseModelColumName() {
    return 'institution_id'
  }

  getModelColumnName(model) {
    switch (model) {
      case models.InstitutionsXProject:
        return 'media_id'
      case models.InstitutionsXUser:
        return 'user_id'
      default:
        return null
    }
  }
}

export const ModelReferencialConfig = {
  TAXA: new TaxaConfig(),
  BIBLIOGRAPHIC_REFERENCES: new BibliographicReferencesConfig(),
  SPECIMEN: new SpecimensConfig(),
  DOCUMENTS: new DocumentsConfig(),
  INSTITUTIONS: new InstitutionsConfig(),
}
