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
    `
    SELECT pxu.project_id, u.user_id, u.fname, u.lname, u.email
    FROM member_stats AS u
    INNER JOIN projects_x_users AS pxu ON pxu.project_id = u.project_id
    WHERE pxu.project_id IN ?`,
    { replacements: [projectId] }
  )
  return rows
}