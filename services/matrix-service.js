import sequelizeConn from '../util/db.js'
import { Table } from '../util/table.js'
import { models } from '../models/init-models.js'

export async function getMatrix(matrixId) {
  return models.Matrix.findByPk(matrixId)
}

export async function getMatrices(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT matrix_id, user_id, title, type
      FROM matrices
      WHERE project_id = ?`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getCounts(matrixIds) {
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

export async function getTaxaInMatrix(matrixId, partitionId = undefined) {
  const replacements = [matrixId]
  let join = ''
  let clause = ''
  if (partitionId) {
    join += 'INNER JOIN taxa_x_partitions AS txp ON txp.taxon_id = t.taxon_id'
    clause += 'AND txp.partition_id = ?'
    replacements.push(partitionId)
  }
  const [rows] = await sequelizeConn.query(
    `
      SELECT DISTINCT
        t.*, mto.position
      FROM taxa t
      INNER JOIN matrix_taxa_order AS mto ON mto.taxon_id = t.taxon_id
      INNER JOIN matrices AS m ON m.matrix_id = mto.matrix_id
      ${join}
      WHERE
        m.matrix_id = ?
        ${clause}
      ORDER BY mto.position`,
    { replacements }
  )

  return rows
}

export async function getCharactersInMatrix(matrixId, partitionId = undefined) {
  const replacements = [matrixId]
  let join = ''
  let clause = ''
  if (partitionId) {
    join = `INNER JOIN characters_x_partitions AS cxp
        ON cxp.character_id = c.character_id`
    clause = 'AND cxp.partition_id = ?'
    replacements.push(partitionId)
  }
  const [characterRows] = await sequelizeConn.query(
    `
      SELECT
        c.character_id, c.name, c.ordering, c.type, c.description, mco.notes
      FROM characters AS c
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id
      ${join}
      WHERE
        mco.matrix_id = ?
        ${clause}
      ORDER BY mco.position`,
    { replacements: [replacements] }
  )

  const [stateRows] = await sequelizeConn.query(
    `
      SELECT cs.character_id, cs.state_id, cs.name, cs.num, cs.description
      FROM characters c
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id
      INNER JOIN character_states AS cs
        ON cs.character_id = c.character_id
      ${join}
      WHERE
        mco.matrix_id = ?
        ${clause}
      ORDER BY cs.character_id, cs.num`,
    { replacements }
  )
  const statesMap = new Map()
  for (const row of stateRows) {
    const characterId = parseInt(row.character_id)
    if (!statesMap.has(characterId)) {
      statesMap.set(characterId, [])
    }
    statesMap.get(characterId).push(row)
  }

  for (const row of characterRows) {
    const characterId = parseInt(row.character_id)
    const states = statesMap.get(characterId)
    row.states = states
  }

  return characterRows
}

export async function getCharacterRulesInMatrix(matrixId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT
        cr.rule_id, c.name character_name, mco.position character_num,
        cs.name state_name, cs.num state_num, cra.action,
        crac.name action_character_name,
        cramco.position action_position,
        cracs.name action_state_name, cracs.num action_state_num
      FROM character_rules cr
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = cr.character_id
      INNER JOIN characters AS c
        ON c.character_id = mco.character_id
      LEFT JOIN character_states AS cs
        ON cr.state_id = cs.state_id
      INNER JOIN character_rule_actions AS cra
        ON cra.rule_id = cr.rule_id
      INNER JOIN characters AS crac
        ON crac.character_id = cra.character_id
      INNER JOIN matrix_character_order AS cramco
        ON cramco.character_id = cra.character_id
      LEFT JOIN character_states AS cracs
        ON cracs.state_id = cra.state_id
      WHERE mco.matrix_id = ?
      ORDER BY mco.position, cr.rule_id, cramco.position`,
    { replacements: [matrixId] }
  )
  return rows
}

export async function getCells(matrixId, partitionId = undefined) {
  const replacements = [matrixId]
  let join = ''
  let clause = ''
  if (partitionId) {
    join = `
      INNER JOIN characters_x_partitions AS cxp
        ON cxp.character_id = c.character_id AND cxp.partition_id = ?
      INNER JOIN taxa_x_partitions AS txp
        ON txp.character_id = c.taxon_id AND txp.partition_id = cxp.partition_id
      `
    clause = 'AND p.partition_id = ?'
    replacements.push(partitionId)
  }

  const [rows] = await sequelizeConn.query(
    `
      SELECT
        c.cell_id, c.taxon_id, c.character_id, c.state_id, c.is_npa,
        c.is_uncertain, c.start_value, c.end_value
      FROM cells c
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id AND mco.matrix_id = c.matrix_id
      INNER JOIN matrix_taxa_order AS mto
        ON mto.taxon_id = c.taxon_id AND mto.matrix_id = c.matrix_id
      ${join}
      WHERE
        c.matrix_id = ?
        ${clause}
      ORDER BY c.taxon_id, c.character_id, c.state_id`,
    { replacements: replacements }
  )
  const cells = new Table()
  for (const row of rows) {
    const taxonId = parseInt(row.taxon_id)
    const characterId = parseInt(row.character_id)
    if (!cells.has(taxonId, characterId)) {
      cells.set(taxonId, characterId, [])
    }
    cells.get(taxonId, characterId).push(row)
  }
  return cells
}

export async function getCellNotes(matrixId, partitionId = undefined) {
  const replacements = [matrixId]
  let join = ''
  let clause = ''
  if (partitionId) {
    join = `
      INNER JOIN characters_x_partitions AS cxp
        ON cxp.character_id = c.character_id AND cxp.partition_id = ?
      INNER JOIN taxa_x_partitions AS txp
        ON txp.character_id = c.taxon_id AND txp.partition_id = cxp.partition_id
      `
    clause = 'AND p.partition_id = ?'
    replacements.push(partitionId)
  }

  const [rows] = await sequelizeConn.query(
    `
      SELECT
        c.taxon_id, c.character_id, c.notes
      FROM cell_notes c
      INNER JOIN matrix_character_order AS mco
        ON mco.character_id = c.character_id AND mco.matrix_id = c.matrix_id
      INNER JOIN matrix_taxa_order AS mto
        ON mto.taxon_id = c.taxon_id AND mto.matrix_id = c.matrix_id
      ${join}
      WHERE
        c.matrix_id = ?
        ${clause}
      ORDER BY mto.position, mco.position`,
    { replacements: replacements }
  )
  return rows
}

export async function getMatrixBlocks(matrixId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT name, content
      FROM matrix_additional_blocks
      WHERE matrix_id = ?
      ORDER BY name, block_id`,
    { replacements: [matrixId] }
  )
  return rows
}
