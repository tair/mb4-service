import config from '../../config.js'
import crypto from 'crypto'
import { models } from '../init-models.js'
import { normalizeJson } from '../../util/json.js'
import { Datamodel } from '../../lib/datamodel/datamodel.js'
import s3Service from '../../services/s3-service.js'

/**
 * This function is run as a sequelize hook such that if the model is changed
 * such that the record contains JSON records which indicate a file has been
 * updated, this will remove the previous file from storage.
 * @param {*} model The model that was updated.
 * @param {*} options Options related to the database operation.
 */
export async function fileChanged(model, options) {
  const tableName = model.constructor.tableName
  const rowId = getRowId(model)
  const { transaction, user } = options
  for (const [field, attributes] of Object.entries(model.rawAttributes)) {
    if ((attributes.file || attributes.media) && model.changed(field)) {
      const fileJson = normalizeJson(model.previous(field))
      await unlink(tableName, rowId, fileJson, transaction, user)
    }
  }
}

/**
 * This function is run as a sequelized hook such that if the model is deleted,
 * the files that are referenced by this record will also be deleted.
 * @param {*} model The model that was updated.
 * @param {*} options Options related to the database operation.
 */
export async function fileDeleted(model, options) {
  const tableName = model.constructor.tableName
  const rowId = getRowId(model)
  const { transaction, user } = options
  for (const [field, attributes] of Object.entries(model.rawAttributes)) {
    if (attributes.file || attributes.media) {
      const fileJson = normalizeJson(model.getDataValue(field))
      await unlink(tableName, rowId, fileJson, transaction, user)
    }
  }
}

function getRowId(model) {
  const datamodel = Datamodel.getInstance()
  const primaryKeys = datamodel.getPrimaryKey(model)
  if (primaryKeys.length != 1) {
    throw 'Model does not have a single primary key cannot have logged'
  }

  const rowId = model[primaryKeys[0]]
  if (!rowId) {
    throw 'Row Id is not defined and cannot be logged'
  }
  return rowId
}

/**
 * This will add a entry to the task queue within the same transaction that
 * updated or deleted the record. This is done witin the same transaction so
 * that if the transaction is rolled back, we do not inadvertently delete the
 * file. The actual file deletion happens in the `FileDeletion` handler.
 *
 * @param {string} tableName The name of the table.
 * @param {*} rowId The ID of the row for the table.
 * @param {*} json The JSON object indicating the file.
 * @param {*} transaction The transaction in which to add the entry
 * @param {*} user The user that is making the change.
 */
async function unlink(tableName, rowId, json, transaction, user) {
  if (!json) {
    return
  }

  // Handle S3-based media files - check for any S3 keys (normalized to lowercase)
  const hasS3Files = (json.thumbnail && json.thumbnail.s3_key) || 
                     (json.large && json.large.s3_key) || 
                     (json.original && json.original.s3_key)
  
  if (hasS3Files) {
    // This is a new S3-based media file - delete directly from S3
    const s3Keys = []
    if (json.thumbnail && json.thumbnail.s3_key) s3Keys.push(json.thumbnail.s3_key)
    if (json.large && json.large.s3_key) s3Keys.push(json.large.s3_key)
    if (json.original && json.original.s3_key) s3Keys.push(json.original.s3_key)

    if (s3Keys.length > 0) {
      const bucket = config.aws.defaultBucket
      console.log(`Deleting ${s3Keys.length} S3 files for ${tableName}/${rowId}:`, s3Keys)
      
      for (const s3Key of s3Keys) {
        try {
          await s3Service.deleteObject(bucket, s3Key)
          console.log(`Successfully deleted S3 file: ${s3Key}`)
        } catch (error) {
          // Log error but don't fail the transaction
          if (error.name === 'NoSuchKey') {
            console.log(`S3 file already deleted: ${s3Key}`)
          } else {
            console.error(`Failed to delete S3 file ${s3Key}:`, error.message)
          }
        }
      }
    }
    return
  }

  // Handle legacy local file system
  const { volume, hash, magic, filename } = json
  if (!volume || !hash || !magic || !filename) {
    console.error(`Failed to delete previous record: `, json)
    return
  }

  const basePath = `${config.media.directory}/${config.app.name}`
  const oldPath = `${basePath}/${volume}/${hash}/${magic}_${filename}`
  const rowKey = `${tableName}/${rowId}/unlink`
  await models.TaskQueue.create(
    {
      user_id: user.user_id,
      priority: 200,
      entity_key: crypto.createHash('md5').update(rowKey).digest('hex'),
      row_key: crypto.createHash('md5').update(rowKey).digest('hex'),
      handler: 'FileDeletion',
      parameters: {
        file_paths: [oldPath],
      },
    },
    {
      transaction: transaction,
      user: user,
    }
  )
}
