#!/usr/bin/env node

/**
 * Test Database Connections and AWS Configuration for Migration Script
 * 
 * This script tests the database connections and AWS S3 access specified in the 
 * environment files and validates that the required project exists in the source database.
 * 
 * Usage:
 *   node test-migration-connection.js --project-id=123 --source-env=.env.source --target-env=.env.target
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import Sequelize from 'sequelize'
import dotenv from 'dotenv'
import process from 'node:process'
import axios from 'axios'
import { S3Client, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

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
  console.error('Usage: node test-migration-connection.js --project-id=123 --source-env=.env.source --target-env=.env.target')
  process.exit(1)
}

const projectId = parseInt(args['project-id'], 10)

// Load environment configurations
function loadEnvConfig(envPath) {
  if (!fs.existsSync(envPath)) {
    throw new Error(`Environment file not found: ${envPath}`)
  }
  
  const envConfig = dotenv.parse(fs.readFileSync(path.resolve(envPath)))
  
  if (!envConfig.DB_HOST || !envConfig.DB_USER || !envConfig.DB_SCHEMA || !envConfig.DB_PASSWORD) {
    throw new Error(`Missing required database configuration in ${envPath}`)
  }
  
  return {
    host: envConfig.DB_HOST,
    user: envConfig.DB_USER,
    database: envConfig.DB_SCHEMA,
    password: envConfig.DB_PASSWORD,
    dialect: 'mysql',
    logging: false,
    aws: {
      region: envConfig.AWS_REGION,
      accessKeyId: envConfig.AWS_ACCESS_KEY_ID,
      secretAccessKey: envConfig.AWS_SECRET_ACCESS_KEY,
      defaultBucket: envConfig.AWS_S3_DEFAULT_BUCKET || 'mb4-data',
    },
  }
}

// Simple legacy downloader check (one media from project), mirrors migrate-journal-covers headers
async function testLegacyDownloadForProject(db, projectId) {
  try {
    const [row] = await db.query(
      `SELECT media FROM media_files WHERE project_id = :projectId AND media IS NOT NULL LIMIT 1`,
      { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
    )
    if (!row) {
      console.log('  Legacy download: No media to test')
      return { attempted: false }
    }
    let media = row.media
    if (typeof media === 'string') {
      try { media = JSON.parse(media) } catch {}
    }
    const variants = ['original','large','thumbnail','preview','tiny','media','small','INPUT']
    let url = null
    for (const v of variants) {
      const part = media?.[v]
      if (part?.HASH && part?.MAGIC && part?.FILENAME) {
        url = `https://morphobank.org/media/morphobank3/images/${part.HASH}/${part.MAGIC}_${part.FILENAME}`
        break
      }
    }
    if (!url) {
      console.log('  Legacy download: No legacy URL found in media JSON')
      return { attempted: false }
    }
    const res = await axios({ method: 'GET', url, responseType: 'arraybuffer', timeout: 15000, headers: { 'User-Agent': 'MorphoBank-Migration-Script/1.0' }, validateStatus: () => true })
    if (res.status >= 200 && res.status < 300) {
      console.log('  Legacy download: ✓ Fetched one legacy media successfully')
      return { attempted: true, success: true }
    }
    console.log(`  Legacy download: ✗ HTTP ${res.status}`)
    return { attempted: true, success: false, status: res.status }
  } catch (e) {
    console.log(`  Legacy download: ✗ ${e.message}`)
    return { attempted: true, success: false, error: e.message }
  }
}

async function testDatabaseConnection(name, config, isSource = false) {
  console.log(`\nTesting ${name} database connection...`)
  console.log(`  Host: ${config.host}`)
  console.log(`  Database: ${config.database}`)
  console.log(`  User: ${config.user}`)
  
  const db = new Sequelize(
    config.database,
    config.user,
    config.password,
    config
  )
  
  try {
    await db.authenticate()
    console.log(`✓ ${name} database connection successful`)
    
    // Test table access
    console.log(`\nTesting table access...`)
    const tables = [
      'projects',
      'taxa',
      'characters',
      'cells',
      'media_files',
      'bibliographic_references'
    ]
    
    for (const table of tables) {
      try {
        const [result] = await db.query(
          `SELECT COUNT(*) as count FROM ${table}`,
          { type: Sequelize.QueryTypes.SELECT }
        )
        console.log(`  ✓ ${table}: ${result.count} records`)
      } catch (error) {
        console.log(`  ✗ ${table}: ${error.message}`)
      }
    }
    
    // If source database, validate project
    if (isSource) {
      console.log(`\nValidating project ${projectId}...`)
      const [project] = await db.query(
        'SELECT project_id, name, deleted, user_id, journal_cover FROM projects WHERE project_id = :projectId',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      
      if (!project) {
        console.log(`✗ Project ${projectId} not found in source database`)
        return false
      }
      
      console.log(`✓ Found project: ${project.name} (ID: ${project.project_id})`)
      if (project.deleted === 1) {
        console.log(`  ⚠ Warning: Project is marked as deleted`)
      }
      
      // Check journal cover format
      if (project.journal_cover) {
        const journalCover = typeof project.journal_cover === 'string' 
          ? JSON.parse(project.journal_cover) 
          : project.journal_cover
        
        if (journalCover.migrated) {
          console.log(`  Journal cover: Already migrated to new format`)
        } else if (journalCover.MAGIC && journalCover.HASH && journalCover.FILENAME) {
          console.log(`  Journal cover: Legacy format (will be migrated)`)
        }
      }
      
      // Get project statistics
      console.log(`\nProject statistics:`)
      
      const stats = await Promise.all([
        db.query('SELECT COUNT(*) as count FROM taxa WHERE project_id = :projectId', 
          { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }),
        db.query('SELECT COUNT(*) as count FROM characters WHERE project_id = :projectId', 
          { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }),
        db.query('SELECT COUNT(*) as count FROM media_files WHERE project_id = :projectId', 
          { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }),
        db.query('SELECT COUNT(*) as count FROM specimens WHERE project_id = :projectId', 
          { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }),
        db.query('SELECT COUNT(*) as count FROM bibliographic_references WHERE project_id = :projectId', 
          { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }),
      ])
      
      console.log(`  Taxa: ${stats[0][0].count}`)
      console.log(`  Characters: ${stats[1][0].count}`)
      console.log(`  Media files: ${stats[2][0].count}`)
      console.log(`  Specimens: ${stats[3][0].count}`)
      console.log(`  References: ${stats[4][0].count}`)
      
      // Get cell count
      const [cellCount] = await db.query(
        'SELECT COUNT(*) as count FROM cells WHERE taxon_id IN (SELECT taxon_id FROM taxa WHERE project_id = :projectId)',
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      console.log(`  Matrix cells: ${cellCount.count}`)
      
      // Check for legacy media
      const [legacyMediaCount] = await db.query(
        `SELECT COUNT(*) as count FROM media_files 
         WHERE project_id = :projectId 
         AND (media NOT LIKE '%S3_KEY%' OR media IS NULL)`,
        { replacements: { projectId }, type: Sequelize.QueryTypes.SELECT }
      )
      if (legacyMediaCount.count > 0) {
        console.log(`  ⚠ Legacy media files: ${legacyMediaCount.count} (will be migrated to S3)`)
      }
    }
    
    await db.close()
    return true
  } catch (error) {
    console.log(`✗ ${name} database connection failed: ${error.message}`)
    await db.close()
    return false
  }
}

async function testAwsS3Connection(name, config) {
  console.log(`\nTesting ${name} AWS S3 configuration...`)
  
  if (!config.aws.accessKeyId || !config.aws.secretAccessKey) {
    console.log('  ⚠ No AWS credentials configured (S3 operations will be skipped)')
    return { configured: false, accessible: false }
  }
  
  console.log(`  Region: ${config.aws.region}`)
  console.log(`  Bucket: ${config.aws.defaultBucket}`)
  console.log(`  Access Key: ${config.aws.accessKeyId.substring(0, 4)}...`)
  
  const s3Client = new S3Client({
    region: config.aws.region,
    credentials: {
      accessKeyId: config.aws.accessKeyId,
      secretAccessKey: config.aws.secretAccessKey,
    },
  })
  
  try {
    // Test bucket access
    await s3Client.send(new HeadBucketCommand({
      Bucket: config.aws.defaultBucket
    }))
    console.log(`  ✓ S3 bucket accessible`)
    
    // List some objects to verify read access
    const listResult = await s3Client.send(new ListObjectsV2Command({
      Bucket: config.aws.defaultBucket,
      MaxKeys: 5,
      Prefix: 'media_files/'
    }))
    
    console.log(`  ✓ Can list objects (found ${listResult.KeyCount || 0} items in media_files/)`)
    
    return { configured: true, accessible: true }
  } catch (error) {
    console.log(`  ✗ S3 access failed: ${error.message}`)
    if (error.name === 'NoSuchBucket') {
      console.log(`  ✗ Bucket '${config.aws.defaultBucket}' does not exist`)
    } else if (error.name === 'AccessDenied') {
      console.log(`  ✗ Access denied - check IAM permissions`)
    }
    return { configured: true, accessible: false }
  }
}

async function main() {
  console.log('Migration Connection Test')
  console.log('========================')
  
  let sourceConfig, targetConfig
  
  try {
    sourceConfig = loadEnvConfig(args['source-env'])
  } catch (error) {
    console.error(`Error loading source config: ${error.message}`)
    process.exit(1)
  }
  
  try {
    targetConfig = loadEnvConfig(args['target-env'])
  } catch (error) {
    console.error(`Error loading target config: ${error.message}`)
    process.exit(1)
  }
  
  // Test database connections
  const sourceDbOk = await testDatabaseConnection('Source', sourceConfig, true)
  const targetDbOk = await testDatabaseConnection('Target', targetConfig, false)
  
  // Test AWS S3 connections
  const sourceS3 = await testAwsS3Connection('Source', sourceConfig)
  const targetS3 = await testAwsS3Connection('Target', targetConfig)

  // Quick legacy download test from source
  if (sourceDbOk) {
    console.log('\nTesting legacy media download...')
    await testLegacyDownloadForProject(new Sequelize(sourceConfig.database, sourceConfig.user, sourceConfig.password, sourceConfig), projectId)
  }
  
  console.log('\n========================')
  console.log('Test Summary:')
  console.log(`  Source database: ${sourceDbOk ? '✓ OK' : '✗ FAILED'}`)
  console.log(`  Target database: ${targetDbOk ? '✓ OK' : '✗ FAILED'}`)
  console.log(`  Project ${projectId}: ${sourceDbOk ? '✓ Found' : '✗ Not found'}`)
  console.log(`  Source S3: ${sourceS3.configured ? (sourceS3.accessible ? '✓ OK' : '✗ Not accessible') : '○ Not configured'}`)
  console.log(`  Target S3: ${targetS3.configured ? (targetS3.accessible ? '✓ OK' : '✗ Not accessible') : '○ Not configured'}`)
  
  console.log('\nCapabilities:')
  if (targetS3.accessible) {
    console.log('  ✓ Can migrate journal covers and media files to S3')
    console.log('  ✓ Can re-dump project data after migration')
  } else if (targetS3.configured) {
    console.log('  ✗ Cannot access S3 - check credentials and permissions')
  } else {
    console.log('  ○ S3 operations will be skipped (no AWS credentials)')
  }
  
  if (sourceDbOk && targetDbOk) {
    console.log('\n✓ Database tests passed! You can proceed with the migration.')
    console.log('\nNext step:')
    console.log(`  node migrate-project-data.js --project-id=${projectId} --source-env=${args['source-env']} --target-env=${args['target-env']}`)
    
    if (!targetS3.accessible) {
      console.log('\nNote: To skip S3 operations, add:')
      console.log('  --skip-s3    Skip journal cover and media file migration')
      console.log('  --skip-dumps Skip re-dumping project data')
    }
  } else {
    console.log('\n✗ Some tests failed. Please fix the issues before proceeding.')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('Unexpected error:', error)
  process.exit(1)
})