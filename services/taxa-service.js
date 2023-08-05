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

async function getTaxaStatsByMatrixId(projectId, matrixId) {
  let [taxons] = await sequelizeConn.query(
    `SELECT 
      taxon_id, taxon_name, unscored_cells, scored_cells,
      cell_warnings, npa_cells,
      not_cells, cell_images, cell_image_labels, last_modified_on
    FROM stats_taxa_overview
    WHERE project_id = ? AND matrix_id = ?
    ORDER BY taxon_number`,
    { replacements: [projectId, matrixId] }
  )

  let [taxonUsers] = await sequelizeConn.query(
    `SELECT mto.taxon_id, wu.fname, wu.lname
    FROM projects_x_users AS pxu
    LEFT JOIN project_members_x_groups AS pmxg ON pmxg.membership_id = pxu.link_id
    INNER JOIN matrix_taxa_order AS mto ON mto.group_id = pmxg.group_id OR mto.user_id IS NULL OR mto.group_id IS NULL
    INNER JOIN stats_taxa_overview AS sto ON sto.project_id = pxu.project_id AND sto.matrix_id = mto.matrix_id AND sto.taxon_id = mto.taxon_id
    INNER JOIN ca_users AS wu ON pxu.user_id = wu.user_id
    WHERE pxu.project_id = ? AND mto.matrix_id = ?
    ORDER BY mto.taxon_id, wu.lname, wu.fname`,
    { replacements: [projectId, matrixId] }
  )

  for (const taxon of taxons) {
    const users = taxonUsers.filter(user => user.taxon_id == taxon.taxon_id).map(user => `${user.fname} ${user.lname}`)
    // Create a Set to remove duplicates, and convert it back to an array
    const uniqueUsers = [...new Set(users)];
    taxon.members = uniqueUsers
  }

  return taxons
}

export async function buildTaxa(projectId, matrices) {
  const taxaStats = []
  for (const matrix of matrices) {
    const taxonStats = await getTaxaStatsByMatrixId(projectId, matrix.matrix_id)
    taxaStats.push({
      matrix_id: matrix.matrix_id,
      taxonStats,
    })
  }
  return taxaStats
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
          is_extinct, use_parens_for_author, notes,
          scientific_name_author,
          scientific_name_year,
          created_on, last_modified_on
      FROM taxa
      WHERE project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}
