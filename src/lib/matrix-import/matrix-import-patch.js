import Sequelize from 'sequelize'
import sequelizeConn from '../../util/db.js'

/**
 * Minimal optimization patches for immediate issues
 * Can be applied to existing code with minimal changes
 */

/**
 * Execute operation with shorter transaction to avoid lock timeouts
 * @param {Function} operation - The database operation to execute
 * @param {Object} options - Transaction options
 */
export async function withBatchedTransaction(operation, options = {}) {
  const {
    batchSize = 50,
    isolationLevel = Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
  } = options

  const transaction = await sequelizeConn.transaction({ isolationLevel })
  
  try {
    const result = await operation(transaction)
    await transaction.commit()
    return result
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

/**
 * Save multiple records in batches to avoid lock timeouts
 * @param {Array} records - Array of Sequelize model instances
 * @param {Object} options - Save options
 */
export async function saveInBatches(records, options = {}) {
  const { batchSize = 50, ...saveOptions } = options
  const results = []
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    
    // Each batch gets its own transaction
    await withBatchedTransaction(async (transaction) => {
      for (const record of batch) {
        const saved = await record.save({
          ...saveOptions,
          transaction,
          hooks: false,  // Disable hooks for performance
          silent: true   // Reduce logging
        })
        results.push(saved)
      }
    })
    
    // Small delay between batches to let other operations proceed
    if (i + batchSize < records.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return results
}

/**
 * Bulk create with automatic batching
 * @param {Model} model - Sequelize model
 * @param {Array} records - Array of objects to create
 * @param {Object} options - Create options
 */
export async function bulkCreateInBatches(model, records, options = {}) {
  const { batchSize = 1000, ...createOptions } = options
  const results = []
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    
    await withBatchedTransaction(async (transaction) => {
      const created = await model.bulkCreate(batch, {
        ...createOptions,
        transaction,
        hooks: false,
        validate: false,  // Skip validation for performance
        ignoreDuplicates: true
      })
      results.push(...created)
    })
  }
  
  return results
}

/**
 * Update last_modified_on without locking
 * Uses raw query to avoid Sequelize overhead and locking
 */
export async function updateLastModified(tableName, idColumn, id, userId) {
  const timestamp = Math.floor(Date.now() / 1000)
  
  try {
    await sequelizeConn.query(
      `UPDATE ${tableName} 
       SET last_modified_on = :timestamp
       WHERE ${idColumn} = :id
       LIMIT 1`,
      {
      replacements: { timestamp, id },
      type: sequelizeConn.QueryTypes.UPDATE
      }
    )
  } catch (error) {
    // Non-critical update, log but don't throw
    console.warn(`Failed to update last_modified_on for ${tableName}:${id}`, error.message)
  }
}

/**
 * Check if we should process in smaller batches based on data size
 */
export function shouldUseBatchedProcessing(taxaCount, characterCount) {
  const totalCells = taxaCount * characterCount
  
  // Use batched processing for large matrices
  return totalCells > 10000 || taxaCount > 500 || characterCount > 500
}

/**
 * Get optimal batch size based on matrix size
 */
export function getOptimalBatchSize(taxaCount, characterCount) {
  const totalCells = taxaCount * characterCount
  
  if (totalCells > 100000) return 10    // Very large matrix
  if (totalCells > 50000) return 25     // Large matrix
  if (totalCells > 10000) return 50     // Medium matrix
  return 100                             // Small matrix
}

/**
 * Create cells using bulk insert for better performance
 * Direct SQL to avoid Sequelize overhead
 */
export async function bulkInsertCellsOptimized(cells, matrixId, userId) {
  if (!cells || cells.length === 0) return
  
  const timestamp = Math.floor(Date.now() / 1000)
  const chunks = []
  const chunkSize = 500  // MySQL can handle ~1000 values per insert
  
  // Build value strings
  for (let i = 0; i < cells.length; i += chunkSize) {
    const chunk = cells.slice(i, i + chunkSize)
    const values = chunk.map(cell => {
      const charId = cell.character_id || 'NULL'
      const taxonId = cell.taxon_id || 'NULL'
      const stateId = cell.state_id || 'NULL'
      const uncertain = cell.is_uncertain ? 1 : 0
      // Notes are stored in cell_notes table, not in cells
      
      return `(${matrixId}, ${charId}, ${taxonId}, ${stateId}, ${uncertain}, ${userId}, 0, ${timestamp}, ${timestamp})`
    }).join(',')
    
    chunks.push(values)
  }
  
  // Execute inserts in separate transactions
  for (const valueChunk of chunks) {
    await withBatchedTransaction(async (transaction) => {
      await sequelizeConn.query(
        `INSERT INTO cells 
         (matrix_id, character_id, taxon_id, state_id, is_uncertain, user_id, access, created_on, last_modified_on)
         VALUES ${valueChunk}
         ON DUPLICATE KEY UPDATE
           state_id = VALUES(state_id),
           is_uncertain = VALUES(is_uncertain),
           last_modified_on = VALUES(last_modified_on)`,
        { transaction }
      )
    })
  }
}
