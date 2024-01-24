import sequelizeConn from '../util/db.js'

export async function getFolios(projectId) {
  const [rows] = await sequelizeConn.query(
    'SELECT * FROM folios WHERE project_id = ?',
    { replacements: [projectId] }
  )
  return rows
}

export async function isFolioInProject(folioIds, projectId) {
  const [[{ count }]] = await sequelizeConn.query(
    `
    SELECT COUNT(*) AS count
    FROM folios
    WHERE project_id = ? AND folio_id IN (?)`,
    {
      replacements: [projectId, folioIds],
    }
  )
  return count == folioIds.length
}