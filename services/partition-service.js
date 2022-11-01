import sequelizeConn from '../util/db.js'

async function getPartitions(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT partition_id, name 
      FROM partitions
      WHERE project_id = ?
      ORDER BY name`,
    { replacements: [projectId] }
  )
  return rows
}

export { getPartitions }
