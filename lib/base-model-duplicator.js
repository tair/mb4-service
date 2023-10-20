import { BaseModelScanner } from './base-model-scanner.js'
import { Table } from '../util/table.js'
import { QueryTypes } from 'sequelize'
import { getDirectoryHash, getMagicNumber } from '../util/file.js'
import { normalizeJson } from '../util/json.js'
import config from '../config.js'
import sequelizeConn from '../util/db.js'
import os from 'node:os'
import fs from 'fs/promises'

export class BaseModelDuplicator extends BaseModelScanner {
  constructor(model, modelId) {
    super(model, modelId)

    this.clonedIds = new Table()
    this.overrideFieldName = new Set()
    this.createdFiles = []
  }

  setOverriddenFieldNames(overrideFieldName) {
    this.overrideFieldName = overrideFieldName
  }

  async duplicate() {
    try {
      const tables = this.getTopologicalDependentTables()
      for (const table of tables) {
        const rows = await this.getRowsForTable(table)
        await this.duplicateRows(table, rows)
      }
      return this.getDuplicateRecordId(this.mainModel, this.mainModelId)
    } catch (e) {
      for (const file of this.createdFiles) {
        console.log('Deleting: ', file)
        await fs.unlink(file)
      }
      throw e
    }
  }

  async duplicateRows(table, rows) {
    const tableName = table.getTableName()
    const primaryKey = this.datamodel.getPrimaryKey(table)
    const linkingFieldName = this.numberedTables.get(table)
    const transaction = this.getTransaction()
    for (const row of rows) {
      const rowId = row[primaryKey]
      delete row[primaryKey]

      const files = new Map()
      const media = new Map()
      for (const [field, attributes] of Object.entries(table.rawAttributes)) {
        // Unset the file and media within the records because we will copy the
        // underlying file first and then set the JSON properties.
        if (attributes.file && row[field]) {
          files.set(field, normalizeJson(row[field]))
          row[field] = null
        }
        if (attributes.media && row[field]) {
          media.set(field, normalizeJson(row[field]))
          row[field] = null
        }

        // Update the foreign key to the duplicated record.
        if (attributes.references && table != this.mainModel && row[field]) {
          const referencedTableName = attributes.references.model
          const referencedTable =
            this.datamodel.getTableByName(referencedTableName)
          row[field] = this.getDuplicateRecordId(referencedTable, row[field])
        }

        // We must update all records that have foreign keys by their table
        // number.
        if (linkingFieldName && linkingFieldName == field) {
          const tableNumber = row['table_num']
          const linkingTable = this.datamodel.getTableByNumber(tableNumber)
          row[field] = this.getDuplicateRecordId(linkingTable, row[field])
        }

        if (attributes.type.toSql() == 'JSON' && row[field]) {
          row[field] = JSON.stringify(row[field])
        }

        if (attributes.ancestored) {
          row[field] = rowId
        }

        if (this.overrideFieldName.has(field)) {
          row[field] = this.overrideFieldName.get(field)
        }
      }

      const columns = Object.keys(row).join(',')
      const values = Object.values(row)
      const placeHolders = new Array(values.length).fill('?').join(',')
      const [cloneRowId] = await sequelizeConn.query(
        `INSERT INTO ${tableName}(${columns}) VALUES(${placeHolders})`,
        {
          replacements: values,
          transaction,
          type: QueryTypes.INSERT,
        }
      )
      this.clonedIds.set(table, rowId, cloneRowId)

      if (files.size) {
        await this.duplicateFiles(table, primaryKey, cloneRowId, rowId, files)
      }
      if (media.size) {
        await this.duplicateMedia(table, primaryKey, cloneRowId, rowId, media)
      }
    }
  }

  getDuplicateRecordId(table, rowId) {
    if (this.clonedIds.has(table, rowId)) {
      return this.clonedIds.get(table, rowId)
    }
    throw new Error(`The ${rowId} for ${table.getTableName()} was not cloned`)
  }

  async duplicateFiles(table, primaryKey, rowId, previousRowId, fields) {
    const tableName = table.getTableName()
    const basePath = `${config.media.directory}/${config.app.name}`
    const transaction = this.getTransaction()
    const userInfo = os.userInfo()
    for (const [fieldName, file] of fields.entries()) {
      const filename = file.filename
      const volumePath = `${basePath}/${file.volume}`
      const oldPath = `${volumePath}/${file.hash}/${file.magic}_${filename}`

      const newFileName = filename.replace(previousRowId, rowId)
      file.filename = newFileName
      file.hash = await getDirectoryHash(volumePath, rowId)
      file.magic = getMagicNumber()
      const newPath = `${volumePath}/${file.hash}/${file.magic}_${newFileName}`
      await fs.copyFile(oldPath, newPath)
      this.createdFiles.push(newPath)

      fs.chown(newPath, userInfo.uid, userInfo.gid)
      fs.chmod(newPath, 0o775)

      const serializedValue = JSON.stringify(file)
      await sequelizeConn.query(
        `UPDATE ${tableName} SET ${fieldName}= ? WHERE ${primaryKey} = ?`,
        {
          replacements: [serializedValue, rowId],
          transaction,
          type: QueryTypes.UPDATE,
        }
      )
    }
  }

  async duplicateMedia(table, primaryKey, rowId, previousRowId, fields) {
    const tableName = table.getTableName()
    const basePath = `${config.media.directory}/${config.app.name}`
    const transaction = this.getTransaction()
    const userInfo = os.userInfo()
    for (const [fieldName, versionMedia] of fields.entries()) {
      for (const media of Object.values(versionMedia)) {
        const filename = media.filename
        const volumePath = `${basePath}/${media.volume}`
        const oldPath = `${volumePath}/${media.hash}/${media.magic}_${filename}`

        const newFileName = filename.replace(previousRowId, rowId)
        media.filename = newFileName
        media.hash = await getDirectoryHash(basePath, rowId)
        media.magic = getMagicNumber()
        const newPath = `${volumePath}/${media.hash}/${media.magic}_${newFileName}`
        await fs.copyFile(oldPath, newPath)
        this.createdFiles.push(newPath)
        fs.chown(newPath, userInfo.uid, userInfo.gid)
        fs.chmod(newPath, 0o775)
      }
      const serializedValue = JSON.stringify(versionMedia)
      await sequelizeConn.query(
        `UPDATE ${tableName} SET ${fieldName}= ? WHERE ${primaryKey} = ?`,
        {
          replacements: [serializedValue, rowId],
          transaction,
          type: QueryTypes.UPDATE,
        }
      )
    }
  }
}
