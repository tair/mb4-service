import sequelizeConn from '../util/db.js'

export async function getUsersInProjects(projectIds) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT pxu.project_id, u.user_id, u.fname, u.lname, u.email
    FROM ca_users AS u
    INNER JOIN projects_x_users AS pxu ON pxu.user_id = u.user_id
    WHERE pxu.project_id IN (?)`,
    { replacements: [projectIds] }
  )
  return rows
}

export async function getMembersInProject(projectId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT pu.user_id, u.fname, u.lname, u.email, 
    pu.membership_type 
    FROM projects_x_users AS pu
    INNER JOIN ca_users AS u ON u.user_id=pu.user_id
    WHERE pu.project_id = ?
    ORDER BY cu.fname`,
    { replacements: [projectId] }
  )
  return rows
}
