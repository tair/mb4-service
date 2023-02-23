import sequelizeConn from '../util/db.js'

export async function getMaxTaxonPositionForMatrix(matrixId) {
  const [[{ pos }]] = await sequelizeConn.query(
    'SELECT max(position) AS pos FROM matrix_taxa_order WHERE matrix_id = ?',
    { replacements: [matrixId] }
  )
  return pos
}
