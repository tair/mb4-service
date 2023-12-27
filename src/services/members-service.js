import sequelizeConn from '../util/db.js'

export async function getProjectMemberGroups(projectId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT *
    FROM project_member_groups
    WHERE project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}
