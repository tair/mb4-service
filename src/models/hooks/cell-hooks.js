import sequelizeConn from '../../util/db.js'
import { QueryTypes } from 'sequelize'
import { time } from '../../util/util.js'
import { getTableNumber } from '../../lib/table-number.js'

export async function logCellChange(model, type, options) {
  const user = options.user
  if (user == null) {
    throw 'User is not defined and therefore cannot generate logs'
  }

  const userId = user.user_id
  if (!userId) {
    throw 'User Id is not defined and therefore cannot generate logs'
  }
  if (!options.transaction) {
    throw 'Unable to insert cell logs because not in a transaction'
  }

  const json = model.generateCellSnapshot(type)
  const snapshot = Object.keys(json).length ? JSON.stringify(json) : null

  const tableNumber = getTableNumber(model)
  if (!tableNumber) {
    throw 'Table number is not defined and cannot be logged.'
  }

  await sequelizeConn.query(
    `
      INSERT INTO cell_change_log(
        change_type, table_num, user_id, changed_on, matrix_id, character_id,
        taxon_id, state_id, snapshot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    {
      replacements: [
        type,
        tableNumber,
        userId,
        time(),
        model.matrix_id,
        model.character_id,
        model.taxon_id,
        model.state_id ?? null,
        snapshot,
      ],
      raw: true,
      type: QueryTypes.INSERT,
      transaction: options.transaction,
    }
  )
}

/**
 * Find all composite taxa that use the given taxon as a source in the given matrix
 * @param {number} taxonId - The source taxon ID
 * @param {number} matrixId - The matrix ID
 * @param {Transaction} transaction - Optional transaction
 * @returns {Promise<Array>} Array of composite taxon records with composite_taxon_id and taxon_id
 */
export async function findCompositeTaxaForSource(taxonId, matrixId, transaction = null) {
  // Skip if this is a cell for a composite taxon itself (to avoid infinite loops)
  const [compositeCheck] = await sequelizeConn.query(
    `SELECT composite_taxon_id FROM composite_taxa WHERE taxon_id = ? AND matrix_id = ?`,
    {
      replacements: [taxonId, matrixId],
      type: QueryTypes.SELECT,
      transaction,
    }
  )
  if (compositeCheck) {
    return [] // This is a composite taxon's cell, don't trigger recalculation
  }

  // Find composite taxa that use this taxon as a source
  const [rows] = await sequelizeConn.query(
    `
    SELECT ct.composite_taxon_id, ct.taxon_id as composite_taxon_row_id
    FROM composite_taxa ct
    INNER JOIN composite_taxa_sources cts ON cts.composite_taxon_id = ct.composite_taxon_id
    WHERE ct.matrix_id = ? AND cts.source_taxon_id = ?`,
    {
      replacements: [matrixId, taxonId],
      transaction,
    }
  )

  return rows.map(row => ({
    compositeTaxonId: parseInt(row.composite_taxon_id),
    compositeTaxonRowId: parseInt(row.composite_taxon_row_id),
  }))
}

/**
 * Find all composite taxa affected by changes to any of the given taxa
 * @param {number[]} taxonIds - Array of source taxon IDs
 * @param {number} matrixId - The matrix ID
 * @param {Transaction} transaction - Optional transaction
 * @returns {Promise<Array>} Array of unique composite taxon records
 */
export async function findCompositeTaxaForSources(taxonIds, matrixId, transaction = null) {
  if (!taxonIds || taxonIds.length === 0) {
    return []
  }

  // Find composite taxa that use any of these taxa as sources
  const [rows] = await sequelizeConn.query(
    `
    SELECT DISTINCT ct.composite_taxon_id, ct.taxon_id as composite_taxon_row_id
    FROM composite_taxa ct
    INNER JOIN composite_taxa_sources cts ON cts.composite_taxon_id = ct.composite_taxon_id
    WHERE ct.matrix_id = ? AND cts.source_taxon_id IN (?)
    AND ct.taxon_id NOT IN (?)`,
    {
      replacements: [matrixId, taxonIds, taxonIds],
      transaction,
    }
  )

  return rows.map(row => ({
    compositeTaxonId: parseInt(row.composite_taxon_id),
    compositeTaxonRowId: parseInt(row.composite_taxon_row_id),
  }))
}
