import sequelizeConn from '../../util/db.js'
import { DataTypes, QueryTypes } from 'sequelize'
import { time } from '../../util/util.js'
import { getTableNumber } from '../../lib/table-number.js'

export async function logChange(model, type, options) {
  const user = options.user
  if (user == null) {
    throw 'User is not defined so cannot generate logs'
  }

  const userId = user.user_id || user.userId
  if (!userId) {
    throw 'User ID is not defined and cannot be logged'
  }

  const primaryKeys = getPrimaryKey(model)
  if (primaryKeys.length != 1) {
    throw 'Model does not have a single primary key cannot have logged'
  }

  const rowId = model[primaryKeys[0]]
  if (!rowId) {
    throw 'Row Id is not defined and cannot be logged.'
  }

  const tableNumber = getTableNumber(model)
  if (!tableNumber) {
    throw 'Table number is not defined and cannot be logged.'
  }

  const snapshot = {}
  for (const [field, attributes] of Object.entries(model.rawAttributes)) {
    if (model.changed(field) && shouldLogAttributes(attributes)) {
      snapshot[field] = model.getDataValue(field)
    }
  }

  // Do not generate a log if the snapshot is empty.
  if (Object.keys(snapshot).length == 0) {
    return
  }

  await sequelizeConn.query(
    `
      INSERT INTO ca_change_log(
        log_datetime, user_id, changetype, logged_table_num, logged_row_id,
        snapshot, rolledback)
      VALUES (?, ?, ?, ?, ?, ?, 0)`,
    {
      replacements: [
        time(),
        userId,
        type,
        tableNumber,
        rowId,
        JSON.stringify(snapshot),
      ],
      raw: true,
      type: QueryTypes.INSERT,
      transaction: options.transaction,
    }
  )
}

function getPrimaryKey(model) {
  const primaryKeys = []
  for (const [field, attributes] of Object.entries(model.rawAttributes)) {
    if (attributes.primaryKey) {
      primaryKeys.push(field)
    }
  }
  return primaryKeys
}

function shouldLogAttributes(attributes) {
  if (attributes.shouldLog === false) {
    return false
  }

  switch (attributes.type) {
    case DataTypes.JSON:
      return false
    default:
      return true
  }
}
