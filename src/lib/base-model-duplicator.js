import { BaseModelScanner } from './base-model-scanner.js'
import { Table } from './table.js'
import { QueryTypes } from 'sequelize'
import { getDirectoryHash, getMagicNumber } from '../util/file.js'
import { normalizeJson } from '../util/json.js'
import config from '../config.js'
import sequelizeConn from '../util/db.js'
import os from 'node:os'
import fs from 'fs/promises'
import { S3Duplicator } from './s3-duplicator.js'

export class BaseModelDuplicator extends BaseModelScanner {
  constructor(model, modelId) {
    super(model, modelId)

    this.clonedIds = new Table()
    this.overrideFieldName = new Map()
    this.createdFiles = []
    this.s3Duplicator = new S3Duplicator()
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
      // Clean up local files
      for (const file of this.createdFiles) {
        try {
          await fs.unlink(file)
        } catch (unlinkError) {
          console.error(`Failed to clean up local file ${file}:`, unlinkError)
        }
      }
      
      // Clean up S3 files
      try {
        await this.s3Duplicator.cleanup()
      } catch (s3Error) {
        console.error('Failed to clean up S3 files:', s3Error)
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
          const mediaData = normalizeJson(row[field])
          media.set(field, mediaData)
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
    const transaction = this.getTransaction()
    
    for (const [fieldName, file] of fields.entries()) {
      let updatedFile = { ...file }
      
      // Check if this is S3-based file (has S3_KEY or s3_key) or legacy local file system
      const hasS3Keys = file.S3_KEY || file.s3_key
      
      if (hasS3Keys) {
        // Handle S3-based document files
        try {
          const oldProjectId = this.getProjectIdFromContext()
          const newProjectId = this.getNewProjectId()

          updatedFile = await this.s3Duplicator.duplicateDocumentFiles(
            oldProjectId,
            newProjectId,
            previousRowId,  // old document ID
            rowId,         // new document ID
            file
          )
        } catch (error) {
          console.error(`Error duplicating S3 document for ${tableName} ${rowId}:`, error)
          throw error
        }
      } else if (file.filename) {
        // Handle legacy local file system files (only if filename exists)
        const basePath = `${config.media.directory}/${config.app.name}`
        const userInfo = os.userInfo()
        
        const filename = file.filename
        const volumePath = `${basePath}/${file.volume}`
        const oldPath = `${volumePath}/${file.hash}/${file.magic}_${filename}`

        // Check if the source file actually exists before trying to copy
        try {
          await fs.access(oldPath)
          
          const newFileName = filename.replace(previousRowId, rowId)
          updatedFile.filename = newFileName
          updatedFile.hash = await getDirectoryHash(volumePath, rowId)
          updatedFile.magic = getMagicNumber()
          const newPath = `${volumePath}/${updatedFile.hash}/${updatedFile.magic}_${newFileName}`
          
          await fs.copyFile(oldPath, newPath)
          this.createdFiles.push(newPath)
          fs.chown(newPath, userInfo.uid, userInfo.gid)
          fs.chmod(newPath, 0o775)
        } catch (fileError) {
          console.warn(`Source file not found, skipping: ${oldPath}. This may be a legacy file that was migrated to S3.`)
          // Skip this file if it doesn't exist - likely migrated to S3
          continue
        }
      } else {
        // Skip files without filename or S3 keys
        console.warn(`Skipping file without filename or S3 keys in ${tableName}:`, file)
        continue
      }

      // Update the database record with the new file data
      const serializedValue = JSON.stringify(updatedFile)
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
    const transaction = this.getTransaction()
    

    
    for (const [fieldName, versionMedia] of fields.entries()) {
      // Skip if the column is NULL.
      if (versionMedia == null) {
        continue
      }

      let updatedMedia = { ...versionMedia }

      // Check if this is S3-based media (has S3_KEY) or legacy local file system
      const hasS3Keys = this.hasS3Keys(versionMedia)
      
      if (hasS3Keys) {
        // Handle S3-based media files
        try {
          // Determine media type from the media data or default to image
          let mediaType = this.detectMediaType(versionMedia, tableName)

          // Get old and new project IDs from the main model IDs
          const oldProjectId = this.getProjectIdFromContext() 
          const newProjectId = this.getNewProjectId()

          updatedMedia = await this.s3Duplicator.duplicateMediaFiles(
            mediaType,
            oldProjectId,
            newProjectId,
            previousRowId,  // old media ID
            rowId,         // new media ID
            versionMedia
          )
        } catch (error) {
          console.error(`Error duplicating S3 media for ${tableName} ${rowId}:`, error)
          throw error
        }
      } else {
        // Handle legacy local file system media (keep original logic)
        const basePath = `${config.media.directory}/${config.app.name}`
        const userInfo = os.userInfo()
        
        for (const [version, media] of Object.entries(versionMedia)) {
          // These versions do not have corresponding files.
          if (version == 'original_filename' || version == 'input') {
            continue
          }

          // If 'use_icon' is set, there is not corresponding thumbnail.
          if (media.use_icon != null) {
            continue
          }

          if (media.filename) {
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
        }
      }

      // Update the database record with the new media data
      const serializedValue = JSON.stringify(updatedMedia)
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

  /**
   * Check if media JSON contains S3 keys
   * @param {Object} mediaJson - Media JSON data
   * @returns {boolean} True if contains S3 keys
   */
  hasS3Keys(mediaJson) {
    if (!mediaJson || typeof mediaJson !== 'object') {
      return false
    }
    
    // Check for S3_KEY in root level
    if (mediaJson.S3_KEY || mediaJson.s3_key) {
      return true
    }
    
    // Check for S3_KEY in variants (original, large, thumbnail, etc.)
    // Note: Database uses lowercase 's3_key' not 'S3_KEY'
    const variants = ['original', 'large', 'thumbnail', 'medium', 'small']
    for (const variant of variants) {
      if (mediaJson[variant] && (mediaJson[variant].S3_KEY || mediaJson[variant].s3_key)) {
        return true
      }
    }
    
    // Check for any property that contains S3_KEY (case variations)
    for (const [key, value] of Object.entries(mediaJson)) {
      if (value && typeof value === 'object') {
        if (value.S3_KEY || value.s3_key || value.S3Key || value.s3Key) {
          return true
        }
      }
      
      // Direct string check for S3 key patterns
      if (typeof value === 'string' && value.includes('media_files/')) {
        return true
      }
    }
    
    return false
  }

  /**
   * Get project ID from the current duplication context
   * @returns {number} Project ID
   */
  getProjectIdFromContext() {
    // This assumes we're duplicating a project and the main model is Project
    if (this.mainModel.tableName === 'projects') {
      return this.mainModelId
    }
    // For other tables, we might need to look up the project ID differently
    // This is a fallback - in practice, project duplication should set this
    throw new Error('Cannot determine project ID for S3 duplication')
  }

  /**
   * Get the new project ID from the duplication mapping
   * @returns {number} New project ID
   */
  getNewProjectId() {
    if (this.mainModel.tableName === 'projects') {
      return this.getDuplicateRecordId(this.mainModel, this.mainModelId)
    }
    throw new Error('Cannot determine new project ID for S3 duplication')
  }

  /**
   * Detect media type from media JSON data and context
   * @param {Object} mediaJson - Media JSON data
   * @param {string} tableName - Table name for context
   * @returns {string} Media type (image, video, model_3d)
   */
  detectMediaType(mediaJson, tableName) {
    // Check S3 keys for media type hints
    const s3Keys = []
    
    // Collect all S3 keys from the media JSON
    if (mediaJson.S3_KEY) s3Keys.push(mediaJson.S3_KEY)
    if (mediaJson.original?.S3_KEY) s3Keys.push(mediaJson.original.S3_KEY)
    if (mediaJson.large?.S3_KEY) s3Keys.push(mediaJson.large.S3_KEY)
    if (mediaJson.thumbnail?.S3_KEY) s3Keys.push(mediaJson.thumbnail.S3_KEY)

    // Analyze S3 keys to determine media type
    for (const s3Key of s3Keys) {
      if (s3Key.includes('/videos/')) {
        return 'video'
      }
      if (s3Key.includes('/model_3ds/')) {
        return 'model_3d'
      }
      if (s3Key.includes('/images/')) {
        return 'image'
      }
    }

    // Check MIMETYPE fields for additional hints
    const mimeTypes = []
    if (mediaJson.original?.MIMETYPE) mimeTypes.push(mediaJson.original.MIMETYPE)
    if (mediaJson.large?.MIMETYPE) mimeTypes.push(mediaJson.large.MIMETYPE)
    if (mediaJson.thumbnail?.MIMETYPE) mimeTypes.push(mediaJson.thumbnail.MIMETYPE)

    for (const mimeType of mimeTypes) {
      if (mimeType && mimeType.startsWith('video/')) {
        return 'video'
      }
      if (mimeType && (mimeType.includes('model') || mimeType.includes('3d'))) {
        return 'model_3d'
      }
      if (mimeType && mimeType.startsWith('image/')) {
        return 'image'
      }
    }

    // Check original filename extensions
    if (mediaJson.ORIGINAL_FILENAME) {
      const filename = mediaJson.ORIGINAL_FILENAME.toLowerCase()
      
      // Video extensions
      if (filename.match(/\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v)$/)) {
        return 'video'
      }
      
      // 3D model extensions
      if (filename.match(/\.(obj|stl|ply|dae|fbx|x3d|wrl)$/)) {
        return 'model_3d'
      }
      
      // Image extensions (default)
      if (filename.match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/)) {
        return 'image'
      }
    }

    // Default to image if no clear indicators
    console.warn(`Could not determine media type for ${tableName}, defaulting to image`)
    return 'image'
  }
}
