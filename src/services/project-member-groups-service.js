import sequelizeConn from '../util/db.js'

export async function getGroupsInProject(projectId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT group_id, group_name, description
    FROM project_member_groups
    WHERE project_id IN (?)
    ORDER BY group_name`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getUserGroups(projectId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT GROUP_CONCAT( pmxg.group_id ) AS group_ids, pxu.user_id
    FROM project_members_x_groups pmxg
    INNER JOIN projects_x_users AS pxu ON pmxg.membership_id = pxu.link_id
    WHERE pxu.project_id IN (?)
    GROUP BY pmxg.membership_id`,
    { replacements: [projectId] }
  )
  return rows
}
