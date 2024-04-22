import sequelizeConn from '../util/db.js'

export async function getProjectSpecimens(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT s.*, ts.taxon_id
      FROM specimens AS s
      LEFT JOIN taxa_x_specimens AS ts ON s.specimen_id = ts.specimen_id
      WHERE s.project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getSpecimenIdByTaxaIds(projectId, taxaIds) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT txs.taxon_id, s.specimen_id
      FROM specimens s
      INNER JOIN taxa_x_specimens AS txs ON txs.specimen_id = s.specimen_id
      WHERE s.project_id = ? AND txs.taxon_id IN (?) AND s.reference_source = 1`,
    { replacements: [projectId, taxaIds] }
  )

  const map = new Map()
  for (const row of rows) {
    map.set(row.taxon_id, row.specimen_id)
  }
  return map
}

export async function getSpecimenDetails(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT s.reference_source, s.institution_code,s.user_id,
          s.collection_code, s.catalog_number, s.created_on, u.fname, u.lname,
          t.*
      FROM specimens s
      INNER JOIN taxa_x_specimens ts ON s.specimen_id = ts.specimen_id
      INNER JOIN taxa t ON t.taxon_id = ts.taxon_id
      INNER JOIN ca_users u ON u.user_id = s.user_id AND s.project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

export async function isSpecimensInProject(specimenIds, projectId) {
  const [[{ count }]] = await sequelizeConn.query(
    `
    SELECT COUNT(specimen_id) AS count
    FROM specimens
    WHERE project_id = ? AND specimen_id IN (?)`,
    {
      replacements: [projectId, specimenIds],
    }
  )
  return count == specimenIds.length
}

export async function getVoucheredSpecimen(taxonId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT s.specimen_id
    FROM specimen AS s
    INNER JOIN taxa_x_specimens AS txs ON s.specimen_id = txs.specimen_id
    WHERE s.reference_source = 1 AND t.taxon_id = ?`,
    { replacements: [taxonId] }
  )
  return rows.map((r) => r.specimen_id)
}

export async function getUnvoucheredSpecimen(
  taxonId,
  institutionCode,
  collectionCode,
  catalogNumber
) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT s.specimen_id
    FROM specimens s
    INNER JOIN taxa_x_specimens AS txs ON s.specimen_id = txs.specimen_id
    WHERE
      s.reference_source = 0 AND
      s.institution_code = ? AND
      s.collection_code = ?  AND
      s.catalog_number = ?`,
    { replacements: [taxonId, institutionCode, collectionCode, catalogNumber] }
  )
  return rows.map((r) => r.specimen_id)
}

export async function getSpecimenCitations(projectId, specimenId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT
      sxbr.link_id, sxbr.reference_id, sxbr.specimen_id, sxbr.pp, sxbr.notes,
      sxbr.user_id
    FROM specimens_x_bibliographic_references AS sxbr
    INNER JOIN specimens AS s ON s.specimen_id = sxbr.specimen_id
    WHERE s.project_id = ? AND s.specimen_id = ?`,
    { replacements: [projectId, specimenId] }
  )
  return rows
}

export async function isSpecimenCitationsInProject(
  projectId,
  specimenId,
  citationIds
) {
  const [[{ count }]] = await sequelizeConn.query(
    `
    SELECT COUNT(*) AS count
    FROM specimens_x_bibliographic_references AS sxbr
    INNER JOIN specimens AS s ON s.specimen_id = sxbr.specimen_id
    WHERE s.project_id = ? AND s.specimen_id = ? AND sxbr.link_id IN (?)`,
    {
      replacements: [projectId, specimenId, citationIds],
    }
  )
  return count == citationIds.length
}
