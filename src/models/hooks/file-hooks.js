import config from '../../config.js'
import crypto from 'crypto'
import { models } from '../init-models.js'
import { normalizeJson } from '../../util/json.js'
import { Datamodel } from '../../lib/datamodel/datamodel.js'

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
    if (attributes.file && model.changed(field)) {
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
    if (attributes.file) {
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

  // Handle S3-based media files
  if (json.thumbnail && json.thumbnail.S3_KEY) {
    // This is a new S3-based media file
    const s3Keys = []
    if (json.thumbnail.S3_KEY) s3Keys.push(json.thumbnail.S3_KEY)
    if (json.large && json.large.S3_KEY) s3Keys.push(json.large.S3_KEY)
    if (json.original && json.original.S3_KEY) s3Keys.push(json.original.S3_KEY)

    if (s3Keys.length > 0) {
      const rowKey = `${tableName}/${rowId}/unlink-s3`
      await models.TaskQueue.create(
        {
          user_id: user.user_id,
          priority: 200,
          entity_key: crypto.createHash('md5').update(rowKey).digest('hex'),
          row_key: crypto.createHash('md5').update(rowKey).digest('hex'),
          handler: 'S3FileDeletion',
          parameters: {
            s3_keys: s3Keys,
          },
        },
        {
          transaction: transaction,
          user: user,
        }
      )
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
