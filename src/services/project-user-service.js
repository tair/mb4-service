import sequelizeConn from '../util/db.js'

export async function getUsersInProjects(projectIds) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT pxu.project_id, u.user_id, u.fname, u.lname, u.email,
    pxu.link_id, pxu.membership_type,
    (SELECT GROUP_CONCAT( pmxg.group_id )
    FROM project_members_x_groups pmxg
    WHERE pmxg.membership_id = pxu.link_id) AS group_ids
    FROM ca_users AS u
    INNER JOIN projects_x_users AS pxu ON pxu.user_id = u.user_id
    WHERE pxu.project_id IN (?)
    ORDER BY u.fname`,
    { replacements: [projectIds] }
  )
  return rows
}
