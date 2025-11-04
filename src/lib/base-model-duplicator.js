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

    // Copyright handling for one-time use media
    this.onetimeUseAction = null // 1 = keep in original, 100 = move to duplicate
    this.onetimeMediaToDelete = [] // Track media to delete from original project
  }

  setOverriddenFieldNames(overrideFieldName) {
    this.overrideFieldName = overrideFieldName
  }

  /**
   * Set one-time use media action for copyright compliance
   * @param {number} action - 1 = keep in original, 100 = move to duplicate
   */
  setOnetimeUseAction(action) {
    this.onetimeUseAction = action
  }

  async duplicate() {
    try {
      const tables = this.getTopologicalDependentTables()

      for (let i = 0; i < tables.length; i++) {
        const table = tables[i]

        const rows = await this.getRowsForTable(table)

        if (rows.length > 0) {
          await this.duplicateRows(table, rows)
        }
      }

      const duplicatedId = this.getDuplicateRecordId(
        this.mainModel,
        this.mainModelId
      )

      // Handle one-time use media deletion from original project if needed (only on success)
      if (
        this.onetimeUseAction === 100 &&
        this.onetimeMediaToDelete.length > 0
      ) {
        await this.deleteOnetimeMediaFromOriginalProject()
      }

      return duplicatedId
    } catch (e) {
      console.error(
        `[BASE_DUPLICATOR] ERROR during duplication of ${this.mainModel.tableName} ID ${this.mainModelId}:`,
        {
          error: e.message,
          stack: e.stack,
        }
      )

      // Clean up local files

      for (const file of this.createdFiles) {
        try {
          await fs.unlink(file)
        } catch (unlinkError) {
          console.error(
            `[BASE_DUPLICATOR] Failed to clean up local file ${file}:`,
            unlinkError
          )
        }
      }

      // Clean up S3 files
      try {
        await this.s3Duplicator.cleanup()
      } catch (s3Error) {
        console.error(`[BASE_DUPLICATOR] Failed to clean up S3 files:`, s3Error)
      }

      throw e
    }
  }

  async duplicateRows(table, rows) {
    const tableName = table.getTableName()
    const primaryKey = this.datamodel.getPrimaryKey(table)
    const linkingFieldName = this.numberedTables.get(table)
    const transaction = this.getTransaction()

    // Handle one-time use media copyright restrictions for media_files table
    if (tableName === 'media_files' && this.onetimeUseAction !== null) {
      rows = await this.filterOnetimeUseMedia(rows, primaryKey)
    }

    // Identify JSON columns for this table (do this once per table, not per row)
    const jsonColumns = new Set()
    for (const [field, attributes] of Object.entries(table.rawAttributes)) {
      if (
        attributes.type &&
        attributes.type.toSql &&
        attributes.type.toSql() === 'JSON'
      ) {
        jsonColumns.add(field)
      }
    }

    for (const row of rows) {
      const rowId = row[primaryKey]

      // Check if this record should be skipped due to filtered media references
      if (this.shouldSkipRecordDueToFilteredMedia(table, row)) {
        continue
      }

      // Check if all foreign key references exist in cloned records
      // This prevents errors when foreign keys point to records that weren't cloned
      if (!this.validateForeignKeys(table, row)) {
        console.warn(
          `[BASE_DUPLICATOR] Skipping ${tableName} record ${rowId} due to missing foreign key references`
        )
        continue
      }

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

        // Handle JSON columns - format them properly for MySQL CAST
        if (jsonColumns.has(field)) {
          if (row[field] === null || row[field] === undefined) {
            // NULL values are fine as-is - CAST(? AS JSON) will handle NULL
            row[field] = null
          } else if (typeof row[field] === 'string') {
            // If it's already a string, validate it's valid JSON
            try {
              // Validate by parsing - if it fails, set to null
              JSON.parse(row[field])
              // Keep as string - MySQL CAST will parse it
            } catch (e) {
              // Invalid JSON string - set to null
              row[field] = null
            }
          } else {
            // It's an object/array - stringify it
            row[field] = JSON.stringify(row[field])
          }
        }

        if (attributes.ancestored) {
          row[field] = rowId
        }

        if (this.overrideFieldName.has(field)) {
          row[field] = this.overrideFieldName.get(field)
        }
      }

      // Build columns and values arrays (in matching order)
      const columns = Object.keys(row)
      const values = Object.values(row)

      // Build placeholders with CAST for JSON columns
      const placeHolders = columns
        .map((col) => {
          if (jsonColumns.has(col)) {
            // Use CAST for JSON columns to handle NULL and string values properly
            return 'CAST(? AS JSON)'
          }
          return '?'
        })
        .join(',')

      const [cloneRowId] = await sequelizeConn.query(
        `INSERT INTO ${tableName}(${columns.join(
          ','
        )}) VALUES(${placeHolders})`,
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

  /**
   * Check if a record ID was cloned (exists in the clonedIds mapping)
   * @param {Object} table - The table to check
   * @param {number} rowId - The original row ID
   * @returns {boolean} True if the record was cloned
   */
  wasRecordCloned(table, rowId) {
    return this.clonedIds.has(table, rowId)
  }

  /**
   * Check if a record should be skipped because it references filtered media files
   * @param {Object} table - The table being processed
   * @param {Object} row - The row data
   * @returns {boolean} True if the record should be skipped
   */
  shouldSkipRecordDueToFilteredMedia(table, row) {
    // Only apply this check if we're filtering one-time use media (keeping in original)
    if (this.onetimeUseAction !== 1) {
      return false
    }

    const tableName = table.getTableName()

    // Don't apply this logic to the media_files table itself
    if (tableName === 'media_files') {
      return false
    }

    // Check if this record has a direct media_id reference
    if (row.media_id) {
      const mediaTable = this.datamodel.getTableByName('media_files')
      if (!this.clonedIds.has(mediaTable, row.media_id)) {
        console.warn(
          `[BASE_DUPLICATOR] Skipping ${tableName} record that references filtered media file ${row.media_id}`
        )
        return true
      }
    }

    // Check foreign key references to media_files
    for (const [field, attributes] of Object.entries(table.rawAttributes)) {
      if (
        attributes.references &&
        attributes.references.model === 'media_files' &&
        row[field]
      ) {
        const mediaTable = this.datamodel.getTableByName('media_files')
        if (!this.clonedIds.has(mediaTable, row[field])) {
          console.warn(
            `[BASE_DUPLICATOR] Skipping ${tableName} record that references filtered media file ${row[field]} via ${field}`
          )
          return true
        }
      }
    }

    return false
  }

  /**
   * Validate that all foreign key references exist in the cloned records
   * @param {Object} table - The table being processed
   * @param {Object} row - The row data
   * @returns {boolean} True if all foreign key references are valid
   */
  validateForeignKeys(table, row) {
    // Skip validation for the main model (project) as it doesn't have foreign keys to validate
    if (table === this.mainModel) {
      return true
    }

    for (const [field, attributes] of Object.entries(table.rawAttributes)) {
      // Check regular foreign key references
      if (attributes.references && row[field] != null) {
        const referencedTableName = attributes.references.model
        const referencedTable =
          this.datamodel.getTableByName(referencedTableName)

        if (referencedTable) {
          // Check if the referenced record was cloned
          if (!this.clonedIds.has(referencedTable, row[field])) {
            return false
          }
        }
      }

      // Check numbered table references (table_num based)
      const linkingFieldName = this.numberedTables.get(table)
      if (
        linkingFieldName &&
        linkingFieldName === field &&
        row['table_num'] != null
      ) {
        const tableNumber = row['table_num']
        const linkingTable = this.datamodel.getTableByNumber(tableNumber)

        if (linkingTable) {
          // Check if the referenced record was cloned
          if (!this.clonedIds.has(linkingTable, row[field])) {
            return false
          }
        }
      }
    }

    return true
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
            previousRowId, // old document ID
            rowId, // new document ID
            file
          )
        } catch (error) {
          console.error(
            `[BASE_DUPLICATOR] ERROR duplicating S3 document for ${tableName} ${rowId}:`,
            {
              error: error.message,
              stack: error.stack,
              oldProjectId: this.getProjectIdFromContext(),
              newProjectId: this.getNewProjectId(),
              documentId: rowId,
            }
          )
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
          console.warn(
            `Source file not found, skipping: ${oldPath}. This may be a legacy file that was migrated to S3.`
          )
          // Skip this file if it doesn't exist - likely migrated to S3
          continue
        }
      } else {
        // Skip files without filename or S3 keys
        console.warn(
          `Skipping file without filename or S3 keys in ${tableName}:`,
          file
        )
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

      // ALWAYS prefer S3 over legacy filesystem since all files are in S3
      const hasS3Keys = this.hasS3Keys(versionMedia)
      let s3DuplicationSucceeded = false

      // Step 1: Try S3 duplication first (preferred method)
      if (hasS3Keys) {
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
            previousRowId, // old media ID
            rowId, // new media ID
            versionMedia
          )

          s3DuplicationSucceeded = true
        } catch (error) {
          console.error(
            `[BASE_DUPLICATOR] S3 duplication failed for ${tableName} ${rowId}, will try legacy filesystem:`,
            {
              error: error.message,
              mediaType: this.detectMediaType(versionMedia, tableName),
              oldProjectId: this.getProjectIdFromContext(),
              newProjectId: this.getNewProjectId(),
              mediaId: rowId,
            }
          )
          // Don't throw here, try legacy filesystem as backup
        }
      } else {
        // Try to use S3 anyway by constructing S3 keys based on project/media IDs
        try {
          const mediaType = this.detectMediaType(versionMedia, tableName)
          const oldProjectId = this.getProjectIdFromContext()
          const newProjectId = this.getNewProjectId()

          // Create minimal S3 structure for duplication (will attempt to find files in S3)
          const constructedMediaJson = this.constructS3MediaJson(
            versionMedia,
            mediaType,
            oldProjectId,
            previousRowId
          )

          if (constructedMediaJson) {
            updatedMedia = await this.s3Duplicator.duplicateMediaFiles(
              mediaType,
              oldProjectId,
              newProjectId,
              previousRowId,
              rowId,
              constructedMediaJson
            )

            s3DuplicationSucceeded = true
          }
        } catch (error) {
          // Continue to legacy filesystem
        }
      }

      // Step 2: Only use legacy filesystem as last resort, and make it resilient
      if (!s3DuplicationSucceeded) {
        const basePath = `${config.media.directory}/${config.app.name}`
        const userInfo = os.userInfo()
        let legacyFilesProcessed = 0
        let legacyFilesSkipped = 0

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

            // CHECK if source file exists before trying to copy
            try {
              await fs.access(oldPath)

              const newFileName = filename.replace(previousRowId, rowId)
              media.filename = newFileName
              media.hash = await getDirectoryHash(basePath, rowId)
              media.magic = getMagicNumber()
              const newPath = `${volumePath}/${media.hash}/${media.magic}_${newFileName}`

              await fs.copyFile(oldPath, newPath)
              this.createdFiles.push(newPath)
              await fs.chown(newPath, userInfo.uid, userInfo.gid)
              await fs.chmod(newPath, 0o775)

              legacyFilesProcessed++
            } catch (fileError) {
              console.warn(
                `[BASE_DUPLICATOR] Legacy file not found or copy failed (skipping): ${oldPath}. Error: ${fileError.message}`
              )
              legacyFilesSkipped++
              // Don't fail the entire duplication - this file might have been migrated to S3
              // Just continue without this file
            }
          }
        }

        // If no legacy files were found, that's OK - they might all be in S3
        if (legacyFilesProcessed === 0 && legacyFilesSkipped > 0) {
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

    // Check for S3_KEY in variants (focus on actual variants: original, large, thumbnail)
    // Note: Database uses lowercase 's3_key' not 'S3_KEY'
    const actualVariants = ['original', 'large', 'thumbnail']
    for (const variant of actualVariants) {
      if (
        mediaJson[variant] &&
        (mediaJson[variant].S3_KEY || mediaJson[variant].s3_key)
      ) {
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

      // Direct string check for S3 key patterns (look for proper media_files paths)
      if (
        typeof value === 'string' &&
        (value.includes('media_files/images/') ||
          value.includes('media_files/videos/') ||
          value.includes('media_files/model_3ds/'))
      ) {
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
   * Construct S3 media JSON for files that might be in S3 but don't have S3 keys in DB
   * @param {Object} originalMedia - Original media JSON
   * @param {string} mediaType - Media type (image, video, model_3d)
   * @param {number} projectId - Project ID
   * @param {number} mediaId - Media ID
   * @returns {Object|null} Constructed media JSON with potential S3 keys
   */
  constructS3MediaJson(originalMedia, mediaType, projectId, mediaId) {
    // Only attempt this if we have some original media data
    if (!originalMedia || typeof originalMedia !== 'object') {
      return null
    }

    const constructedMedia = { ...originalMedia }

    // Use the CORRECT S3 naming pattern: {projectId}_{mediaId}_{variant}.jpg
    // Only look for variants that actually exist: original, large, thumbnail
    const actualVariants = ['original', 'large', 'thumbnail']
    const mediaTypeFolder =
      mediaType === 'video'
        ? 'videos'
        : mediaType === 'model_3d'
        ? 'model_3ds'
        : 'images'

    for (const variant of actualVariants) {
      // Construct the correct filename pattern
      const correctFilename = `${projectId}_${mediaId}_${variant}.jpg`

      // Construct the full S3 key
      const correctS3Key = `media_files/${mediaTypeFolder}/${projectId}/${mediaId}/${correctFilename}`

      // Add the constructed S3 key to the media data
      if (!constructedMedia[variant]) {
        constructedMedia[variant] = {}
      }
      constructedMedia[variant].s3_key = correctS3Key
    }

    // Also construct a root-level S3 key for the original file
    const rootFilename = `${projectId}_${mediaId}_original.jpg`
    const rootS3Key = `media_files/${mediaTypeFolder}/${projectId}/${mediaId}/${rootFilename}`
    constructedMedia.s3_key = rootS3Key

    return constructedMedia
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
    if (mediaJson.original?.MIMETYPE)
      mimeTypes.push(mediaJson.original.MIMETYPE)
    if (mediaJson.large?.MIMETYPE) mimeTypes.push(mediaJson.large.MIMETYPE)
    if (mediaJson.thumbnail?.MIMETYPE)
      mimeTypes.push(mediaJson.thumbnail.MIMETYPE)

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
    return 'image'
  }

  /**
   * Filter one-time use media based on copyright restrictions
   * @param {Array} rows - Media file rows to process
   * @param {string} primaryKey - Primary key field name
   * @returns {Array} Filtered rows
   */
  async filterOnetimeUseMedia(rows, primaryKey) {
    const filteredRows = []
    let skippedCount = 0
    let movedCount = 0

    for (const row of rows) {
      const mediaId = row[primaryKey]
      const copyrightLicense = row.copyright_license

      // Check if this is one-time use media (copyright_license = 8)
      if (copyrightLicense === 8) {
        if (this.onetimeUseAction === 1) {
          // Action 1: Keep in original project - skip duplication

          skippedCount++
          continue
        } else if (this.onetimeUseAction === 100) {
          // Action 100: Move to duplicate project - duplicate and mark for deletion

          this.onetimeMediaToDelete.push(mediaId)
          filteredRows.push(row)
          movedCount++
        } else {
          console.warn(
            `[BASE_DUPLICATOR] Unknown onetime_use_action: ${this.onetimeUseAction}, duplicating media ${mediaId} normally`
          )
          filteredRows.push(row)
        }
      } else {
        // Regular media - duplicate normally
        filteredRows.push(row)
      }
    }

    return filteredRows
  }

  /**
   * Delete one-time use media from the original project (for move action)
   */
  async deleteOnetimeMediaFromOriginalProject() {
    if (this.onetimeMediaToDelete.length === 0) {
      return
    }

    const transaction = this.getTransaction()

    try {
      // Delete media files from original project
      for (const mediaId of this.onetimeMediaToDelete) {
        await sequelizeConn.query(
          'DELETE FROM media_files WHERE media_id = ? AND project_id = ?',
          {
            replacements: [mediaId, this.mainModelId],
            transaction,
            type: QueryTypes.DELETE,
          }
        )

        // Also delete related records that reference this media
        const relatedTables = [
          'media_views',
          'cells_x_media',
          'characters_x_media',
          'folios_x_media_files',
          'media_files_x_bibliographic_references',
          'taxa_x_media',
          'media_files_x_documents',
          'media_labels',
        ]

        for (const relatedTable of relatedTables) {
          try {
            await sequelizeConn.query(
              `DELETE FROM ${relatedTable} WHERE media_id = ?`,
              {
                replacements: [mediaId],
                transaction,
                type: QueryTypes.DELETE,
              }
            )
          } catch (error) {
            // Some tables might not exist or have different field names - that's OK
          }
        }
      }
    } catch (error) {
      console.error(
        `[BASE_DUPLICATOR] Error deleting one-time use media from original project:`,
        error
      )
      throw error
    }
  }
}
