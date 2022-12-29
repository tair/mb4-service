import sequelizeConn from '../util/db.js'

export async function getStatesForCharacter(characterId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT state_id, name, num, color, user_id, description
      FROM character_states
      WHERE character_id = ?
      ORDER BY num, name`,
    { replacements: [characterId] }
  )

  const states = new Map()
  for (const row of rows) {
    const stateId = parseInt(row.state_id)
    states.set(stateId, row)
  }
  return states
}

export async function getStatesIdsForCharacter(characterId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT state_id
      FROM character_states
      WHERE character_id = ?
      ORDER BY num, name`,
    { replacements: [characterId] }
  )
  return rows.map((row) => parseInt(row.state_id))
}

export async function getTypesForCharacterIds(characterIds) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT character_id, type
      FROM characters
      WHERE character_id IN  (?)
      ORDER BY num, name`,
    { replacements: [characterIds] }
  )

  const types = new Map()
  for (const row of rows) {
    const characterId = parseInt(row.character_id)
    const type = parseInt(row.type)
    types.set(characterId, type)
  }
  return types
}
