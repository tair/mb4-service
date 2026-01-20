import sequelizeConn from '../util/db.js'
import {
  TAXA_FIELD_NAMES,
  getTaxonNameForPublishedProject,
} from '../util/taxa.js'

// for project detail dump
export async function getTaxaDetails(projectId) {
  const rows = await getTaxaByBrowseType(projectId)
  const partitionMap = await getTaxaPartitionMap(projectId)
  const matrixMap = await getTaxaMatrixMap(projectId)
  return rows.map((r) => {
    let sortFields = {}
    for (const fieldName of TAXA_FIELD_NAMES) {
      if (r[fieldName]) sortFields[fieldName] = r[fieldName]
    }
    const obj = {
      sort_fields: sortFields,
      taxon_name: getTaxonNameForPublishedProject(r),
    }
    if (r.notes) obj.notes = r.notes
    if (r.lookup_failed_on > 0) obj.lookup_failed = true
    if (r.pbdb_taxon_id > 0) obj.pbdb_verified = true
    if (partitionMap[r.taxon_id]) obj.partitions = partitionMap[r.taxon_id]
    if (matrixMap[r.taxon_id]) obj.matrices = matrixMap[r.taxon_id]
    return obj
  })
}

async function getTaxaByBrowseType(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT *
      FROM taxa
      WHERE project_id = ?`,
    { replacements: [projectId] }
  )

  return rows
}

async function getTaxaPartitionMap(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT t.taxon_id, p.partition_id
      FROM taxa t
      INNER JOIN taxa_x_partitions tp ON t.taxon_id = tp.taxon_id
      INNER JOIN partitions p ON p.partition_id = tp.partition_id
      WHERE p.project_id = ?`,
    { replacements: [projectId] }
  )
  let partitionMap = {}
  for (let i = 0; i < rows.length; i++) {
    let data = rows[i]
    if (!partitionMap[data.taxon_id]) {
      partitionMap[data.taxon_id] = []
    }
    partitionMap[data.taxon_id].push(data.partition_id)
  }

  return partitionMap
}

async function getTaxaMatrixMap(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT t.taxon_id, m.matrix_id
      FROM taxa t
      INNER JOIN matrix_taxa_order mt ON t.taxon_id = mt.taxon_id
      INNER JOIN matrices m ON m.matrix_id = mt.matrix_id
      WHERE m.project_id = ?`,
    { replacements: [projectId] }
  )
  let matrixMap = {}
  for (let i = 0; i < rows.length; i++) {
    let data = rows[i]
    if (!matrixMap[data.taxon_id]) {
      matrixMap[data.taxon_id] = []
    }
    matrixMap[data.taxon_id].push(data.matrix_id)
  }

  return matrixMap
}

export async function getTaxaInProject(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT taxon_id, genus, subgenus, specific_epithet, subspecific_epithet,
          supraspecific_clade,
          higher_taxon_kingdom,
          higher_taxon_phylum,
          higher_taxon_class,
          higher_taxon_order,
          higher_taxon_family,
          higher_taxon_superfamily,
          higher_taxon_subfamily,
          higher_taxon_subclass,
          higher_taxon_suborder,
          higher_taxon_tribe,
          higher_taxon_subtribe,
          higher_taxon_infraorder,
          higher_taxon_cohort,
          higher_taxon_infraclass,
          user_id,
          is_extinct, use_parens_for_author, notes, access,
          scientific_name_author,
          scientific_name_year,
          created_on, last_modified_on
      FROM taxa
      WHERE project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getTaxonName(taxonIds) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT taxon_id, genus, specific_epithet
      FROM taxa
      WHERE taxon_id IN (?)`,
    { replacements: [taxonIds] }
  )
  return rows
}

/**
 * Search taxa within a project by text matching on taxon name fields
 * @param {number} projectId - The project ID to search within
 * @param {string} text - The search text
 * @returns {Promise<number[]>} Array of matching taxon IDs, limited to 50 results
 */
export async function searchTaxa(projectId, text) {
  if (!text || text.trim().length === 0) {
    return []
  }

  const searchTerm = `%${text.trim()}%`
  
  const [rows] = await sequelizeConn.query(
    `
    SELECT taxon_id
    FROM taxa
    WHERE project_id = ?
    AND (
      genus LIKE ? OR
      subgenus LIKE ? OR
      specific_epithet LIKE ? OR
      subspecific_epithet LIKE ? OR
      supraspecific_clade LIKE ? OR
      higher_taxon_kingdom LIKE ? OR
      higher_taxon_phylum LIKE ? OR
      higher_taxon_class LIKE ? OR
      higher_taxon_subclass LIKE ? OR
      higher_taxon_infraclass LIKE ? OR
      higher_taxon_cohort LIKE ? OR
      higher_taxon_order LIKE ? OR
      higher_taxon_suborder LIKE ? OR
      higher_taxon_infraorder LIKE ? OR
      higher_taxon_superfamily LIKE ? OR
      higher_taxon_family LIKE ? OR
      higher_taxon_subfamily LIKE ? OR
      higher_taxon_tribe LIKE ? OR
      higher_taxon_subtribe LIKE ? OR
      scientific_name_author LIKE ? OR
      scientific_name_year LIKE ? OR
      notes LIKE ?
    )
    ORDER BY 
      CASE 
        WHEN genus LIKE ? THEN 1
        WHEN specific_epithet LIKE ? THEN 2
        WHEN supraspecific_clade LIKE ? THEN 3
        WHEN higher_taxon_family LIKE ? THEN 4
        ELSE 5
      END,
      taxon_id
    LIMIT 50`,
    {
      replacements: [
        projectId,
        searchTerm, searchTerm, searchTerm, searchTerm, searchTerm,
        searchTerm, searchTerm, searchTerm, searchTerm, searchTerm,
        searchTerm, searchTerm, searchTerm, searchTerm, searchTerm,
        searchTerm, searchTerm, searchTerm, searchTerm, searchTerm,
        searchTerm, searchTerm,
        searchTerm, searchTerm, searchTerm, searchTerm
      ],
    }
  )
  
  return rows.map((r) => r.taxon_id)
}

export async function getEolInfo(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT taxon_id, eol_pulled_on, eol_set_on, eol_no_results_on
      FROM taxa
      WHERE project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getiDigBioInfo(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT taxon_id, idigbio_pulled_on, idigbio_set_on, idigbio_no_results_on
      FROM taxa
      WHERE project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getPbdbInfo(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT taxon_id, pbdb_pulled_on, pbdb_taxon_id
      FROM taxa
      WHERE project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getTaxonIdsByHash(projectId, hashes) {
  // Avoid SQL syntax error: "IN ()"
  if (!hashes || hashes.length === 0) {
    return []
  }
  const [rows] = await sequelizeConn.query(
    `
      SELECT taxon_id, taxon_hash
      FROM taxa
      WHERE project_id = ? AND taxon_hash IN (?)`,
    { replacements: [projectId, hashes] }
  )
  return rows
}

export async function isTaxaInProject(taxaIds, projectId) {
  const [[{ count }]] = await sequelizeConn.query(
    `
    SELECT COUNT(taxon_id) AS count
    FROM taxa
    WHERE project_id = ? AND taxon_id IN (?)`,
    {
      replacements: [projectId, taxaIds],
    }
  )
  return count == taxaIds.length
}

export async function getMatrixIds(taxaIds) {
  // If no taxa IDs provided, return empty array to avoid SQL syntax error
  if (!taxaIds || taxaIds.length === 0) {
    return []
  }

  const [rows] = await sequelizeConn.query(
    'SELECT taxon_id, matrix_id FROM matrix_taxa_order WHERE taxon_id IN (?)',
    {
      replacements: [taxaIds],
    }
  )
  return rows
}

export async function getTaxonCitations(projectId, taxonId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT
      txbr.link_id, txbr.reference_id, txbr.taxon_id, txbr.pp, txbr.notes,
      txbr.user_id
    FROM taxa_x_bibliographic_references AS txbr
    INNER JOIN taxa AS t ON t.taxon_id = txbr.taxon_id
    WHERE t.project_id = ? AND t.taxon_id = ?`,
    { replacements: [projectId, taxonId] }
  )
  return rows
}

export async function isTaxonCitationsInProject(
  projectId,
  taxonId,
  citationIds
) {
  const [[{ count }]] = await sequelizeConn.query(
    `
    SELECT COUNT(*) AS count
    FROM taxa_x_bibliographic_references AS txbr
    INNER JOIN taxa AS t ON t.taxon_id = txbr.taxon_id
    WHERE t.project_id = ? AND t.taxon_id = ? AND txbr.link_id IN (?)`,
    {
      replacements: [projectId, taxonId, citationIds],
    }
  )
  return count == citationIds.length
}

/**
 * Get media counts for all taxa in a project.
 * Media is linked to taxa through specimens (media_files -> specimens -> taxa_x_specimens -> taxa).
 * @param {number} projectId - The project ID
 * @returns {Promise<Object>} Map of taxon_id to media_count
 */
export async function getTaxaMediaCounts(projectId) {
  const [rows] = await sequelizeConn.query(
    `
    SELECT t.taxon_id, COUNT(DISTINCT mf.media_id) as media_count
    FROM taxa t
    LEFT JOIN taxa_x_specimens ts ON t.taxon_id = ts.taxon_id
    LEFT JOIN media_files mf ON ts.specimen_id = mf.specimen_id
    WHERE t.project_id = ?
    GROUP BY t.taxon_id`,
    { replacements: [projectId] }
  )

  const mediaCountMap = {}
  for (const row of rows) {
    mediaCountMap[row.taxon_id] = parseInt(row.media_count) || 0
  }
  return mediaCountMap
}
