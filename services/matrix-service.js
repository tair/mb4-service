const { count } = require('console');
const sequelize = require('../util/db.js')

async function getMatrices(projectId) {
  const [rows] = await sequelize.query(`
      SELECT matrix_id, title, user_id
      FROM matrices
      WHERE project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

async function getCounts(matrixIds) {
  if (matrixIds.length == 0) {
    return {};
  }

  const [cellCount] = await sequelize.query(`
        SELECT matrix_id, count(*) c
        FROM cells
        WHERE matrix_id IN (?)
        GROUP BY matrix_id`,
  { replacements: [matrixIds] });

  const [taxaCount] = await sequelize.query(`
        SELECT matrix_id, count(*) c
        FROM matrix_taxa_order
        WHERE matrix_id IN (?)
        GROUP BY matrix_id`,
  { replacements: [matrixIds] });

  const [characterCount] = await sequelize.query(`
        SELECT matrix_id, count(*) c
        FROM matrix_character_order
        WHERE matrix_id IN (?)
        GROUP BY matrix_id`,
  { replacements: [matrixIds] });

  const [continuousCharacterCount] = await sequelize.query(`
        SELECT mco.matrix_id, count(*) c
        FROM matrix_character_order mco
        INNER JOIN characters AS c ON c.character_id = mco.character_id
        WHERE mco.matrix_id IN (?) AND c.type = 1
        GROUP BY mco.matrix_id`,
  { replacements: [matrixIds] });

  const [characterRulesCount] = await sequelize.query(`
				SELECT mco.matrix_id, count(*) c
				FROM character_rules cr
				INNER JOIN matrix_character_order AS mco 
            ON mco.character_id = cr.character_id
				WHERE mco.matrix_id IN (?)
        GROUP BY mco.matrix_id`,
  { replacements: [matrixIds] });

  const cellMediaCount = await sequelize.query(`
        SELECT cxm.matrix_id, count(*) c
        FROM cells_x_media cxm
        WHERE cxm.matrix_id IN (?)
        GROUP BY cxm.matrix_id`,
  { replacements: [matrixIds] });

  const [characterMediaCount] = await sequelize.query(`
        SELECT mco.matrix_id, count(*) c
        FROM matrix_character_order AS mco
        INNER JOIN characters_x_media AS cxm
            ON mco.character_id = cxm.character_id
        WHERE mco.matrix_id IN (?)
        GROUP BY mco.matrix_id`,
  { replacements: [matrixIds] });

  const [mediaLabelCount] = await sequelize.query(`
        SELECT cxm.matrix_id, count(*) c
        FROM cells_x_media cxm
        INNER JOIN media_labels AS ml
            ON ml.link_id = cxm.link_id AND ml.table_num = 7
        WHERE cxm.matrix_id IN (?)
        GROUP BY cxm.matrix_id`,
  { replacements: [matrixIds] });

  // This doesn't actually do a count for polymorphic scores (e.g. scores which
  // contain '-' and an actual character  score). This is because we don't need
  // the numerical value but rather we only need to check that the matrix does
  // or does not contain that score.
  const [polymorphoricCellCount] = await sequelize.query(`
       SELECT DISTINCT matrix_id, 1 AS c
        FROM cells
        WHERE matrix_id IN(?)
        GROUP BY matrix_id, character_id, taxon_id
        HAVING COUNT(*) > 1 AND COUNT(*) > COUNT(state_id)`,
  { replacements: [matrixIds] });

  const convert = function(rows) {
    const obj = {};
    for (const row of rows) {
      obj[row.matrix_id] = row.c;
    }
    return obj;
  }

  return {
    cell_count: convert(cellCount),
    taxa_count: convert(taxaCount),
    character_count: convert(characterCount),
    continuous_character_count: convert(continuousCharacterCount),
    character_rules_count: convert(characterRulesCount),
    cell_media_count: convert(cellMediaCount),
    character_media_count: convert(characterMediaCount),
    media_label_count: convert(mediaLabelCount),
    polymorphoric_cell_count: convert(polymorphoricCellCount),
  }
}

module.exports = {
  getCounts,
  getMatrices,
}
