#!/usr/bin/env node

/**
 * Journal Cover Validation Script
 * 
 * This script validates that journal cover migrations were successful
 * by checking both the database records and S3 file existence.
 * 
 * Usage:
 *   node validate-journal-covers.js [options]
 * 
 * Options:
 *   --limit N     Check only N records (for testing)
 *   --project-id  Check only a specific project ID
 *   --verbose     Show detailed logging
 */

import sequelizeConn from '../../src/util/db.js'
import s3Service from '../../src/services/s3-service.js'
import config from '../../src/config.js'

// Command line arguments
const args = process.argv.slice(2)
const verbose = args.includes('--verbose')
const limitArg = args.find(arg => arg.startsWith('--limit='))
const projectIdArg = args.find(arg => arg.startsWith('--project-id='))
const limit = limitArg ? parseInt(limitArg.split('=')[1]) : null
const projectId = projectIdArg ? parseInt(projectIdArg.split('=')[1]) : null

// Statistics
const stats = {
  total: 0,
  migrated: 0,
  s3Exists: 0,
  s3Missing: 0,
  dbErrors: 0,
  s3Errors: 0,
  issues: []
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
    const result = await s3Service.getObject(config.aws.defaultBucket, s3Key)
    return { exists: true, size: result.contentLength, contentType: result.contentType }
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return { exists: false }
    }
    throw error
  }
}

/**
 * Validate a single journal cover record
 */
async function validateJournalCover(project) {
  const { project_id, journal_cover, journal_title } = project
  
  try {
    if (!journal_cover) {
      log(`Project ${project_id}: No journal cover data`, 'debug')
      return { status: 'no-data' }
    }

    // Check if it's the new format
    if (journal_cover.filename && journal_cover.migrated) {
      stats.migrated++
      
      log(`Project ${project_id}: Checking migrated journal cover`, 'debug')
      log(`  Filename: ${journal_cover.filename}`, 'debug')
      log(`  Original Filename: ${journal_cover.ORIGINAL_FILENAME}`, 'debug')
      log(`  Migrated: ${journal_cover.migrated_at}`, 'debug')
      
      // Generate S3 key from filename
      const s3Key = `media_files/journal_covers/uploads/${journal_cover.filename}`
      
      // Check if S3 file exists
      const s3Check = await checkS3FileExists(s3Key)
      
      if (s3Check.exists) {
        stats.s3Exists++
        log(`Project ${project_id}: ✓ S3 file exists (${s3Check.size} bytes, ${s3Check.contentType})`, 'debug')
        return { 
          status: 'valid', 
          s3Key: s3Key,
          s3Size: s3Check.size,
          s3ContentType: s3Check.contentType
        }
      } else {
        stats.s3Missing++
        const issue = {
          projectId: project_id,
          type: 's3-missing',
          message: `S3 file does not exist: ${s3Key}`,
          s3Key: s3Key
        }
        stats.issues.push(issue)
        log(`Project ${project_id}: ✗ S3 file missing: ${s3Key}`, 'warn')
        return { status: 's3-missing', issue }
      }
    }
    
    // Check if it's the old format
    if (journal_cover.preview) {
      log(`Project ${project_id}: Still using old format`, 'debug')
      const issue = {
        projectId: project_id,
        type: 'not-migrated',
        message: 'Still using old journal cover format',
        oldFormat: journal_cover.preview
      }
      stats.issues.push(issue)
      return { status: 'not-migrated', issue }
    }
    
    // Unknown format
    log(`Project ${project_id}: Unknown journal cover format`, 'debug')
    const issue = {
      projectId: project_id,
      type: 'unknown-format',
      message: 'Unknown journal cover format',
      data: journal_cover
    }
    stats.issues.push(issue)
    return { status: 'unknown-format', issue }
    
  } catch (error) {
    stats.s3Errors++
    const issue = {
      projectId: project_id,
      type: 'error',
      message: error.message,
      error: error
    }
    stats.issues.push(issue)
    log(`Project ${project_id}: Error validating journal cover - ${error.message}`, 'error')
    return { status: 'error', issue }
  }
}

/**
 * Get all projects with journal covers
 */
async function getProjectsWithJournalCovers() {
  let query = `
    SELECT project_id, journal_cover, journal_title
    FROM projects 
    WHERE journal_cover IS NOT NULL 
    AND published = 1 
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
 * Main validation function
 */
async function validateJournalCovers() {
  try {
    log('Starting journal cover validation...', 'info')
    log(`Configuration:`, 'info')
    log(`  Limit: ${limit || 'none'}`, 'info')
    log(`  Project ID: ${projectId || 'all'}`, 'info')
    log(`  S3 Bucket: ${config.aws.defaultBucket}`, 'info')
    
    // Get projects with journal covers
    const projects = await getProjectsWithJournalCovers()
    stats.total = projects.length
    
    log(`Found ${stats.total} projects with journal covers`, 'info')
    
    if (stats.total === 0) {
      log('No projects with journal covers found', 'warn')
      return
    }
    
    // Validate each project
    for (const project of projects) {
      await validateJournalCover(project)
    }
    
    // Print final statistics
    log('\n=== Validation Complete ===', 'info')
    log(`Total projects: ${stats.total}`, 'info')
    log(`Migrated records: ${stats.migrated}`, 'info')
    log(`S3 files exist: ${stats.s3Exists}`, 'info')
    log(`S3 files missing: ${stats.s3Missing}`, 'info')
    log(`Database errors: ${stats.dbErrors}`, 'info')
    log(`S3 errors: ${stats.s3Errors}`, 'info')
    log(`Total issues: ${stats.issues.length}`, 'info')
    
    if (stats.issues.length > 0) {
      log('\n=== Issues Found ===', 'warn')
      
      // Group issues by type
      const issuesByType = {}
      stats.issues.forEach(issue => {
        if (!issuesByType[issue.type]) {
          issuesByType[issue.type] = []
        }
        issuesByType[issue.type].push(issue)
      })
      
      Object.entries(issuesByType).forEach(([type, issues]) => {
        log(`\n${type.toUpperCase()} (${issues.length} issues):`, 'warn')
        issues.forEach(issue => {
          log(`  Project ${issue.projectId}: ${issue.message}`, 'warn')
        })
      })
      
      // Summary
      log('\n=== Summary ===', 'info')
      if (stats.migrated === stats.total && stats.s3Exists === stats.migrated) {
        log('✓ All journal covers are properly migrated and accessible', 'info')
      } else {
        log('✗ Some journal covers have issues that need attention', 'warn')
      }
    } else {
      log('\n✓ All journal covers are properly migrated and accessible', 'info')
    }
    
  } catch (error) {
    log(`Validation failed: ${error.message}`, 'error')
    throw error
  }
}

// Run validation
if (import.meta.url === `file://${process.argv[1]}`) {
  validateJournalCovers()
    .then(() => {
      log('Validation completed successfully', 'info')
      process.exit(0)
    })
    .catch((error) => {
      log(`Validation failed: ${error.message}`, 'error')
      process.exit(1)
    })
}

export { validateJournalCovers }
