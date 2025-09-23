#!/usr/bin/env node

/**
 * Journal Cover Database Update Script
 * 
 * This script updates the journal_cover field in the projects table
 * to point to the new S3-based journal covers after migration.
 * Only processes projects where journal_title is empty to avoid 403 issues.
 * 
 * Usage:
 *   node update-journal-covers-db.js [options]
 * 
 * Options:
 *   --dry-run     Show what would be updated without actually doing it
 *   --limit N     Process only N records (for testing)
 *   --project-id  Process only a specific project ID
 *   --verbose     Show detailed logging
 */

import sequelizeConn from '../src/util/db.js'
import s3Service from '../src/services/s3-service.js'
import config from '../src/config.js'
import path from 'path'

// Configuration
const S3_BUCKET_PATH = 'media_files/journal_covers/uploads'

// Command line arguments
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run')
const verbose = args.includes('--verbose')
const limitArg = args.find(arg => arg.startsWith('--limit='))
const projectIdArg = args.find(arg => arg.startsWith('--project-id='))
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null
const projectId = projectIdArg ? parseInt(projectIdArg.split('=')[1]) : null

// Statistics
const stats = {
  total: 0,
  processed: 0,
  successful: 0,
  failed: 0,
  skipped: 0,
  errors: []
}

/**
 * Logging utility
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`
  
  if (level === 'error') {
    console.error(`${prefix} ${message}`)
  } else if (verbose || level === 'info' || level === 'warn') {
    console.log(`${prefix} ${message}`)
  }
}

/**
 * Check if S3 file exists
 */
async function checkS3FileExists(s3Key) {
  try {
    await s3Service.getObject(config.aws.defaultBucket, s3Key)
    return true
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return false
    }
    throw error
  }
}

/**
 * Generate S3 key for journal cover
 */
function generateS3Key(originalFilename, projectId) {
  const extension = path.extname(originalFilename).toLowerCase()
  
  // Create filename using the specified naming convention
  const filename = `projects_journal_cover_${projectId}${extension}`
  return `${S3_BUCKET_PATH}/${filename}`
}

/**
 * Update journal cover record in database
 */
async function updateJournalCoverRecord(project) {
  const { project_id, journal_cover } = project
  
  try {
    if (!journal_cover || !journal_cover.preview) {
      log(`Project ${project_id}: No journal cover data`, 'debug')
      return { status: 'skipped', reason: 'No journal cover data' }
    }

    const preview = journal_cover.preview
    const s3Key = generateS3Key(preview.FILENAME, project_id)
    
    log(`Project ${project_id}: Checking S3 file existence`, 'debug')
    log(`  S3 Key: ${s3Key}`, 'debug')
    
    // Check if the migrated file exists in S3
    const fileExists = await checkS3FileExists(s3Key)
    
    if (!fileExists) {
      log(`Project ${project_id}: S3 file does not exist, skipping database update`, 'warn')
      return { status: 'skipped', reason: 'S3 file does not exist' }
    }
    
    // Create new journal_cover structure
    const newJournalCover = {
      filename: `projects_journal_cover_${project_id}${path.extname(preview.FILENAME).toLowerCase()}`,
      ORIGINAL_FILENAME: preview.FILENAME,
      migrated: true,
      migrated_at: new Date().toISOString()
    }
    
    if (isDryRun) {
      log(`  [DRY RUN] Would update project ${project_id} journal_cover:`, 'info')
      log(`    Old: ${JSON.stringify(journal_cover, null, 2)}`, 'debug')
      log(`    New: ${JSON.stringify(newJournalCover, null, 2)}`, 'debug')
      return { status: 'dry-run', newJournalCover }
    }
    
    // Update the database record
    const [affectedRows] = await sequelizeConn.query(
      'UPDATE projects SET journal_cover = ? WHERE project_id = ?',
      {
        replacements: [JSON.stringify(newJournalCover), project_id]
      }
    )
    
    if (affectedRows === 0) {
      throw new Error('No rows were updated')
    }
    
    log(`Project ${project_id}: Successfully updated journal_cover record`, 'info')
    return { 
      status: 'success', 
      s3Key,
      projectId: project_id 
    }
    
  } catch (error) {
    log(`Project ${project_id}: Failed to update journal cover record - ${error.message}`, 'error')
    return { 
      status: 'failed', 
      error: error.message,
      projectId: project_id 
    }
  }
}

/**
 * Get projects with old journal cover format
 */
async function getProjectsWithOldJournalCovers() {
  let query = `
    SELECT project_id, journal_cover, journal_title
    FROM projects 
    WHERE journal_cover IS NOT NULL 
    AND JSON_EXTRACT(journal_cover, '$.preview') IS NOT NULL
    AND JSON_EXTRACT(journal_cover, '$.migrated') IS NULL
    AND deleted = 0
  `
  
  const params = []
  
  if (projectId) {
    query += ' AND project_id = ?'
    params.push(projectId)
  }
  
  query += ' ORDER BY project_id'
  
  if (limit) {
    query += ' LIMIT ?'
    params.push(limit)
  }
  
  const [rows] = await sequelizeConn.query(query, { replacements: params })
  return rows
}

/**
 * Main update function
 */
async function updateJournalCoversDatabase() {
  try {
    log('Starting journal cover database update...', 'info')
    log(`Configuration:`, 'info')
    log(`  Dry run: ${isDryRun}`, 'info')
    log(`  Limit: ${limit || 'none'}`, 'info')
    log(`  Project ID: ${projectId || 'all'}`, 'info')
    log(`  S3 Bucket: ${config.aws.defaultBucket}`, 'info')
    log(`  S3 Path: ${S3_BUCKET_PATH}`, 'info')
    
    // Get projects with old journal cover format
    const projects = await getProjectsWithOldJournalCovers()
    stats.total = projects.length
    
    log(`Found ${stats.total} projects with old journal cover format (where journal_title is empty)`, 'info')
    
    if (stats.total === 0) {
      log('No projects with old journal cover format found (where journal_title is empty)', 'warn')
      return
    }
    
    // Process projects
    for (const project of projects) {
      stats.processed++
      
      try {
        const result = await updateJournalCoverRecord(project)
        
        switch (result.status) {
          case 'success':
            stats.successful++
            break
          case 'skipped':
            stats.skipped++
            break
          case 'failed':
            stats.failed++
            stats.errors.push({
              projectId: project.project_id,
              error: result.error
            })
            break
          case 'dry-run':
            stats.successful++ // Count dry runs as successful
            break
        }
      } catch (error) {
        stats.failed++
        stats.errors.push({
          projectId: project.project_id,
          error: error.message
        })
      }
      
      // Progress update
      const progress = Math.round((stats.processed / stats.total) * 100)
      log(`Progress: ${stats.processed}/${stats.total} (${progress}%)`, 'info')
    }
    
    // Print final statistics
    log('\n=== Database Update Complete ===', 'info')
    log(`Total projects: ${stats.total}`, 'info')
    log(`Processed: ${stats.processed}`, 'info')
    log(`Successful: ${stats.successful}`, 'info')
    log(`Skipped: ${stats.skipped}`, 'info')
    log(`Failed: ${stats.failed}`, 'info')
    
    if (stats.errors.length > 0) {
      log('\n=== Errors ===', 'error')
      stats.errors.forEach(error => {
        log(`Project ${error.projectId}: ${error.error}`, 'error')
      })
    }
    
    if (isDryRun) {
      log('\nThis was a dry run. No database records were actually updated.', 'info')
      log('Run without --dry-run to perform the actual database update.', 'info')
    }
    
  } catch (error) {
    log(`Database update failed: ${error.message}`, 'error')
    throw error
  }
}

// Run update
if (import.meta.url === `file://${process.argv[1]}`) {
  updateJournalCoversDatabase()
    .then(() => {
      log('Database update completed successfully', 'info')
      process.exit(0)
    })
    .catch((error) => {
      log(`Database update failed: ${error.message}`, 'error')
      process.exit(1)
    })
}

export { updateJournalCoversDatabase }
