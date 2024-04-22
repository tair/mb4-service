import sequelizeConn from '../util/db.js'

export async function getTaxaDetails(projectId) {
  const taxa_browser = await getTaxaByBrowseType(projectId)

  return {
    taxa_browser: taxa_browser,
  }
}

async function getTaxaByBrowseType(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT taxon_id, genus, specific_epithet, subspecific_epithet,
          supraspecific_clade, higher_taxon_kingdom, higher_taxon_phylum,
          higher_taxon_class, higher_taxon_order, higher_taxon_family,
          higher_taxon_superfamily, higher_taxon_subfamily,
          higher_taxon_subclass, higher_taxon_suborder
      FROM taxa
      WHERE project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
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

export async function getTaxonIdsByHash(projectId, hashes) {
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
