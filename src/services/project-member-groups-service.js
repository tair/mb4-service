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
  const map = new Map()

  const [rows] = await sequelizeConn.query(
    `
    SELECT JSON_ARRAYAGG( pmxg.group_id ) AS group_ids, pxu.user_id
    FROM project_members_x_groups pmxg
    INNER JOIN projects_x_users AS pxu ON pmxg.membership_id = pxu.link_id
    WHERE pxu.project_id IN (?)
    GROUP BY pmxg.membership_id`,
    { replacements: [projectId] }
  )
  for (const row of rows) {
    map.set(row.user_id, row.group_ids)
  }
  return map
}

export async function isGroupInProject(groupIds, projectId) {
  const [[{ count }]] = await sequelizeConn.query(
    `
    SELECT COUNT(group_id) AS count
    FROM project_member_groups
    WHERE project_id = ? AND group_id IN (?)`,
    {
      replacements: [projectId, groupIds],
    }
  )
  return count == groupIds.length
}
