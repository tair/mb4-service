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

export async function getMembersInProject(projectId) {
  const [rows] = await sequelizeConn.query(
    `SELECT user_id, project_id, fname, lname, administrator, member_email, 
    member_role, member_name 
    FROM member_stats WHERE project_id = ?
    ORDER BY member_name`,
    { replacements: [projectId] }
  )
  return rows
}