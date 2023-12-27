import sequelizeConn from '../../util/db.js'
import { QueryTypes } from 'sequelize'
import { time } from '../../util/util.js'

export async function logCharacterChange(model, type, options) {
  const isMinorEdit = options.is_minor_edit ? 1 : 0
  const user = options.user
  if (user == null) {
    throw new Error('User is not defined so cannot generate logs')
  }

  const userId = user.user_id
  if (!userId) {
    throw new Error('User ID is not defined and cannot be logged')
  }

  await sequelizeConn.query(
    `
    INSERT INTO character_change_log(
      change_type, user_id, changed_on, character_id, is_minor_edit)
    VALUES (?, ?, ?, ?, ?)`,
    {
      replacements: [type, userId, time(), model.character_id, isMinorEdit],
      raw: true,
      type: QueryTypes.INSERT,
      transaction: options.transaction,
    }
  )
}
