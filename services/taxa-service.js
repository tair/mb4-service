import sequelizeConn from '../util/db.js';

async function getTaxaDetails(project_id) {
  const taxa_browser = await getTaxaByBrowseType(project_id)

  return {
    taxa_browser: taxa_browser,
  }
}

async function getTaxaByBrowseType(project_id) {
  const [rows, metadata] = await sequelizeConn.query(
    `select 
      taxon_id, genus, specific_epithet, subspecific_epithet,
      supraspecific_clade, higher_taxon_kingdom,
      higher_taxon_phylum, higher_taxon_class,
      higher_taxon_order, higher_taxon_family,
      higher_taxon_superfamily, higher_taxon_subfamily,
      higher_taxon_subclass, higher_taxon_suborder
    from 
      taxa where project_id=${project_id}`
  )
  return rows
}

async function getTaxasByMatrixId(project_id, matrix_id) {
  let [rows, metadata] = await sequelizeConn.query(
    `SELECT 
      taxon_name, unscored_cells, scored_cells,
      cell_warnings, npa_cells,
      not_cells, cell_images, cell_image_labels
    FROM stats_taxa_overview
    WHERE project_id = ${project_id} AND matrix_id=${matrix_id}
    ORDER BY taxon_number`
  )

  return rows
}

async function buildTaxas(project_id, matrices) {
  let taxas = []
  for (var i in matrices) {
    let taxa = await getTaxasByMatrixId(project_id, matrices[i].matrix_id)
    taxa = {
      matrix_id: matrices[i].matrix_id,
      taxa,
    }
    taxas.push(taxa)
  }
  return taxas
}

export {getTaxaDetails, buildTaxas}