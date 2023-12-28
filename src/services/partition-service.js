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

export async function getTaxaInPartitions(partitionIds) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT partition_id, taxon_id 
      FROM taxa_x_partitions
      WHERE partition_id IN (?)`,
    { replacements: [partitionIds] }
  )
  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.partition_id)) {
      map.set(row.partition_id, [])
    }
    map.get(row.partition_id).push(row.taxon_id)
  }
  return map
}

export { getPartitions }
