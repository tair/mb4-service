import sequelizeConn from '../util/db.js'

export async function getPartitions(projectId) {
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
  const map = new Map()
  if (partitionIds.length == 0) {
    return map
  }

  const [rows] = await sequelizeConn.query(
    `
      SELECT partition_id, taxon_id 
      FROM taxa_x_partitions
      WHERE partition_id IN (?)`,
    { replacements: [partitionIds] }
  )
  for (const row of rows) {
    if (!map.has(row.partition_id)) {
      map.set(row.partition_id, [])
    }
    map.get(row.partition_id).push(row.taxon_id)
  }
  return map
}

export async function getCharactersInPartitions(partitionIds) {
  const map = new Map()
  if (partitionIds.length == 0) {
    return map
  }

  const [rows] = await sequelizeConn.query(
    `
      SELECT partition_id, character_id
      FROM characters_x_partitions
      WHERE partition_id IN (?)`,
    { replacements: [partitionIds] }
  )

  for (const row of rows) {
    if (!map.has(row.partition_id)) {
      map.set(row.partition_id, [])
    }
    map.get(row.partition_id).push(row.character_id)
  }
  return map
}
