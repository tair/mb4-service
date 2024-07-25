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

export async function getGroupsForMember(membershipId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT pmxg.link_id, pmg.group_name, pmg.group_id
    FROM project_members_x_groups AS pmxg
    INNER JOIN project_member_groups AS pmg ON pmxg.group_id = pmg.group_id
    WHERE pmxg.membership_id IN (?)
    ORDER BY group_name`,
    { replacements: [membershipId] }
  )
  return rows
}
