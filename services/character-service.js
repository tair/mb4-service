import sequelizeConn from '../util/db.js';

export async function getStatesForCharacter(characterId) {
  const [rows] = await sequelizeConn.query(`
			SELECT state_id, name, num, color, user_id, description
			FROM character_states
			WHERE character_id = ?
      ORDER BY num, name`,
    { replacements: [characterId]});

  const states = new Map()
  for (const row of rows) {
    const stateId = parseInt(row.state_id)
    states.set(stateId, row)
  }
  return states
}

export async function getStatesIdsForCharacter(characterId) {
  const [rows] = await sequelizeConn.query(`
			SELECT state_id
			FROM character_states
			WHERE character_id = ?
      ORDER BY num, name`,
    { replacements: [characterId] });
  return rows.map(row => parseInt(row.state_id))
}
