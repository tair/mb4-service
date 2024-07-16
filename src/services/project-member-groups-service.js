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