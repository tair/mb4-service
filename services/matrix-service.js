import sequelizeConn from '../util/db.js'

async function getMatrices(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT matrix_id, user_id, title
      FROM matrices
      WHERE project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

async function getCounts(matrixIds) {
  if (matrixIds.length == 0) {
    return {}
  }

  const [cellCount] = await sequelizeConn.query(
    `
        SELECT matrix_id, count(*) c
        FROM cells
        WHERE matrix_id IN (?)
        GROUP BY matrix_id`,
    { replacements: [matrixIds] }
  )

  const [taxaCount] = await sequelizeConn.query(
    `
        SELECT matrix_id, count(*) c
        FROM matrix_taxa_order
        WHERE matrix_id IN (?)
        GROUP BY matrix_id`,
    { replacements: [matrixIds] }
  )

  const [characterCount] = await sequelizeConn.query(
    `
        SELECT matrix_id, count(*) c
        FROM matrix_character_order
        WHERE matrix_id IN (?)
        GROUP BY matrix_id`,
    { replacements: [matrixIds] }
  )

  const [continuousCharacterCount] = await sequelizeConn.query(
    `
        SELECT mco.matrix_id, count(*) c
        FROM matrix_character_order mco
        INNER JOIN characters AS c ON c.character_id = mco.character_id
        WHERE mco.matrix_id IN (?) AND c.type = 1
        GROUP BY mco.matrix_id`,
    { replacements: [matrixIds] }
  )

  const [characterRulesCount] = await sequelizeConn.query(
    `
				SELECT mco.matrix_id, count(*) c
				FROM character_rules cr
				INNER JOIN matrix_character_order AS mco 
            ON mco.character_id = cr.character_id
				WHERE mco.matrix_id IN (?)
        GROUP BY mco.matrix_id`,
    { replacements: [matrixIds] }
  )

  const [cellMediaCount] = await sequelizeConn.query(
    `
        SELECT cxm.matrix_id, count(*) c
        FROM cells_x_media cxm
        WHERE cxm.matrix_id IN (?)
        GROUP BY cxm.matrix_id`,
    { replacements: [matrixIds] }
  )

  const [characterMediaCount] = await sequelizeConn.query(
    `
        SELECT mco.matrix_id, count(*) c
        FROM matrix_character_order AS mco
        INNER JOIN characters_x_media AS cxm
            ON mco.character_id = cxm.character_id
        WHERE mco.matrix_id IN (?)
        GROUP BY mco.matrix_id`,
    { replacements: [matrixIds] }
  )

  const [mediaLabelCount] = await sequelizeConn.query(
    `
        SELECT cxm.matrix_id, count(*) c
        FROM cells_x_media cxm
        INNER JOIN media_labels AS ml
            ON ml.link_id = cxm.link_id AND ml.table_num = 7
        WHERE cxm.matrix_id IN (?)
        GROUP BY cxm.matrix_id`,
    { replacements: [matrixIds] }
  )

  // This doesn't actually do a count for polymorphic scores (e.g. scores which
  // contain '-' and an actual character  score). This is because we don't need
  // the numerical value but rather we only need to check that the matrix does
  // or does not contain that score.
  const [polymorphoricCellCount] = await sequelizeConn.query(
    `
       SELECT DISTINCT matrix_id, 1 AS c
        FROM cells
        WHERE matrix_id IN(?)
        GROUP BY matrix_id, character_id, taxon_id
        HAVING COUNT(*) > 1 AND COUNT(*) > COUNT(state_id)`,
    { replacements: [matrixIds] }
  )

  const convert = function (rows) {
    const obj = {}
    for (const row of rows) {
      obj[row.matrix_id] = row.c
    }
    return obj
  }

  return {
    cell: convert(cellCount),
    taxa: convert(taxaCount),
    character: convert(characterCount),
    continuous_character: convert(continuousCharacterCount),
    character_rule: convert(characterRulesCount),
    cell_media: convert(cellMediaCount),
    character_media: convert(characterMediaCount),
    media_label: convert(mediaLabelCount),
    polymorphoric_cell: convert(polymorphoricCellCount),
  }
}

export { getCounts, getMatrices }
