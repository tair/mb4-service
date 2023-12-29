import sequelizeConn from '../../util/db.js'
import { QueryTypes } from 'sequelize'
import { time } from '../../util/util.js'
import { getTableNumber } from '../../lib/table-number.js'

export async function logCellChange(model, type, options) {
  const user = options.user
  if (user == null) {
    throw 'User is not defined and therefore cannot generate logs'
  }

  const userId = user.user_id
  if (!userId) {
    throw 'User Id is not defined and therefore cannot generate logs'
  }
  if (!options.transaction) {
    throw 'Unable to insert cell logs because not in a transaction'
  }

  const json = model.generateCellSnapshot(type)
  const snapshot = Object.keys(json).length ? JSON.stringify(json) : null

  const tableNumber = getTableNumber(model)
  if (!tableNumber) {
    throw 'Table number is not defined and cannot be logged.'
  }

  await sequelizeConn.query(
    `
      INSERT INTO cell_change_log(
        change_type, table_num, user_id, changed_on, matrix_id, character_id,
        taxon_id, state_id, snapshot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    {
      replacements: [
        type,
        tableNumber,
        userId,
        time(),
        model.matrix_id,
        model.character_id,
        model.taxon_id,
        model.state_id ?? null,
        snapshot,
      ],
      raw: true,
      type: QueryTypes.INSERT,
      transaction: options.transaction,
    }
  )
}
