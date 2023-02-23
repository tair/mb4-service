import sequelizeConn from '../util/db.js'

export async function getMaxCharacterPositionForMatrix(matrixId) {
  const [[{ p }]] = await sequelizeConn.query(
    'SELECT max(position) AS p FROM matrix_character_order WHERE matrix_id = ?',
    { replacements: [matrixId] }
  )
  return p
}
