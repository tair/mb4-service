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

import { PassThrough } from 'stream'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Get the project root directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

// Import the service function and dependencies
import { generateProjectSDDFallback } from '../src/services/projects-service.js'
import { getProject } from '../src/services/projects-service.js'
import sequelizeConn from '../src/util/db.js'

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

  async function uploadSingleProject(projectId) {
    return new Promise(async (resolve) => {
      try {
        // First, get the project details to validate it exists and get the name
        const project = await getProject(projectId)

        if (!project || !project.project_id) {
          console.error(`❌ Project ${projectId} not found`)
          resolve({ success: false, error: 'Project not found' })
          return
        }

        // Get project size from disk_usage field
        const projectSizeMB = project.disk_usage
          ? Math.round(project.disk_usage / 1024 / 1024)
          : 0
        console.log(
          `📤 Uploading project ${projectId} of size ${projectSizeMB}MB`
        )

        // Sanitize project name for filename
        const projectName = project.name.replace(/[^a-zA-Z0-9]/g, '_')

        // Create a PassThrough stream to capture the ZIP data
        const captureStream = new PassThrough()
        const chunks = []

        // Capture data as it flows through
        captureStream.on('data', (chunk) => {
          chunks.push(chunk)
        })

        // Handle completion
        captureStream.on('end', async () => {
          try {
            const zipBuffer = Buffer.concat(chunks)
            const s3Key = `sdd_exports/${projectId}_morphobank.zip`
            const bucketName = process.env.AWS_S3_DEFAULT_BUCKET || 'mb4-data'

            // Import S3 service
            const s3Service = (await import('../src/services/s3-service.js'))
              .default

            const uploadResult = await s3Service.putObject(
              bucketName,
              s3Key,
              zipBuffer,
              'application/zip'
            )

            const sizeMB = Math.round(zipBuffer.length / 1024 / 1024)
            console.log(`✅ Project ${projectId} completed (${sizeMB}MB)`)
            resolve({ success: true })
          } catch (s3UploadError) {
            console.error(
              `❌ Project ${projectId}: Upload failed - ${s3UploadError.message}`
            )
            resolve({ success: false, error: s3UploadError.message })
          }
        })

        // Handle errors in the stream
        captureStream.on('error', (error) => {
          console.error(
            `❌ Project ${projectId}: Stream error - ${error.message}`
          )
          resolve({ success: false, error: error.message })
        })

        // Call the service function to generate the SDD export
        const result = await generateProjectSDDFallback(
          projectId,
          PARTITION_ID,
          projectName,
          captureStream
        )

        if (!result.success) {
          console.error(
            `❌ Project ${projectId}: Export failed - ${result.error}`
          )
          resolve({ success: false, error: result.error })
        }
      } catch (error) {
        console.error(`❌ Project ${projectId}: ${error.message}`)
        resolve({ success: false, error: error.message })
      }
    })
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

// Run the main function
main().catch((error) => {
  console.error('❌ Script failed:', error.message)
  process.exit(1)
})
