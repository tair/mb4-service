#!/usr/bin/env node

/**
 * Project Data Migration Script
 * 
 * This script exports all data related to a specific project ID from one database
 * and imports/overrides that data into another database, ensuring data consistency
 * between both databases.
 * 
 * Usage:
 *   node migrate-project-data.js --project-id=123 --source-env=.env.source --target-env=.env.target [--dry-run] [--verbose]
 * 
 * Options:
 *   --project-id    Required. The project ID to migrate
 *   --source-env    Required. Path to source database .env file
 *   --target-env    Required. Path to target database .env file
 *   --dry-run       Optional. Perform validation only without making changes
 *   --verbose       Optional. Show detailed logging
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Sequelize from 'sequelize'
import dotenv from 'dotenv'
import process from 'node:process'
import { S3Client, PutObjectCommand, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import sharp from 'sharp'
import axios from 'axios'

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
  console.error('Usage: node migrate-project-data.js --project-id=123 --source-env=.env.source --target-env=.env.target')
  process.exit(1)
}

const projectId = parseInt(args['project-id'], 10)
const isDryRun = args['dry-run'] === true
const isVerbose = args['verbose'] === true
const skipS3Migration = args['skip-s3'] === true
const skipDumps = args['skip-dumps'] === true

// Define all tables that need to be migrated in dependency order
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
  { table: 'matrix_file_uploads', key: 'upload_id',
    whereFunc: async (sourceDb) => {
      const matrices = await sourceDb.query(
        'SELECT matrix_id FROM matrices WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      return { matrix_id: matrices.map(m => m.matrix_id) }
    }
  },
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
      const tableNums = {
        1: 'projects',
        3: 'taxa',
        4: 'characters',
        8: 'media_files',
        16: 'specimens',
        17: 'bibliographic_references',
        23: 'folios',
      }
      
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

// Tables with unique constraints independent of primary key we must honor
const UNIQUE_KEY_MAP = {
  matrix_character_order: ['matrix_id', 'position'],
  matrix_taxa_order: ['matrix_id', 'position'],
}

// Robust HTTP fetch for legacy media with headers to avoid 403, modeled after migrate-journal-covers
async function httpGetBuffer(url, retryCount = 0) {
  const headers = {
    'User-Agent': 'MorphoBank-Migration-Script/1.0',
    'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  }
  try {
    const res = await axios({ method: 'GET', url, responseType: 'arraybuffer', timeout: 30000, headers, validateStatus: () => true })
    if (res.status >= 200 && res.status < 300) {
      return Buffer.from(res.data)
    }
    // one fallback: swap https->http
    if (retryCount === 0) {
      const u = new URL(url)
      if (u.protocol === 'https:') {
        const httpUrl = 'http://' + u.host + u.pathname + (u.search || '')
        const res2 = await axios({ method: 'GET', url: httpUrl, responseType: 'arraybuffer', timeout: 30000, headers, validateStatus: () => true })
        if (res2.status >= 200 && res2.status < 300) return Buffer.from(res2.data)
      }
    }
    throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  } catch (err) {
    if (retryCount < 2) {
      await new Promise(r => setTimeout(r, 2000 * (retryCount + 1)))
      return httpGetBuffer(url, retryCount + 1)
    }
    throw err
  }
}

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

// Load environment configurations
function loadEnvConfig(envPath) {
  const envConfig = dotenv.parse(fs.readFileSync(path.resolve(envPath)))
  return {
    host: envConfig.DB_HOST,
    user: envConfig.DB_USER,
    database: envConfig.DB_SCHEMA,
    password: envConfig.DB_PASSWORD,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 10,
      min: 5,
      acquire: 60000,
      idle: 10000,
    },
    dialectOptions: {
      connectTimeout: 60000,
      charset: 'utf8mb4',
    },
    aws: {
      region: envConfig.AWS_REGION,
      accessKeyId: envConfig.AWS_ACCESS_KEY_ID,
      secretAccessKey: envConfig.AWS_SECRET_ACCESS_KEY,
      defaultBucket: envConfig.AWS_S3_DEFAULT_BUCKET || 'mb4-data',
    },
  }
}

// Create database connections
const sourceConfig = loadEnvConfig(args['source-env'])
const targetConfig = loadEnvConfig(args['target-env'])

const sourceDb = new Sequelize(
  sourceConfig.database,
  sourceConfig.user,
  sourceConfig.password,
  sourceConfig
)

const targetDb = new Sequelize(
  targetConfig.database,
  targetConfig.user,
  targetConfig.password,
  targetConfig
)

// Initialize S3 client if needed
let s3Client = null
if (!skipS3Migration && targetConfig.aws.accessKeyId) {
  s3Client = new S3Client({
    region: targetConfig.aws.region,
    credentials: {
      accessKeyId: targetConfig.aws.accessKeyId,
      secretAccessKey: targetConfig.aws.secretAccessKey,
    },
  })
}

// Logging functions
function log(message, level = 'info') {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  
  if (level === 'error') {
    console.error(`${prefix} ${message}`)
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}`)
  } else if (level === 'debug' && isVerbose) {
    console.log(`${prefix} ${message}`)
  } else if (level === 'info') {
    console.log(`${prefix} ${message}`)
  }
}

// Validate project exists in source database
async function validateProject(db, projectId) {
  const [project] = await db.query(
    'SELECT project_id, name, deleted FROM projects WHERE project_id = :projectId',
    { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
  )
  
  if (!project) {
    throw new Error(`Project ${projectId} not found in source database`)
  }
  
  if (project.deleted === 1) {
    log(`Warning: Project ${projectId} (${project.name}) is marked as deleted`, 'warn')
  }
  
  return project
}

// Count records for a table with given conditions
async function countRecords(db, table, where) {
  let whereClause = ''
  let replacements = {}
  
  if (where) {
    const conditions = Object.entries(where).map(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length === 0) return '1=0' // No records if empty array
        replacements[key] = value
        return `${key} IN (:${key})`
      } else {
        replacements[key] = value
        return `${key} = :${key}`
      }
    })
    whereClause = `WHERE ${conditions.join(' AND ')}`
  }
  
  const [result] = await db.query(
    `SELECT COUNT(*) as count FROM ${table} ${whereClause}`,
    { replacements, type: Sequelize.QueryTypes.SELECT }
  )
  
  return result.count
}

// Export data from source database
async function exportData(db, table, where) {
  let whereClause = ''
  let replacements = {}
  
  if (where) {
    const conditions = Object.entries(where).map(([key, value]) => {
      if (Array.isArray(value)) {
        if (value.length === 0) return '1=0' // No records if empty array
        replacements[key] = value
        return `${key} IN (:${key})`
      } else {
        replacements[key] = value
        return `${key} = :${key}`
      }
    })
    whereClause = `WHERE ${conditions.join(' AND ')}`
  }
  
  const data = await db.query(
    `SELECT * FROM ${table} ${whereClause}`,
    { replacements, type: Sequelize.QueryTypes.SELECT }
  )
  
  return data
}

// Safely serialize a DB row for parameterized queries (stringify JSON-like objects)
function looksLikeJsonText(str) {
  if (typeof str !== 'string') return false
  const s = str.trim()
  if (s === '') return false
  const first = s[0]
  return first === '{' || first === '[' || first === '"'
}

function serializeRowForDb(row, jsonColumns = new Set()) {
  const serialized = {}
  for (const [key, value] of Object.entries(row)) {
    if (jsonColumns.has(key)) {
      if (value === null || value === undefined) {
        serialized[key] = null
      } else if (typeof value === 'string') {
        const v = value.trim()
        // Allow primitive JSON literals passed as strings without double-quoting
        if (v === 'null') {
          serialized[key] = null
        } else if (v === 'true' || v === 'false') {
          serialized[key] = v
        } else if (looksLikeJsonText(v)) {
          serialized[key] = v
        } else {
          serialized[key] = JSON.stringify(v)
        }
      } else if (value instanceof Date) {
        serialized[key] = JSON.stringify(value.toISOString())
      } else if (Buffer.isBuffer(value)) {
        serialized[key] = JSON.stringify(value.toString('base64'))
      } else {
        try {
          serialized[key] = JSON.stringify(value)
        } catch (_) {
          serialized[key] = JSON.stringify(String(value))
        }
      }
    } else if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      serialized[key] = value
    } else if (value instanceof Date) {
      // Store dates as ISO strings; adjust if schema expects integer timestamps
      serialized[key] = value.toISOString()
    } else if (Buffer.isBuffer(value)) {
      // Store buffers as-is (if any BLOB columns exist)
      serialized[key] = value
    } else {
      // For plain objects/arrays (e.g., JSON columns), store as JSON string
      try {
        serialized[key] = JSON.stringify(value)
      } catch (_) {
        // Fallback to String if serialization fails
        serialized[key] = String(value)
      }
    }
  }
  return serialized
}

// Import data to target database
async function importData(db, table, data, primaryKey, transaction) {
  if (data.length === 0) return { inserted: 0, updated: 0 }
  
  let inserted = 0
  let updated = 0
  
  const jsonColumns = await getJsonColumnsForTable(table)
  
  for (const row of data) {
    const serializedRow = serializeRowForDb(row, jsonColumns)
    // Check if record exists
    const exists = await db.query(
      `SELECT ${primaryKey} FROM ${table} WHERE ${primaryKey} = :id`,
      { 
        replacements: { id: row[primaryKey] }, 
        type: Sequelize.QueryTypes.SELECT,
        transaction 
      }
    )
    
    if (exists.length > 0) {
      // Update existing record (ensure JSON columns are CASTed)
      const setClause = Object.keys(serializedRow)
        .filter(key => key !== primaryKey)
        .map(key => jsonColumns.has(key) ? `${key} = CAST(:${key} AS JSON)` : `${key} = :${key}`)
        .join(', ')
      
      if (setClause) {
        try {
          await db.query(
            `UPDATE ${table} SET ${setClause} WHERE ${primaryKey} = :${primaryKey}`,
            { replacements: serializedRow, type: Sequelize.QueryTypes.UPDATE, transaction }
          )
        } catch (error) {
          const msg = error?.parent?.sqlMessage || error?.message || 'unknown error'
          const sample = JSON.stringify({ table, primaryKey: row[primaryKey], keys: Object.keys(serializedRow) }).slice(0, 1000)
          log(`Row UPDATE failed: ${msg} | context=${sample}`, 'error')
          throw error
        }
        updated++
      }
    } else {
      // Insert new record (ensure JSON columns are CASTed)
      const columns = Object.keys(serializedRow).join(', ')
      const values = Object.keys(serializedRow)
        .map(key => jsonColumns.has(key) ? `CAST(:${key} AS JSON)` : `:${key}`)
        .join(', ')
      
      try {
        await db.query(
          `INSERT INTO ${table} (${columns}) VALUES (${values})`,
          { replacements: serializedRow, type: Sequelize.QueryTypes.INSERT, transaction }
        )
      } catch (error) {
        const msg = error?.parent?.sqlMessage || error?.message || 'unknown error'
        const sample = JSON.stringify({ table, primaryKey: row[primaryKey], keys: Object.keys(serializedRow) }).slice(0, 1000)
        log(`Row INSERT failed: ${msg} | context=${sample}`, 'error')
        throw error
      }
      inserted++
    }
  }
  
  return { inserted, updated }
}

// ---- FK assurance helpers to guarantee parents exist before inserting children ----
async function selectExistingIds(db, table, pk, ids) {
  if (!ids.length) return new Set()
  const chunks = []
  const BATCH = 1000
  for (let i = 0; i < ids.length; i += BATCH) chunks.push(ids.slice(i, i + BATCH))
  const found = new Set()
  for (const chunk of chunks) {
    const rows = await db.query(
      `SELECT ${pk} AS id FROM ${table} WHERE ${pk} IN (:ids)`,
      { replacements: { ids: chunk }, type: Sequelize.QueryTypes.SELECT }
    )
    rows.forEach(r => found.add(r.id))
  }
  return found
}

async function fetchRowsByIds(db, table, pk, ids) {
  if (!ids.length) return []
  const chunks = []
  const BATCH = 1000
  const rows = []
  for (let i = 0; i < ids.length; i += BATCH) chunks.push(ids.slice(i, i + BATCH))
  for (const chunk of chunks) {
    const part = await db.query(
      `SELECT * FROM ${table} WHERE ${pk} IN (:ids)`,
      { replacements: { ids: chunk }, type: Sequelize.QueryTypes.SELECT }
    )
    rows.push(...part)
  }
  return rows
}

async function ensureParentsForCellNotes(projectId, sourceDb, targetDb, transaction) {
  // Collect referenced parents from source
  const refs = await sourceDb.query(
    `SELECT DISTINCT cn.matrix_id, cn.character_id, cn.taxon_id
     FROM cell_notes cn
     JOIN matrices m ON m.matrix_id = cn.matrix_id
     WHERE m.project_id = :projectId`,
    { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
  )
  const needMatrixIds = Array.from(new Set(refs.map(r => r.matrix_id)))
  const needCharIds = Array.from(new Set(refs.map(r => r.character_id)))
  const needTaxonIds = Array.from(new Set(refs.map(r => r.taxon_id)))

  // Check which exist in target
  const haveMatrices = await selectExistingIds(targetDb, 'matrices', 'matrix_id', needMatrixIds)
  const haveChars = await selectExistingIds(targetDb, 'characters', 'character_id', needCharIds)
  const haveTaxa = await selectExistingIds(targetDb, 'taxa', 'taxon_id', needTaxonIds)

  const missingMatrices = needMatrixIds.filter(id => !haveMatrices.has(id))
  const missingChars = needCharIds.filter(id => !haveChars.has(id))
  const missingTaxa = needTaxonIds.filter(id => !haveTaxa.has(id))

  if (missingMatrices.length) {
    log(`Ensuring missing matrices: ${missingMatrices.length}`, 'info')
    const rows = await fetchRowsByIds(sourceDb, 'matrices', 'matrix_id', missingMatrices)
    await importData(targetDb, 'matrices', rows, 'matrix_id', transaction)
  }
  if (missingChars.length) {
    log(`Ensuring missing characters: ${missingChars.length}`, 'info')
    const rows = await fetchRowsByIds(sourceDb, 'characters', 'character_id', missingChars)
    await importData(targetDb, 'characters', rows, 'character_id', transaction)
  }
  if (missingTaxa.length) {
    log(`Ensuring missing taxa: ${missingTaxa.length}`, 'info')
    const rows = await fetchRowsByIds(sourceDb, 'taxa', 'taxon_id', missingTaxa)
    await importData(targetDb, 'taxa', rows, 'taxon_id', transaction)
  }
}

async function ensureParentsForCellsXTables(tableName, projectId, sourceDb, targetDb, transaction) {
  // Determine columns needed (qualify with cx. to avoid ambiguity)
  const selectCols = tableName === 'cells_x_media'
    ? 'cx.matrix_id, cx.character_id, cx.taxon_id, cx.media_id'
    : 'cx.matrix_id, cx.character_id, cx.taxon_id'
  const refs = await sourceDb.query(
    `SELECT DISTINCT ${selectCols}
     FROM ${tableName} cx
     JOIN matrices m ON m.matrix_id = cx.matrix_id
     WHERE m.project_id = :projectId`,
    { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
  )
  const needMatrixIds = Array.from(new Set(refs.map(r => r.matrix_id)))
  const needCharIds = Array.from(new Set(refs.map(r => r.character_id)))
  const needTaxonIds = Array.from(new Set(refs.map(r => r.taxon_id)))
  const needMediaIds = tableName === 'cells_x_media' ? Array.from(new Set(refs.map(r => r.media_id))) : []

  const haveMatrices = await selectExistingIds(targetDb, 'matrices', 'matrix_id', needMatrixIds)
  const haveChars = await selectExistingIds(targetDb, 'characters', 'character_id', needCharIds)
  const haveTaxa = await selectExistingIds(targetDb, 'taxa', 'taxon_id', needTaxonIds)
  const haveMedia = tableName === 'cells_x_media' ? await selectExistingIds(targetDb, 'media_files', 'media_id', needMediaIds) : new Set()

  const missingMatrices = needMatrixIds.filter(id => !haveMatrices.has(id))
  const missingChars = needCharIds.filter(id => !haveChars.has(id))
  const missingTaxa = needTaxonIds.filter(id => !haveTaxa.has(id))
  const missingMedia = needMediaIds.filter(id => !haveMedia.has(id))

  if (missingMatrices.length) {
    log(`Ensuring missing matrices: ${missingMatrices.length}`, 'info')
    const rows = await fetchRowsByIds(sourceDb, 'matrices', 'matrix_id', missingMatrices)
    await importData(targetDb, 'matrices', rows, 'matrix_id', transaction)
  }
  if (missingChars.length) {
    log(`Ensuring missing characters: ${missingChars.length}`, 'info')
    const rows = await fetchRowsByIds(sourceDb, 'characters', 'character_id', missingChars)
    await importData(targetDb, 'characters', rows, 'character_id', transaction)
  }
  if (missingTaxa.length) {
    log(`Ensuring missing taxa: ${missingTaxa.length}`, 'info')
    const rows = await fetchRowsByIds(sourceDb, 'taxa', 'taxon_id', missingTaxa)
    await importData(targetDb, 'taxa', rows, 'taxon_id', transaction)
  }
  if (missingMedia.length) {
    log(`Ensuring missing media_files: ${missingMedia.length}`, 'info')
    const rows = await fetchRowsByIds(sourceDb, 'media_files', 'media_id', missingMedia)

    // media_files has FKs to project_id, specimen_id (nullable), view_id (nullable)
    // Ensure referenced media_views and specimens exist first
    const viewIds = Array.from(new Set(rows.map(r => r.view_id).filter(v => v)))
    const specimenIds = Array.from(new Set(rows.map(r => r.specimen_id).filter(v => v)))

    if (viewIds.length) {
      const haveViews = await selectExistingIds(targetDb, 'media_views', 'view_id', viewIds)
      const missingViews = viewIds.filter(id => !haveViews.has(id))
      if (missingViews.length) {
        log(`Ensuring missing media_views: ${missingViews.length}`, 'info')
        const viewRows = await fetchRowsByIds(sourceDb, 'media_views', 'view_id', missingViews)
        await importData(targetDb, 'media_views', viewRows, 'view_id', transaction)
      }
    }

    if (specimenIds.length) {
      const haveSpecimens = await selectExistingIds(targetDb, 'specimens', 'specimen_id', specimenIds)
      const missingSpecimens = specimenIds.filter(id => !haveSpecimens.has(id))
      if (missingSpecimens.length) {
        log(`Ensuring missing specimens: ${missingSpecimens.length}`, 'info')
        const specRows = await fetchRowsByIds(sourceDb, 'specimens', 'specimen_id', missingSpecimens)
        await importData(targetDb, 'specimens', specRows, 'specimen_id', transaction)
      }
    }

    // Now import the media_files rows
    await importData(targetDb, 'media_files', rows, 'media_id', transaction)
  }
}

async function ensureParentsForMediaFiles(projectId, sourceDb, targetDb, transaction) {
  // Gather referenced parents from source media_files for this project
  const refs = await sourceDb.query(
    `SELECT DISTINCT view_id, specimen_id
     FROM media_files
     WHERE project_id = :projectId`,
    { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
  )
  const viewIds = Array.from(new Set(refs.map(r => r.view_id).filter(v => v)))
  const specimenIds = Array.from(new Set(refs.map(r => r.specimen_id).filter(v => v)))

  if (viewIds.length) {
    const haveViews = await selectExistingIds(targetDb, 'media_views', 'view_id', viewIds)
    const missingViews = viewIds.filter(id => !haveViews.has(id))
    if (missingViews.length) {
      log(`Ensuring missing media_views for media_files: ${missingViews.length}`, 'info')
      const viewRows = await fetchRowsByIds(sourceDb, 'media_views', 'view_id', missingViews)
      await importData(targetDb, 'media_views', viewRows, 'view_id', transaction)
    }
  }

  if (specimenIds.length) {
    const haveSpecimens = await selectExistingIds(targetDb, 'specimens', 'specimen_id', specimenIds)
    const missingSpecimens = specimenIds.filter(id => !haveSpecimens.has(id))
    if (missingSpecimens.length) {
      log(`Ensuring missing specimens for media_files: ${missingSpecimens.length}`, 'info')
      const specRows = await fetchRowsByIds(sourceDb, 'specimens', 'specimen_id', missingSpecimens)
      await importData(targetDb, 'specimens', specRows, 'specimen_id', transaction)
    }
  }
}

// Cache JSON columns per table to avoid repeated information_schema lookups
const jsonColumnsCache = new Map()

async function getJsonColumnsForTable(table) {
  if (jsonColumnsCache.has(table)) return jsonColumnsCache.get(table)
  try {
    const rows = await targetDb.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = :schema AND TABLE_NAME = :table AND DATA_TYPE = 'json'`,
      {
        replacements: { schema: targetConfig.database, table },
        type: Sequelize.QueryTypes.SELECT,
      }
    )
    const set = new Set(rows.map((r) => r.COLUMN_NAME))
    jsonColumnsCache.set(table, set)
    return set
  } catch (e) {
    const empty = new Set()
    jsonColumnsCache.set(table, empty)
    return empty
  }
}

// Function to migrate journal cover to S3
async function migrateJournalCoverToS3(project, s3Client, bucket) {
  if (!project.journal_cover || !s3Client) return false
  
  try {
    const journalCover = project.journal_cover
    
    // Check if already migrated to new format
    if (journalCover.migrated) {
      log(`Journal cover already migrated for project ${project.project_id}`, 'debug')
      return false
    }
    
    // Handle legacy format with MAGIC, HASH, FILENAME
    if (journalCover.MAGIC && journalCover.HASH && journalCover.FILENAME) {
      const legacyUrl = `https://morphobank.org/media/morphobank3/images/${journalCover.HASH}/${journalCover.MAGIC}_${journalCover.FILENAME}`
      
      // Download image from legacy URL
      const buffer = await httpGetBuffer(legacyUrl)
      
      // Process with sharp for optimization
      const optimizedBuffer = await sharp(buffer)
        .jpeg({ quality: 90, progressive: true })
        .toBuffer()
      
      // Generate new S3 key
      const standardizedFilename = `projects_journal_cover_${project.project_id}.jpg`
      const s3Key = `media_files/journal_covers/uploads/${standardizedFilename}`
      
      // Upload to S3
      await s3Client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: optimizedBuffer,
        ContentType: 'image/jpeg',
      }))
      
      // Update project journal_cover to new format
      const newJournalCover = {
        filename: standardizedFilename,
        ORIGINAL_FILENAME: journalCover.FILENAME,
        migrated: true,
        migrated_at: new Date().toISOString(),
        s3_key: s3Key,
      }
      
      await targetDb.query(
        'UPDATE projects SET journal_cover = :journal_cover WHERE project_id = :project_id',
        {
          replacements: {
            journal_cover: JSON.stringify(newJournalCover),
            project_id: project.project_id,
          },
          type: Sequelize.QueryTypes.UPDATE,
        }
      )
      
      log(`Migrated journal cover to S3 for project ${project.project_id}`, 'info')
      return true
    }
    
    // Handle other legacy formats or direct URLs
    if (typeof journalCover === 'string' && journalCover.startsWith('http')) {
      // Download and process similar to above
      // ... (similar implementation)
    }
    
  } catch (error) {
    log(`Failed to migrate journal cover for project ${project.project_id}: ${error.message}`, 'error')
  }
  
  return false
}

// Function to migrate media files to S3
async function migrateMediaFilesToS3(projectId, s3Client, bucket, db) {
  if (!s3Client) return { migrated: 0, failed: 0 }
  
  const stats = { migrated: 0, failed: 0 }
  
  try {
    // Get all media files for the project
    const mediaFiles = await db.query(
      'SELECT * FROM media_files WHERE project_id = :projectId',
      { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
    )
    
    for (const mediaFile of mediaFiles) {
      try {
        if (!mediaFile.media) continue
        
        const media = typeof mediaFile.media === 'string' 
          ? JSON.parse(mediaFile.media) 
          : mediaFile.media
        
        // Check if already has S3 keys
        const hasS3Keys = media.original?.S3_KEY || media.large?.S3_KEY || media.thumbnail?.S3_KEY
        if (hasS3Keys) {
          log(`Media ${mediaFile.media_id} already has S3 keys`, 'debug')
          continue
        }
        
        let updated = false
        const updatedMedia = { ...media }
        
        // Process each size variant
        for (const size of ['original', 'large', 'thumbnail']) {
          const variant = media[size]
          if (!variant) continue
          
          // Handle legacy format
          if (variant.MAGIC && variant.HASH && variant.FILENAME) {
            const legacyUrl = `https://morphobank.org/media/morphobank3/images/${variant.HASH}/${variant.MAGIC}_${variant.FILENAME}`
            
            try {
              // Download image with robust headers
              let buffer = await httpGetBuffer(legacyUrl)
              
              // Process based on size
              if (size === 'large') {
                buffer = await sharp(buffer)
                  .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
                  .jpeg({ quality: 85 })
                  .toBuffer()
              } else if (size === 'thumbnail') {
                buffer = await sharp(buffer)
                  .resize(120, 120, { fit: 'inside', withoutEnlargement: true })
                  .jpeg({ quality: 85 })
                  .toBuffer()
              }
              
              // Generate S3 key
              const extension = size === 'original' ? path.extname(variant.FILENAME).toLowerCase() : '.jpg'
              const s3Key = `media_files/images/${projectId}/${mediaFile.media_id}/${projectId}_${mediaFile.media_id}_${size}${extension}`
              
              // Upload to S3
              const putResult = await s3Client.send(new PutObjectCommand({
                Bucket: bucket,
                Key: s3Key,
                Body: buffer,
                ContentType: extension === '.png' ? 'image/png' : 'image/jpeg',
              }))
              
              // Update media object
              updatedMedia[size] = {
                S3_KEY: s3Key,
                S3_ETAG: putResult.ETag?.replace(/"/g, ''),
                FILESIZE: buffer.length,
              }
              updated = true
              
            } catch (downloadError) {
              log(`Failed to download/process ${size} for media ${mediaFile.media_id}: ${downloadError.message}`, 'debug')
            }
          }
        }
        
        // Update database if any changes were made
        if (updated) {
          await db.query(
            'UPDATE media_files SET media = :media WHERE media_id = :media_id',
            {
              replacements: {
                media: JSON.stringify(updatedMedia),
                media_id: mediaFile.media_id,
              },
              type: Sequelize.QueryTypes.UPDATE,
            }
          )
          stats.migrated++
          log(`Migrated media file ${mediaFile.media_id} to S3`, 'debug')
        }
        
      } catch (error) {
        stats.failed++
        log(`Failed to migrate media file ${mediaFile.media_id}: ${error.message}`, 'debug')
      }
    }
    
  } catch (error) {
    log(`Error querying media files: ${error.message}`, 'error')
  }
  
  return stats
}


// Main migration function
async function migrateProject() {
  const startTime = Date.now()
  
  try {
    // Test database connections
    log('Testing database connections...')
    await sourceDb.authenticate()
    log('Source database connected successfully', 'debug')
    await targetDb.authenticate()
    log('Target database connected successfully', 'debug')
    
    // Validate project exists
    log(`Validating project ${projectId}...`)
    const project = await validateProject(sourceDb, projectId)
    log(`Found project: ${project.name} (ID: ${project.project_id})`)
    
    // Collect statistics
    log('Analyzing data to migrate...')
    const stats = {}
    let totalRecords = 0
    
    for (const tableInfo of MIGRATION_TABLES) {
      const where = tableInfo.whereFunc 
        ? await tableInfo.whereFunc(sourceDb)
        : tableInfo.where
      
      const count = await countRecords(sourceDb, tableInfo.table, where)
      stats[tableInfo.table] = count
      totalRecords += count
      
      if (count > 0) {
        log(`  ${tableInfo.table}: ${count} records`, 'debug')
      }
    }
    
    log(`Total records to migrate: ${totalRecords}`)
    
    if (isDryRun) {
      log('DRY RUN mode - no changes will be made', 'warn')
      log('\nMigration summary:')
      Object.entries(stats)
        .filter(([_, count]) => count > 0)
        .forEach(([table, count]) => {
          log(`  ${table}: ${count} records`)
        })
      return
    }
    
    // Start transaction on target database
    const transaction = await targetDb.transaction()
    
    try {
      // Ensure parents for child tables to guarantee FK integrity
      await ensureParentsForCellNotes(projectId, sourceDb, targetDb, transaction)
      await ensureParentsForCellsXTables('cells_x_bibliographic_references', projectId, sourceDb, targetDb, transaction)
      await ensureParentsForCellsXTables('cells_x_media', projectId, sourceDb, targetDb, transaction)

      // Guarantee parents for media_files parents as well (views/specimens)
      await ensureParentsForMediaFiles(projectId, sourceDb, targetDb, transaction)

      // Migrate each table
      log('Starting data migration...')
      const migrationStats = {}
      
      for (const tableInfo of MIGRATION_TABLES) {
        const where = tableInfo.whereFunc 
          ? await tableInfo.whereFunc(sourceDb)
          : tableInfo.where
        
        // Skip if no data to migrate
        if (stats[tableInfo.table] === 0) continue
        
        log(`Migrating ${tableInfo.table}...`, 'debug')
        
        // Export data from source
        const data = await exportData(sourceDb, tableInfo.table, where)
        
        let result
        // For tables with known unique keys, clean conflicting rows on unique key before insert
        if (UNIQUE_KEY_MAP[tableInfo.table]) {
          const uniqueCols = UNIQUE_KEY_MAP[tableInfo.table]
          let inserted = 0
          let updated = 0
          for (const row of data) {
            // Always remove any conflicting row on unique key (regardless of PK existence)
            const whereUnique = uniqueCols.map(c => `${c} = :${c}`).join(' AND ')
            const repl = {}
            uniqueCols.forEach(c => { repl[c] = row[c] })
            repl.pk = row[tableInfo.key]
            await targetDb.query(
              `DELETE FROM ${tableInfo.table} WHERE ${whereUnique} AND ${tableInfo.key} <> :pk`,
              { replacements: repl, type: Sequelize.QueryTypes.DELETE, transaction }
            )
          }
          // Now perform regular import (will insert or update by PK)
          result = await importData(targetDb, tableInfo.table, data, tableInfo.key, transaction)
        } else {
          // Import data to target
          result = await importData(
            targetDb, 
            tableInfo.table, 
            data, 
            tableInfo.key,
            transaction
          )
        }
        
        migrationStats[tableInfo.table] = result
        
        if (result.inserted > 0 || result.updated > 0) {
          log(`  ${tableInfo.table}: ${result.inserted} inserted, ${result.updated} updated`)
        }
      }
      
      // Commit transaction
      log('Committing transaction...')
      await transaction.commit()
      log('Migration completed successfully!')
      
      // Print summary
      const endTime = Date.now()
      const duration = (endTime - startTime) / 1000
      
      log('\nMigration Summary:')
      log(`  Project: ${project.name} (ID: ${project.project_id})`)
      log(`  Duration: ${duration.toFixed(2)} seconds`)
      log(`  Total records processed: ${totalRecords}`)
      
      let totalInserted = 0
      let totalUpdated = 0
      
      Object.entries(migrationStats).forEach(([table, stats]) => {
        if (stats.inserted > 0 || stats.updated > 0) {
          log(`  ${table}: ${stats.inserted} inserted, ${stats.updated} updated`)
          totalInserted += stats.inserted
          totalUpdated += stats.updated
        }
      })
      
      log(`  Total: ${totalInserted} records inserted, ${totalUpdated} records updated`)
      
      // Step 2: Migrate journal covers and media files to S3 (if not skipped)
      if (!skipS3Migration && s3Client && targetConfig.aws.defaultBucket) {
        log('\nStarting S3 migration...', 'info')
        
        // Migrate journal cover
        const [targetProject] = await targetDb.query(
          'SELECT project_id, journal_cover FROM projects WHERE project_id = :projectId',
          { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
        )
        
        if (targetProject && targetProject.journal_cover) {
          const journalCoverMigrated = await migrateJournalCoverToS3(
            targetProject,
            s3Client,
            targetConfig.aws.defaultBucket
          )
          if (journalCoverMigrated) {
            log('  Journal cover: migrated to S3')
          }
        }
        
        // Migrate media files
        log('Migrating media files to S3...', 'info')
        const mediaStats = await migrateMediaFilesToS3(
          projectId,
          s3Client,
          targetConfig.aws.defaultBucket,
          targetDb
        )
        log(`  Media files: ${mediaStats.migrated} migrated, ${mediaStats.failed} failed`)
      } else if (skipS3Migration) {
        log('\nS3 migration skipped (--skip-s3 flag)', 'info')
      } else if (!s3Client) {
        log('\nS3 migration skipped (no AWS credentials in target config)', 'warn')
      }
      
    } catch (error) {
      // Rollback transaction on error
      log('Error during migration, rolling back...', 'error')
      await transaction.rollback()
      throw error
    }
    
  } catch (error) {
    log(`Migration failed: ${error.message}`, 'error')
    if (isVerbose) {
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    // Close database connections
    await sourceDb.close()
    await targetDb.close()
  }
}

// Run migration
log(`Starting project migration for project ID: ${projectId}`)
log(`Source: ${args['source-env']}`)
log(`Target: ${args['target-env']}`)
log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`)
log('----------------------------------------')

migrateProject()
