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
  const [[rows]] = await sequelizeConn.query(
    `
      SELECT COUNT(*) AS count
      FROM taxa_x_partitions
      WHERE partition_id = ?`,
    { replacements: [partitionId] }
  )

  return rows.count
}

export async function getCharacterCount(partitionId) {
  const [[rows]] = await sequelizeConn.query(
    `
      SELECT COUNT(*) AS count
      FROM characters_x_partitions
      WHERE partition_id = ?`,
    { replacements: [partitionId] }
  )

  return rows.count
}

export async function getBibliographiesCount(partitionId, projectId) {
  const [[rows]] = await sequelizeConn.query(
    `
      SELECT COUNT(DISTINCT bibliographies.reference_id) AS count 
      FROM (
        SELECT br.reference_id
        FROM bibliographic_references br
        INNER JOIN cells_x_bibliographic_references AS cxbr ON cxbr.reference_id = br.reference_id
        INNER JOIN characters_x_partitions AS cxp ON cxbr.character_id = cxp.character_id
        INNER JOIN taxa_x_partitions AS txp ON cxbr.taxon_id = txp.taxon_id
        WHERE txp.partition_id = :partitionId AND cxp.partition_id = :partitionId AND br.project_id = :projectId
        UNION
        SELECT br.reference_id
        FROM bibliographic_references br
        INNER JOIN characters_x_bibliographic_references AS cxbr ON cxbr.reference_id = br.reference_id
        INNER JOIN characters_x_partitions AS cxp ON cxbr.character_id = cxp.character_id
        WHERE br.project_id = :projectId AND cxp.partition_id = :partitionId
        UNION
        SELECT br.reference_id
        FROM bibliographic_references br
        INNER JOIN taxa_x_bibliographic_references AS cxbr ON cxbr.reference_id = br.reference_id
        INNER JOIN taxa_x_partitions AS txp ON cxbr.taxon_id = txp.taxon_id
        WHERE br.project_id = :projectId AND txp.partition_id = :partitionId
      ) AS bibliographies`,
    { replacements: { partitionId: partitionId, projectId: projectId } }
  )

  return rows.count
}

export async function getMediaLabelsCount(mediaIds) {
  const [[rows]] = await sequelizeConn.query(
    `
      SELECT COUNT(DISTINCT ml.label_id) AS count
      FROM media_labels ml
      INNER JOIN media_files AS mf ON mf.media_id = ml.media_id
      WHERE ml.media_id IN (?)`,
    { replacements: [mediaIds] }
  )

  return rows.count
}

export async function getDocumentCount(mediaIds, projectId) {
  const [[rows]] = await sequelizeConn.query(
    `
      SELECT COUNT(DISTINCT d.document_id) AS count
      FROM project_documents d
      INNER JOIN media_files_x_documents AS mfd ON d.document_id = mfd.document_id
      WHERE mfd.media_id IN (?) AND d.project_id = ?`,
    { replacements: [mediaIds, projectId] }
  )

  return rows.count
}
