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

export async function getTaxaCount(partitionId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT partition_id, taxon_id 
      FROM taxa_x_partitions
      WHERE partition_id = ?`,
    { replacements: [partitionId] }
  )

  return rows.length
}

export async function getCharacterCount(partitionId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT partition_id, character_id
      FROM characters_x_partitions
      WHERE partition_id = ?`,
    { replacements: [partitionId] }
  )

  return rows.length
}

export async function getBibliographiesCount(partitionId, projectId) {
  const references = new Set()

  let [rows] = await sequelizeConn.query(
    `
      SELECT DISTINCT br.reference_id
			FROM bibliographic_references br
			INNER JOIN cells_x_bibliographic_references AS cxbr ON cxbr.reference_id = br.reference_id
			INNER JOIN characters_x_partitions AS cxp ON cxbr.character_id = cxp.character_id
			INNER JOIN taxa_x_partitions AS txp ON cxbr.taxon_id = txp.taxon_id
			WHERE txp.partition_id = ? AND cxp.partition_id = ? AND br.project_id = ?`,
    { replacements: [partitionId, partitionId, projectId] }
  )

  for (const rowSet in rows) {
    for (const row in rowSet) {
      references.add(row)
    }
  }

  rows = await sequelizeConn.query(
    `
      SELECT DISTINCT br.reference_id
			FROM bibliographic_references br
			INNER JOIN characters_x_bibliographic_references AS cxbr ON cxbr.reference_id = br.reference_id
			INNER JOIN characters_x_partitions AS cxp ON cxbr.character_id = cxp.character_id
			WHERE br.project_id = ? AND cxp.partition_id = ?`,
    { replacements: [projectId, partitionId] }
  )

  for (const rowSet in rows) {
    for (const row in rowSet) {
      references.add(row)
    }
  }

  rows = await sequelizeConn.query(
    `
      SELECT DISTINCT br.reference_id
			FROM bibliographic_references br
			INNER JOIN taxa_x_bibliographic_references AS cxbr ON cxbr.reference_id = br.reference_id
			INNER JOIN taxa_x_partitions AS txp ON cxbr.taxon_id = txp.taxon_id
			WHERE br.project_id = ? AND txp.partition_id = ?`,
    { replacements: [projectId, partitionId] }
  )

  for (const rowSet in rows) {
    for (const row in rowSet) {
      references.add(row)
    }
  }

  return references.length
}

export async function getMediaLabelsCount(partitionMediaIds) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT DISTINCT ml.label_id
			FROM media_labels ml
			INNER JOIN media_files AS mf ON mf.media_id = ml.media_id
			WHERE ml.media_id IN (?)`,
    { replacements: [partitionMediaIds] }
  )

  return rows.length
}

export async function getDocumentCount(partitionMediaIds, projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT DISTINCT d.document_id
			FROM project_documents d
			INNER JOIN media_files_x_documents AS mfd ON d.document_id = mfd.document_id
			WHERE mfd.media_id IN (?) AND d.project_id = ?`,
    { replacements: [partitionMediaIds, projectId] }
  )

  return rows.length
}
