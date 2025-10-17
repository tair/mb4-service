#!/usr/bin/env node

/**
 * Project Data Cleanup Script
 * 
 * This script removes records from the target database that exist for a specific project
 * but don't exist in the source database. This ensures the target is truly identical to the source.
 * 
 * Usage:
 *   node cleanup-project-data.js --project-id=123 --source-env=.env.source --target-env=.env.target [--dry-run] [--verbose]
 * 
 * Options:
 *   --project-id    Required. The project ID to clean up
 *   --source-env    Required. Path to source database .env file
 *   --target-env    Required. Path to target database .env file
 *   --dry-run       Optional. Show what would be deleted without actually deleting
 *   --verbose       Optional. Show detailed logging
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Sequelize from 'sequelize'
import dotenv from 'dotenv'
import process from 'node:process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=')
  acc[key.replace('--', '')] = value || true
  return acc
}, {})

if (!args['project-id'] || !args['source-env'] || !args['target-env']) {
  console.error('Error: Missing required arguments')
  console.error('Usage: node cleanup-project-data.js --project-id=123 --source-env=.env.source --target-env=.env.target')
  process.exit(1)
}

const projectId = parseInt(args['project-id'], 10)
const isDryRun = args['dry-run'] === true
const isVerbose = args['verbose'] === true

// Define all tables in the same order as migration (we'll reverse for cleanup)
const MIGRATION_TABLES = [
  // Core project data
  { table: 'projects', key: 'project_id', where: { project_id: projectId } },
  
  // User relationships
  { table: 'projects_x_users', key: 'link_id', where: { project_id: projectId } },
  { table: 'project_member_groups', key: 'group_id', where: { project_id: projectId } },
  { table: 'project_members_x_groups', key: 'link_id', 
    whereFunc: async (sourceDb) => {
      const groups = await sourceDb.query(
        'SELECT group_id FROM project_member_groups WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { group_id: groups.map(g => g.group_id) }
    }
  },
  
  // Institutions
  { table: 'institutions_x_projects', key: 'link_id', where: { project_id: projectId } },
  
  // Taxa and specimens
  { table: 'taxa', key: 'taxon_id', where: { project_id: projectId } },
  { table: 'specimens', key: 'specimen_id', where: { project_id: projectId } },
  
  // Characters and states
  { table: 'characters', key: 'character_id', where: { project_id: projectId } },
  { table: 'character_states', key: 'state_id',
    whereFunc: async (sourceDb) => {
      const chars = await sourceDb.query(
        'SELECT character_id FROM characters WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { character_id: chars.map(c => c.character_id) }
    }
  },
  { table: 'character_orderings', key: 'order_id',
    whereFunc: async (sourceDb) => {
      const matrices = await sourceDb.query(
        'SELECT matrix_id FROM matrices WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { matrix_id: matrices.map(m => m.matrix_id) }
    }
  },
  
  // Character rules
  { table: 'character_rules', key: 'rule_id',
    whereFunc: async (sourceDb) => {
      const chars = await sourceDb.query(
        'SELECT character_id FROM characters WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { character_id: chars.map(c => c.character_id) }
    }
  },
  { table: 'character_rule_actions', key: 'action_id',
    whereFunc: async (sourceDb) => {
      const rules = await sourceDb.query(
        'SELECT cr.rule_id FROM character_rules cr ' +
        'JOIN characters c ON cr.character_id = c.character_id ' +
        'WHERE c.project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { rule_id: rules.map(r => r.rule_id) }
    }
  },
  
  // Cells (matrix data)
  { table: 'cells', key: 'cell_id',
    whereFunc: async (sourceDb) => {
      const result = await sourceDb.query(
        'SELECT cell_id FROM cells WHERE taxon_id IN ' +
        '(SELECT taxon_id FROM taxa WHERE project_id = :projectId)',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { cell_id: result.map(r => r.cell_id) }
    }
  },
  { table: 'cell_notes', key: 'note_id',
    whereFunc: async (sourceDb) => {
      const taxa = await sourceDb.query(
        'SELECT taxon_id FROM taxa WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { taxon_id: taxa.map(t => t.taxon_id) }
    }
  },
  { table: 'cell_batch_log', key: 'log_id',
    whereFunc: async (sourceDb) => {
      const matrices = await sourceDb.query(
        'SELECT matrix_id FROM matrices WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { matrix_id: matrices.map(m => m.matrix_id) }
    }
  },
  { table: 'cell_change_log', key: 'change_id',
    whereFunc: async (sourceDb) => {
      const taxa = await sourceDb.query(
        'SELECT taxon_id FROM taxa WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { taxon_id: taxa.map(t => t.taxon_id) }
    }
  },
  { table: 'character_change_log', key: 'change_id',
    whereFunc: async (sourceDb) => {
      const chars = await sourceDb.query(
        'SELECT character_id FROM characters WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { character_id: chars.map(c => c.character_id) }
    }
  },
  
  // Media files
  { table: 'media_files', key: 'media_id', where: { project_id: projectId } },
  { table: 'media_views', key: 'view_id',
    whereFunc: async (sourceDb) => {
      // media_views links to project via project_id, not media_id
      return { project_id: projectId }
    }
  },
  { table: 'media_labels', key: 'label_id',
    whereFunc: async (sourceDb) => {
      const media = await sourceDb.query(
        'SELECT media_id FROM media_files WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { media_id: media.map(m => m.media_id) }
    }
  },
  
  // Folios
  { table: 'folios', key: 'folio_id', where: { project_id: projectId } },
  { table: 'folios_x_media_files', key: 'link_id',
    whereFunc: async (sourceDb) => {
      const folios = await sourceDb.query(
        'SELECT folio_id FROM folios WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { folio_id: folios.map(f => f.folio_id) }
    }
  },
  
  // Bibliographic references
  { table: 'bibliographic_references', key: 'reference_id', where: { project_id: projectId } },
  { table: 'bibliographic_authors', key: 'author_id',
    whereFunc: async (sourceDb) => {
      const refs = await sourceDb.query(
        'SELECT reference_id FROM bibliographic_references WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { reference_id: refs.map(r => r.reference_id) }
    }
  },
  
  // Cross-reference tables
  { table: 'cells_x_bibliographic_references', key: 'link_id',
    whereFunc: async (sourceDb) => {
      const taxa = await sourceDb.query(
        'SELECT taxon_id FROM taxa WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { taxon_id: taxa.map(t => t.taxon_id) }
    }
  },
  { table: 'cells_x_media', key: 'link_id',
    whereFunc: async (sourceDb) => {
      const taxa = await sourceDb.query(
        'SELECT taxon_id FROM taxa WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { taxon_id: taxa.map(t => t.taxon_id) }
    }
  },
  { table: 'characters_x_bibliographic_references', key: 'link_id',
    whereFunc: async (sourceDb) => {
      const chars = await sourceDb.query(
        'SELECT character_id FROM characters WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { character_id: chars.map(c => c.character_id) }
    }
  },
  { table: 'characters_x_media', key: 'link_id',
    whereFunc: async (sourceDb) => {
      const chars = await sourceDb.query(
        'SELECT character_id FROM characters WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { character_id: chars.map(c => c.character_id) }
    }
  },
  { table: 'taxa_x_bibliographic_references', key: 'link_id',
    whereFunc: async (sourceDb) => {
      const taxa = await sourceDb.query(
        'SELECT taxon_id FROM taxa WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { taxon_id: taxa.map(t => t.taxon_id) }
    }
  },
  { table: 'taxa_x_media', key: 'link_id',
    whereFunc: async (sourceDb) => {
      const taxa = await sourceDb.query(
        'SELECT taxon_id FROM taxa WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { taxon_id: taxa.map(t => t.taxon_id) }
    }
  },
  { table: 'taxa_x_partitions', key: 'link_id',
    whereFunc: async (sourceDb) => {
      const taxa = await sourceDb.query(
        'SELECT taxon_id FROM taxa WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { taxon_id: taxa.map(t => t.taxon_id) }
    }
  },
  { table: 'taxa_x_specimens', key: 'link_id',
    whereFunc: async (sourceDb) => {
      const taxa = await sourceDb.query(
        'SELECT taxon_id FROM taxa WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { taxon_id: taxa.map(t => t.taxon_id) }
    }
  },
  { table: 'taxa_x_resolved_taxonomy', key: 'link_id',
    whereFunc: async (sourceDb) => {
      const taxa = await sourceDb.query(
        'SELECT taxon_id FROM taxa WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { taxon_id: taxa.map(t => t.taxon_id) }
    }
  },
  { table: 'specimens_x_bibliographic_references', key: 'link_id',
    whereFunc: async (sourceDb) => {
      const specimens = await sourceDb.query(
        'SELECT specimen_id FROM specimens WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { specimen_id: specimens.map(s => s.specimen_id) }
    }
  },
  { table: 'media_files_x_bibliographic_references', key: 'link_id',
    whereFunc: async (sourceDb) => {
      const media = await sourceDb.query(
        'SELECT media_id FROM media_files WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { media_id: media.map(m => m.media_id) }
    }
  },
  
  // Partitions
  { table: 'partitions', key: 'partition_id', where: { project_id: projectId } },
  { table: 'characters_x_partitions', key: 'link_id',
    whereFunc: async (sourceDb) => {
      const partitions = await sourceDb.query(
        'SELECT partition_id FROM partitions WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { partition_id: partitions.map(p => p.partition_id) }
    }
  },
  
  // Documents
  { table: 'project_document_folders', key: 'folder_id', where: { project_id: projectId } },
  { table: 'project_documents', key: 'document_id', where: { project_id: projectId } },
  { table: 'media_files_x_documents', key: 'link_id',
    whereFunc: async (sourceDb) => {
      const docs = await sourceDb.query(
        'SELECT document_id FROM project_documents WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { document_id: docs.map(d => d.document_id) }
    }
  },
  
  // Matrices
  { table: 'matrices', key: 'matrix_id', where: { project_id: projectId } },
  { table: 'matrix_character_order', key: 'order_id',
    whereFunc: async (sourceDb) => {
      const matrices = await sourceDb.query(
        'SELECT matrix_id FROM matrices WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { matrix_id: matrices.map(m => m.matrix_id) }
    }
  },
  { table: 'matrix_taxa_order', key: 'order_id',
    whereFunc: async (sourceDb) => {
      const matrices = await sourceDb.query(
        'SELECT matrix_id FROM matrices WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { matrix_id: matrices.map(m => m.matrix_id) }
    }
  },
  { table: 'matrix_file_uploads', key: 'upload_id',
    whereFunc: async (sourceDb) => {
      const matrices = await sourceDb.query(
        'SELECT matrix_id FROM matrices WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { matrix_id: matrices.map(m => m.matrix_id) }
    }
  },
  { table: 'matrix_additional_blocks', key: 'block_id',
    whereFunc: async (sourceDb) => {
      const matrices = await sourceDb.query(
        'SELECT matrix_id FROM matrices WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { matrix_id: matrices.map(m => m.matrix_id) }
    }
  },
  
  // CIPRES requests (linked through matrices)
  { table: 'cipres_requests', key: 'request_id',
    whereFunc: async (sourceDb) => {
      const matrices = await sourceDb.query(
        'SELECT matrix_id FROM matrices WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { matrix_id: matrices.map(m => m.matrix_id) }
    }
  },
  
  // Curation and duplication requests
  { table: 'curation_requests', key: 'request_id',
    whereFunc: async (sourceDb) => {
      // Curation requests for project (table_num = 1)
      const result = await sourceDb.query(
        'SELECT request_id FROM curation_requests WHERE table_num = 1 AND row_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { request_id: result.map(r => r.request_id) }
    }
  },
  { table: 'project_duplication_requests', key: 'request_id', where: { project_id: projectId } },
  
  // Annotations (must be last due to polymorphic references)
  { table: 'annotations', key: 'annotation_id',
    whereFunc: async (sourceDb) => {
      // This is complex because annotations can reference many tables
      // We'll gather all relevant row_ids based on table_num
      let annotationIds = []
      
      // Project annotations (table_num = 1)
      const projectAnnotations = await sourceDb.query(
        'SELECT annotation_id FROM annotations WHERE table_num = 1 AND row_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      annotationIds = annotationIds.concat(projectAnnotations.map(a => a.annotation_id))
      
      // Taxa annotations (table_num = 3)
      const taxaAnnotations = await sourceDb.query(
        'SELECT annotation_id FROM annotations WHERE table_num = 3 AND row_id IN ' +
        '(SELECT taxon_id FROM taxa WHERE project_id = :projectId)',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      annotationIds = annotationIds.concat(taxaAnnotations.map(a => a.annotation_id))
      
      // Character annotations (table_num = 4)
      const charAnnotations = await sourceDb.query(
        'SELECT annotation_id FROM annotations WHERE table_num = 4 AND row_id IN ' +
        '(SELECT character_id FROM characters WHERE project_id = :projectId)',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      annotationIds = annotationIds.concat(charAnnotations.map(a => a.annotation_id))
      
      // Media annotations (table_num = 8)
      const mediaAnnotations = await sourceDb.query(
        'SELECT annotation_id FROM annotations WHERE table_num = 8 AND row_id IN ' +
        '(SELECT media_id FROM media_files WHERE project_id = :projectId)',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      annotationIds = annotationIds.concat(mediaAnnotations.map(a => a.annotation_id))
      
      // Specimen annotations (table_num = 16)
      const specimenAnnotations = await sourceDb.query(
        'SELECT annotation_id FROM annotations WHERE table_num = 16 AND row_id IN ' +
        '(SELECT specimen_id FROM specimens WHERE project_id = :projectId)',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      annotationIds = annotationIds.concat(specimenAnnotations.map(a => a.annotation_id))
      
      // Bibliography annotations (table_num = 17)
      const bibAnnotations = await sourceDb.query(
        'SELECT annotation_id FROM annotations WHERE table_num = 17 AND row_id IN ' +
        '(SELECT reference_id FROM bibliographic_references WHERE project_id = :projectId)',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      annotationIds = annotationIds.concat(bibAnnotations.map(a => a.annotation_id))
      
      // Folio annotations (table_num = 23)
      const folioAnnotations = await sourceDb.query(
        'SELECT annotation_id FROM annotations WHERE table_num = 23 AND row_id IN ' +
        '(SELECT folio_id FROM folios WHERE project_id = :projectId)',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      annotationIds = annotationIds.concat(folioAnnotations.map(a => a.annotation_id))
      
      return { annotation_id: annotationIds }
    }
  },
  { table: 'annotation_events', key: 'event_id',
    whereFunc: async (sourceDb) => {
      // Get all annotation IDs from the previous step
      const annotationIds = await getAnnotationIds(sourceDb, projectId)
      if (annotationIds.length === 0) return { annotation_id: [] }
      
      return { annotation_id: annotationIds }
    }
  },
]

// Helper function to get all annotation IDs for a project
async function getAnnotationIds(sourceDb, projectId) {
  const queries = [
    'SELECT annotation_id FROM annotations WHERE table_num = 1 AND row_id = :projectId',
    'SELECT annotation_id FROM annotations WHERE table_num = 3 AND row_id IN (SELECT taxon_id FROM taxa WHERE project_id = :projectId)',
    'SELECT annotation_id FROM annotations WHERE table_num = 4 AND row_id IN (SELECT character_id FROM characters WHERE project_id = :projectId)',
    'SELECT annotation_id FROM annotations WHERE table_num = 8 AND row_id IN (SELECT media_id FROM media_files WHERE project_id = :projectId)',
    'SELECT annotation_id FROM annotations WHERE table_num = 16 AND row_id IN (SELECT specimen_id FROM specimens WHERE project_id = :projectId)',
    'SELECT annotation_id FROM annotations WHERE table_num = 17 AND row_id IN (SELECT reference_id FROM bibliographic_references WHERE project_id = :projectId)',
    'SELECT annotation_id FROM annotations WHERE table_num = 23 AND row_id IN (SELECT folio_id FROM folios WHERE project_id = :projectId)',
  ]
  
  let allIds = []
  for (const query of queries) {
    const result = await sourceDb.query(query, {
      replacements: { projectId },
      type: Sequelize.QueryTypes.SELECT
    })
    allIds = allIds.concat(result.map(r => r.annotation_id))
  }
  
  return [...new Set(allIds)] // Remove duplicates
}

// Logging utilities
function log(message, level = 'info') {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  
  if (level === 'debug' && !isVerbose) return
  
  if (level === 'error') {
    console.error(`${prefix} ${message}`)
  } else {
    console.log(`${prefix} ${message}`)
  }
}

// Database connection
async function connectToDatabase(envPath, label) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath))
  
  const sequelize = new Sequelize(
    envConfig.DB_SCHEMA,
    envConfig.DB_USER,
    envConfig.DB_PASSWORD,
    {
      host: envConfig.DB_HOST,
      port: envConfig.DB_PORT || 3306,
      dialect: 'mysql',
      logging: isVerbose ? (msg) => log(msg, 'debug') : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 60000,
        idle: 10000
      },
      dialectOptions: {
        connectTimeout: 60000,
        charset: 'utf8mb4',
      }
    }
  )

  try {
    await sequelize.authenticate()
    log(`Connected to ${label} database: ${envConfig.DB_SCHEMA}@${envConfig.DB_HOST}`)
    return sequelize
  } catch (error) {
    log(`Failed to connect to ${label} database: ${error.message}`, 'error')
    throw error
  }
}

// Build WHERE clause from condition object
function buildWhereClause(where) {
  const conditions = []
  const replacements = {}
  
  Object.entries(where).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      conditions.push(`${key} IN (:${key})`)
      replacements[key] = value
    } else {
      conditions.push(`${key} = :${key}`)
      replacements[key] = value
    }
  })
  
  return {
    clause: conditions.join(' AND '),
    replacements
  }
}

// Get records for cleanup
async function getRecordsToCleanup(sourceDb, targetDb, tableConfig) {
  const { table, key } = tableConfig
  
  // Get the where condition
  let where = tableConfig.where
  if (tableConfig.whereFunc) {
    where = await tableConfig.whereFunc(sourceDb)
  }
  
  // If where condition results in empty array, no records to process
  if (where && Object.values(where).some(v => Array.isArray(v) && v.length === 0)) {
    log(`  Skipping ${table} - no related records in source`, 'debug')
    return []
  }
  
  const { clause, replacements } = buildWhereClause(where)
  
  // Get all target IDs matching the project criteria
  const targetRecords = await targetDb.query(
    `SELECT ${key} AS id FROM ${table} WHERE ${clause}`,
    { replacements, type: Sequelize.QueryTypes.SELECT }
  )
  
  if (targetRecords.length === 0) {
    log(`  No records in target for ${table}`, 'debug')
    return []
  }
  
  const targetIds = targetRecords.map(r => r.id)
  
  // Get all source IDs matching the project criteria
  const sourceRecords = await sourceDb.query(
    `SELECT ${key} AS id FROM ${table} WHERE ${clause}`,
    { replacements, type: Sequelize.QueryTypes.SELECT }
  )
  
  const sourceIds = new Set(sourceRecords.map(r => r.id))
  
  // Find IDs that exist in target but not in source
  const idsToDelete = targetIds.filter(id => !sourceIds.has(id))
  
  return idsToDelete
}

// Perform cleanup
async function cleanupProject(sourceDb, targetDb) {
  log(`Starting cleanup for project ${projectId}...`)
  log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`)
  
  const stats = {
    tablesProcessed: 0,
    recordsDeleted: 0,
    tables: {}
  }
  
  // Process tables in REVERSE order to respect FK constraints
  const reversedTables = [...MIGRATION_TABLES].reverse()
  
  const transaction = isDryRun ? null : await targetDb.transaction()
  
  try {
    for (const tableConfig of reversedTables) {
      const { table, key } = tableConfig
      
      log(`Checking ${table}...`, 'debug')
      
      const idsToDelete = await getRecordsToCleanup(sourceDb, targetDb, tableConfig)
      
      if (idsToDelete.length > 0) {
        log(`  Found ${idsToDelete.length} records to delete in ${table}`)
        stats.tables[table] = idsToDelete.length
        
        if (!isDryRun) {
          // Delete in batches to avoid query size limits
          const BATCH_SIZE = 1000
          for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
            const batch = idsToDelete.slice(i, i + BATCH_SIZE)
            await targetDb.query(
              `DELETE FROM ${table} WHERE ${key} IN (:ids)`,
              { 
                replacements: { ids: batch }, 
                type: Sequelize.QueryTypes.DELETE,
                transaction
              }
            )
          }
        }
        
        stats.recordsDeleted += idsToDelete.length
      }
      
      stats.tablesProcessed++
    }
    
    if (!isDryRun) {
      await transaction.commit()
      log('Cleanup transaction committed successfully')
    }
    
    log('\n=== Cleanup Summary ===')
    log(`Tables processed: ${stats.tablesProcessed}`)
    log(`Total records deleted: ${stats.recordsDeleted}`)
    
    if (Object.keys(stats.tables).length > 0) {
      log('\nRecords deleted by table:')
      for (const [table, count] of Object.entries(stats.tables)) {
        log(`  ${table}: ${count}`)
      }
    } else {
      log('\nNo records needed to be deleted - target is already in sync!')
    }
    
    if (isDryRun) {
      log('\n*** DRY RUN COMPLETE - No changes were made ***')
    }
    
  } catch (error) {
    if (transaction && !isDryRun) {
      await transaction.rollback()
      log('Cleanup transaction rolled back due to error', 'error')
    }
    throw error
  }
}

// Main execution
async function main() {
  log('=== Project Data Cleanup Script ===')
  log(`Project ID: ${projectId}`)
  log(`Source env: ${args['source-env']}`)
  log(`Target env: ${args['target-env']}`)
  log(`Dry run: ${isDryRun}`)
  log(`Verbose: ${isVerbose}`)
  log('')

  let sourceDb, targetDb

  try {
    // Connect to databases
    sourceDb = await connectToDatabase(args['source-env'], 'source')
    targetDb = await connectToDatabase(args['target-env'], 'target')

    // Perform cleanup
    await cleanupProject(sourceDb, targetDb)

    log('\n✅ Cleanup completed successfully!')
    process.exit(0)

  } catch (error) {
    log(`Cleanup failed: ${error.message}`, 'error')
    if (isVerbose) {
      console.error(error)
    }
    process.exit(1)

  } finally {
    if (sourceDb) await sourceDb.close()
    if (targetDb) await targetDb.close()
  }
}

main()

