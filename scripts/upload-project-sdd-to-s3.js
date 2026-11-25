// Usage examples:
//   node scripts/upload-project-sdd-to-s3.js --all                    # Process all projects
//   node scripts/upload-project-sdd-to-s3.js --project-id=1234       # Single project
//   node scripts/upload-project-sdd-to-s3.js --project-id=1234,5678  # Multiple projects
//   node scripts/upload-project-sdd-to-s3.js --all --partition-id=5678 # All projects with partition
//
// Env expected (already set in container):
//   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
//   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_DEFAULT_BUCKET
//
// RUN ON LOCAL: docker exec -it mb4-service-container-local npm run upload:sdd -- --all

import { Transform } from 'stream'

import { getProject } from '../src/services/projects-service.js'
import { SDDExporter } from '../src/lib/project-export/sdd-exporter.js'
import s3Service from '../src/services/s3-service.js'
import sequelizeConn from '../src/util/db.js'

const MB = 1024 * 1024

const ARGS = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = true] = a.replace(/^--/, '').split('=')
    return [k, v]
  })
)

const PROCESS_ALL = ARGS['all'] || false
const PROJECT_ID_INPUT = ARGS['project-id'] || ARGS['project-ids']
const PARTITION_ID = ARGS['partition-id'] || null

if (!PROCESS_ALL && !PROJECT_ID_INPUT) {
  console.error('Missing required argument')
  console.error('Usage: node scripts/upload-project-sdd-to-s3.js --all')
  console.error(
    '       node scripts/upload-project-sdd-to-s3.js --project-id=1234'
  )
  console.error(
    '       node scripts/upload-project-sdd-to-s3.js --project-id=1234,5678'
  )
  process.exit(1)
}

// Function to get all project IDs from database
async function getAllProjectIds() {
  try {
    const [rows] = await sequelizeConn.query(
      `SELECT project_id FROM projects WHERE deleted = 0 ORDER BY project_id`
    )
    return rows.map((row) => row.project_id.toString())
  } catch (error) {
    console.error(
      '❌ Failed to fetch project IDs from database:',
      error.message
    )
    process.exit(1)
  }
}

// Main execution function
async function main() {
  // Get project IDs based on arguments
  let PROJECT_IDS = []

  if (PROCESS_ALL) {
    console.log('Fetching all project IDs from database...')
    PROJECT_IDS = await getAllProjectIds()
    console.log(`Found ${PROJECT_IDS.length} projects to process`)
  } else {
    // Parse project IDs (support comma-separated values)
    PROJECT_IDS = PROJECT_ID_INPUT.split(',')
      .map((id) => id.trim())
      .filter((id) => id)

    if (PROJECT_IDS.length === 0) {
      console.error('No valid project IDs provided')
      process.exit(1)
    }
  }

  console.log(
    `Starting SDD upload for ${
      PROJECT_IDS.length
    } project(s): ${PROJECT_IDS.join(', ')}` +
      (PARTITION_ID ? ` (partition ${PARTITION_ID})` : '')
  )

  // Streams the ZIP straight into an S3 multipart upload, so memory stays at a
  // few parts no matter how large the project is. (The old version collected
  // the whole ZIP in memory, twice, which can't work past a few GB.)
  async function uploadSingleProject(projectId) {
    let zipStream
    try {
      const project = await getProject(projectId)
      if (!project || !project.project_id) {
        console.error(`❌ Project ${projectId} not found`)
        return { success: false, error: 'Project not found' }
      }

      const projectSizeMB = project.disk_usage
        ? Math.round(project.disk_usage / 1024 / 1024)
        : 0
      console.log(`📤 Uploading project ${projectId} of size ${projectSizeMB}MB`)

      const s3Key = `sdd_exports/${projectId}_morphobank.zip`
      const bucketName = process.env.AWS_S3_DEFAULT_BUCKET || 'mb4-data'

      // Counts bytes on their way to S3 and logs progress every 500 MB.
      let bytes = 0
      let nextLog = 500 * MB
      zipStream = new Transform({
        transform(chunk, _enc, done) {
          bytes += chunk.length
          if (bytes >= nextLog) {
            console.log(`… project ${projectId}: ${Math.round(bytes / MB)}MB zipped`)
            nextLog += 500 * MB
          }
          done(null, chunk)
        },
      })

      const upload = s3Service.uploadStream(
        bucketName,
        s3Key,
        zipStream,
        'application/zip'
      )
      // Keep a rejection from going unhandled while the export is still running.
      upload.catch(() => {})

      const exporter = new SDDExporter(projectId, PARTITION_ID, () => {})
      await exporter.exportAsZip(zipStream)
      await upload

      console.log(
        `✅ Project ${projectId} completed (${Math.round(bytes / MB)}MB)`
      )
      return { success: true }
    } catch (error) {
      zipStream?.destroy(error)
      console.error(`❌ Project ${projectId}: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  async function uploadProjectSDD() {
    const results = []
    let successCount = 0
    let failureCount = 0

    for (let i = 0; i < PROJECT_IDS.length; i++) {
      const projectId = PROJECT_IDS[i]
      const result = await uploadSingleProject(projectId)
      results.push({ projectId, ...result })

      if (result.success) {
        successCount++
      } else {
        failureCount++
      }
    }

    // Summary
    console.log(
      `\n📊 Summary: ${successCount} successful, ${failureCount} failed`
    )

    if (failureCount > 0) {
      console.log(
        `❌ Failed: ${results
          .filter((r) => !r.success)
          .map((r) => r.projectId)
          .join(', ')}`
      )
      process.exit(1)
    }
  }

  // Run the upload process
  await uploadProjectSDD()
}

// Exit explicitly: the open DB pool would otherwise keep the process alive.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error.message)
    process.exit(1)
  })
