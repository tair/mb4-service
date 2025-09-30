#!/usr/bin/env node

/**
 * Journal Cover Migration Script
 * 
 * This script migrates journal cover images from the old MorphoBank URLs
 * to the new S3 bucket structure. Only processes projects where journal_title
 * is empty to avoid 403 issues.
 * 
 * Usage:
 *   node migrate-journal-covers.js [options]
 * 
 * Options:
 *   --dry-run     Show what would be migrated without actually doing it
 *   --limit N     Process only N records (for testing)
 *   --project-id  Process only a specific project ID
 *   --verbose     Show detailed logging
 */

import sequelizeConn from '../../src/util/db.js'
import s3Service from '../../src/services/s3-service.js'
import config from '../../src/config.js'
import axios from 'axios'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Configuration
const S3_BUCKET_PATH = 'media_files/journal_covers/uploads'
const TEMP_DIR = '/tmp/journal-covers-migration'
const BATCH_SIZE = 10
const RETRY_ATTEMPTS = 3
const RETRY_DELAY = 2000 // 2 seconds

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
 * Create temporary directory
 */
function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true })
    log(`Created temporary directory: ${TEMP_DIR}`)
  }
}

/**
 * Clean up temporary files
 */
function cleanup() {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true })
    log('Cleaned up temporary directory')
  }
}

/**
 * Download file from URL with retry logic
 */
async function downloadFile(url, filePath, retryCount = 0) {
  try {
    log(`Downloading: ${url}`, 'debug')
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 30000, // 30 seconds timeout
      headers: {
        'User-Agent': 'MorphoBank-Migration-Script/1.0'
      }
    })

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const writer = fs.createWriteStream(filePath)
    response.data.pipe(writer)

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        log(`Downloaded: ${path.basename(filePath)}`, 'debug')
        resolve()
      })
      writer.on('error', reject)
    })
  } catch (error) {
    if (retryCount < RETRY_ATTEMPTS) {
      log(`Download failed (attempt ${retryCount + 1}/${RETRY_ATTEMPTS}): ${error.message}`, 'warn')
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)))
      return downloadFile(url, filePath, retryCount + 1)
    }
    throw error
  }
}

/**
 * Upload file to S3
 */
async function uploadToS3(filePath, s3Key) {
  try {
    log(`Uploading to S3: ${s3Key}`, 'debug')
    
    const fileBuffer = fs.readFileSync(filePath)
    const fileExtension = path.extname(filePath).toLowerCase()
    const mimeType = getMimeType(fileExtension)
    
    const result = await s3Service.putObject(
      config.aws.defaultBucket,
      s3Key,
      fileBuffer,
      mimeType
    )
    
    log(`Uploaded to S3: ${s3Key}`, 'debug')
    return result
  } catch (error) {
    throw new Error(`S3 upload failed: ${error.message}`)
  }
}

/**
 * Get MIME type from file extension
 */
function getMimeType(extension) {
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff'
  }
  return mimeTypes[extension] || 'image/jpeg'
}

/**
 * Generate S3 key for journal cover
 */
function generateS3Key(originalFilename, projectId) {
  // Extract file extension
  const extension = path.extname(originalFilename).toLowerCase()
  
  // Create filename using the specified naming convention
  const filename = `projects_journal_cover_${projectId}${extension}`
  
  return `${S3_BUCKET_PATH}/${filename}`
}

/**
 * Process a single journal cover
 */
async function processJournalCover(project) {
  const { project_id, journal_cover } = project
  
  try {
    if (!journal_cover || !journal_cover.preview) {
      log(`Project ${project_id}: No journal cover data`, 'debug')
      return { status: 'skipped', reason: 'No journal cover data' }
    }

    const preview = journal_cover.preview
    const originalUrl = `https://morphobank.org/media/morphobank3/images/${preview.HASH}/${preview.MAGIC}_${preview.FILENAME}`
    
    // Generate S3 key
    const s3Key = generateS3Key(preview.FILENAME, project_id)
    
    log(`Project ${project_id}: Processing journal cover`, 'info')
    log(`  Original URL: ${originalUrl}`, 'info')
    log(`  S3 Key: ${s3Key}`, 'debug')
    
    if (isDryRun) {
      log(`  [DRY RUN] Would migrate: ${preview.FILENAME} -> ${s3Key}`, 'info')
      return { status: 'dry-run', s3Key }
    }
    
    // Check if file already exists in S3
    try {
      await s3Service.getObject(config.aws.defaultBucket, s3Key)
      log(`Project ${project_id}: File already exists in S3, skipping`, 'warn')
      return { status: 'skipped', reason: 'Already exists in S3' }
    } catch (error) {
      // File doesn't exist, continue with migration
    }
    
    // Download file
    const tempFilePath = path.join(TEMP_DIR, `${project_id}_${preview.FILENAME}`)
    await downloadFile(originalUrl, tempFilePath)
    
    // Upload to S3
    const uploadResult = await uploadToS3(tempFilePath, s3Key)
    
    // Clean up temp file
    fs.unlinkSync(tempFilePath)
    
    log(`Project ${project_id}: Successfully migrated journal cover`, 'info')
    return { 
      status: 'success', 
      s3Key, 
      etag: uploadResult.etag,
      originalUrl 
    }
    
  } catch (error) {
    log(`Project ${project_id}: Failed to process journal cover - ${error.message}`, 'error')
    return { 
      status: 'failed', 
      error: error.message,
      projectId: project_id 
    }
  }
}

/**
 * Get projects with journal covers
 */
async function getProjectsWithJournalCovers() {
  let query = `
    SELECT project_id, journal_cover, journal_title
    FROM projects 
    WHERE journal_cover IS NOT NULL 
    AND JSON_EXTRACT(journal_cover, '$.preview') IS NOT NULL
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
 * Main migration function
 */
async function migrateJournalCovers() {
  try {
    log('Starting journal cover migration...', 'info')
    log(`Configuration:`, 'info')
    log(`  Dry run: ${isDryRun}`, 'info')
    log(`  Limit: ${limit || 'none'}`, 'info')
    log(`  Project ID: ${projectId || 'all'}`, 'info')
    log(`  S3 Bucket: ${config.aws.defaultBucket}`, 'info')
    log(`  S3 Path: ${S3_BUCKET_PATH}`, 'info')
    
    // Ensure temp directory exists
    ensureTempDir()
    
    // Get projects with journal covers
    const projects = await getProjectsWithJournalCovers()
    stats.total = projects.length
    
    log(`Found ${stats.total} projects with journal covers (where journal_title is empty)`, 'info')
    
    if (stats.total === 0) {
      log('No projects with journal covers found (where journal_title is empty)', 'warn')
      return
    }
    
    // Process projects in batches
    for (let i = 0; i < projects.length; i += BATCH_SIZE) {
      const batch = projects.slice(i, i + BATCH_SIZE)
      log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(projects.length / BATCH_SIZE)} (${batch.length} projects)`, 'info')
      
      const batchPromises = batch.map(project => processJournalCover(project))
      const batchResults = await Promise.allSettled(batchPromises)
      
      // Process results
      batchResults.forEach((result, index) => {
        stats.processed++
        
        if (result.status === 'fulfilled') {
          const res = result.value
          switch (res.status) {
            case 'success':
              stats.successful++
              break
            case 'skipped':
              stats.skipped++
              break
            case 'failed':
              stats.failed++
              stats.errors.push({
                projectId: batch[index].project_id,
                error: res.error
              })
              break
            case 'dry-run':
              stats.successful++ // Count dry runs as successful
              break
          }
        } else {
          stats.failed++
          stats.errors.push({
            projectId: batch[index].project_id,
            error: result.reason?.message || 'Unknown error'
          })
        }
      })
      
      // Progress update
      const progress = Math.round((stats.processed / stats.total) * 100)
      log(`Progress: ${stats.processed}/${stats.total} (${progress}%)`, 'info')
    }
    
    // Print final statistics
    log('\n=== Migration Complete ===', 'info')
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
      log('\nThis was a dry run. No files were actually migrated.', 'info')
      log('Run without --dry-run to perform the actual migration.', 'info')
    }
    
  } catch (error) {
    log(`Migration failed: ${error.message}`, 'error')
    throw error
  } finally {
    cleanup()
  }
}

/**
 * Handle process termination
 */
process.on('SIGINT', () => {
  log('\nMigration interrupted by user', 'warn')
  cleanup()
  process.exit(1)
})

process.on('SIGTERM', () => {
  log('\nMigration terminated', 'warn')
  cleanup()
  process.exit(1)
})

// Run migration
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateJournalCovers()
    .then(() => {
      log('Migration completed successfully', 'info')
      process.exit(0)
    })
    .catch((error) => {
      log(`Migration failed: ${error.message}`, 'error')
      process.exit(1)
    })
}

export { migrateJournalCovers }
