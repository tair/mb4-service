import sequelizeConn from '../util/db.js'

export async function getMediaViews(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT view_id, user_id, name
      FROM media_views 
      WHERE project_id = ?
    `,
    { replacements: [projectId] }
  )
  return rows
}
