import sequelizeConn from '../util/db.js'

export async function getUsersInProjects(projectIds) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT pxu.project_id, u.user_id, u.fname, u.lname, u.email,
    pxu.link_id, pxu.membership_type
    FROM ca_users AS u
    INNER JOIN projects_x_users AS pxu ON pxu.user_id = u.user_id
    WHERE pxu.project_id IN (?)
    ORDER BY u.fname`,
    { replacements: [projectIds] }
  )
  return rows
}
