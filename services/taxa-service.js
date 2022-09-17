const sequelize = require('../util/db.js')

async function getTaxaDetails(projectId) {
  const taxa_browser = await getTaxaByBrowseType(projectId)

  return {
    taxa_browser: taxa_browser,
  }
}

async function getTaxaByBrowseType(projectId) {
  const [rows] = await sequelize.query(`
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
  let [rows] = await sequelize.query(
    `SELECT 
      taxon_name, unscored_cells, scored_cells,
      cell_warnings, npa_cells,
      not_cells, cell_images, cell_image_labels
    FROM stats_taxa_overview
    WHERE project_id = ? AND matrix_id = ?
    ORDER BY taxon_number`,
    { replacements: [projectId, matrixId] }
  )

  return rows
}

async function buildTaxa(projectId, matrices) {
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

module.exports = {
  getTaxaDetails,
  buildTaxa,
}
