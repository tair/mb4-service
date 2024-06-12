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
    SELECT pu.user_id, cu.fname, cu.lname, cu.email, 
    pu.membership_type 
    FROM projects_x_users AS pu
    INNER JOIN ca_users AS cu ON cu.user_id=pu.user_id
    WHERE pu.project_id = ?
    ORDER BY cu.fname`,
    { replacements: [projectId] }
  )
  return rows
}