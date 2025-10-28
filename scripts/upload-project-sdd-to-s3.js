// Usage examples:
//   node scripts/upload-project-sdd-to-s3.js --all                    # Process all projects
//   node scripts/upload-project-sdd-to-s3.js --project-id=1234       # Single project
//   node scripts/upload-project-sdd-to-s3.js --project-id=1234,5678  # Multiple projects
//   node scripts/upload-project-sdd-to-s3.js --all --partition-id=5678 # All projects with partition
//   node scripts/upload-project-sdd-to-s3.js --csv                   # Generate CSV of missing projects
// docker cp scripts/ mb4-service-container-prod:/app/
// Env expected (already set in container):
//   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
//   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_DEFAULT_BUCKET
//
// RUN ON LOCAL: docker exec -it mb4-service-container-local npm run upload:sdd -- --all
//docker exec mb4-service-container-prod pkill -f "upload-project-sdd-to-s3.js"
// docker exec -d mb4-service-container-prod sh -c "npm run upload:sdd -- --project-id=3919,3972,5280,661,4101,4083,3836,3459,4056,604,3970,4527,4895,3298,5608,2170,3123,3127,3383,3650,1006,4343,4541,2802,2520,4619,5803,3222,2283,3413,2602,4966,2298,5530,2741,1172,1007,2517,4048,687,3415,2396 > /tmp/upload.log 2>&1"
//

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
const GENERATE_CSV = ARGS['csv'] || false

if (!PROCESS_ALL && !PROJECT_ID_INPUT && !GENERATE_CSV) {
  console.error('Missing required argument')
  console.error('Usage: node scripts/upload-project-sdd-to-s3.js --all')
  console.error(
    '       node scripts/upload-project-sdd-to-s3.js --project-id=1234'
  )
  console.error(
    '       node scripts/upload-project-sdd-to-s3.js --project-id=1234,5678'
  )
  console.error('       node scripts/upload-project-sdd-to-s3.js --csv')
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

// Function to get all projects with their details from database
async function getAllProjectsWithDetails() {
  try {
    const [rows] = await sequelizeConn.query(
      `SELECT project_id, name, disk_usage FROM projects WHERE deleted = 0 ORDER BY project_id`
    )
    return rows.map((row) => ({
      project_id: row.project_id.toString(),
      name: row.name,
      disk_usage: row.disk_usage || 0,
      size_mb: row.disk_usage ? Math.round(row.disk_usage / 1024 / 1024) : 0,
    }))
  } catch (error) {
    console.error(
      '❌ Failed to fetch project details from database:',
      error.message
    )
    process.exit(1)
  }
}

// Function to generate CSV of projects not yet uploaded to S3
async function generateMissingProjectsCSV() {
  try {
    console.log('📊 Generating CSV of projects not yet uploaded to S3...')

    // Get all projects with details
    const projects = await getAllProjectsWithDetails()
    console.log(`Found ${projects.length} total projects`)

    // Import S3 service
    const s3Service = (await import('../src/services/s3-service.js')).default
    const bucketName = process.env.AWS_S3_DEFAULT_BUCKET || 'mb4-data'

    const missingProjects = []
    let checkedCount = 0

    for (const project of projects) {
      checkedCount++

      // Progress indicator every 50 projects
      if (checkedCount % 50 === 0 || checkedCount === projects.length) {
        console.log(
          `Checking S3 status: ${checkedCount}/${projects.length} projects`
        )
      }

      try {
        const s3Key = `sdd_exports/${project.project_id}_morphobank.zip`
        const exists = await s3Service.objectExists(bucketName, s3Key)

        if (!exists) {
          missingProjects.push({
            project_id: project.project_id,
            name: project.name,
            size_mb: project.size_mb,
            disk_usage_bytes: project.disk_usage,
          })
        }
      } catch (error) {
        console.error(
          `❌ Error checking project ${project.project_id}: ${error.message}`
        )
        // Add to missing list if we can't check (assume missing)
        missingProjects.push({
          project_id: project.project_id,
          name: project.name,
          size_mb: project.size_mb,
          disk_usage_bytes: project.disk_usage,
          error: error.message,
        })
      }
    }

    // Generate CSV content
    const csvHeader = 'project_id,name,size_mb,disk_usage_bytes,error\n'
    const csvRows = missingProjects
      .map((project) => {
        const name = project.name.replace(/"/g, '""') // Escape quotes
        const error = project.error
          ? `"${project.error.replace(/"/g, '""')}"`
          : ''
        return `${project.project_id},"${name}",${project.size_mb},${project.disk_usage_bytes},${error}`
      })
      .join('\n')

    const csvContent = csvHeader + csvRows

    // Write CSV to file
    const fs = await import('fs/promises')
    const csvFilename = `missing_sdd_projects_${
      new Date().toISOString().split('T')[0]
    }.csv`
    await fs.writeFile(csvFilename, csvContent, 'utf8')

    console.log(`\n📄 CSV generated: ${csvFilename}`)
    console.log(`📊 Summary:`)
    console.log(`   Total projects: ${projects.length}`)
    console.log(`   Missing from S3: ${missingProjects.length}`)
    console.log(
      `   Already uploaded: ${projects.length - missingProjects.length}`
    )

    // Show size breakdown
    const totalSizeMB = missingProjects.reduce((sum, p) => sum + p.size_mb, 0)
    const largeProjects = missingProjects.filter((p) => p.size_mb > 1024)

    console.log(`   Total size of missing projects: ${totalSizeMB}MB`)
    console.log(`   Large projects (>1GB): ${largeProjects.length}`)

    if (largeProjects.length > 0) {
      console.log(
        `   Large project IDs: ${largeProjects
          .map((p) => p.project_id)
          .join(', ')}`
      )
    }

    return csvFilename
  } catch (error) {
    console.error('❌ Failed to generate CSV:', error.message)
    process.exit(1)
  }
}

// Main execution function
async function main() {
  // Handle CSV generation
  if (GENERATE_CSV) {
    await generateMissingProjectsCSV()
    return
  }

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

        // Skip projects larger than 5GB to prevent excessive processing
        if (projectSizeMB > 5120) {
          console.log(
            `⚠️  Skipping project ${projectId} - size ${projectSizeMB}MB exceeds 5GB limit`
          )
          resolve({
            success: false,
            error: 'Project too large (>5GB)',
            skipped: true,
          })
          return
        }

        console.log(
          `📤 Uploading project ${projectId} of size ${projectSizeMB}MB`
        )

        // Sanitize project name for filename
        const projectName = project.name.replace(/[^a-zA-Z0-9]/g, '_')

        // Create a PassThrough stream for direct streaming to S3
        const uploadStream = new PassThrough()
        const s3Key = `sdd_exports/${projectId}_morphobank.zip`
        const bucketName = process.env.AWS_S3_DEFAULT_BUCKET || 'mb4-data'

        // Import S3 service
        const s3Service = (await import('../src/services/s3-service.js'))
          .default

        // Start the S3 upload immediately (streaming)
        // Use multipart upload for files larger than 100MB
        const uploadPromise =
          projectSizeMB > 100
            ? s3Service.putObjectMultipart(
                bucketName,
                s3Key,
                uploadStream,
                'application/zip'
              )
            : (async () => {
                // For smaller files, collect chunks and use regular upload
                const chunks = []
                for await (const chunk of uploadStream) {
                  chunks.push(chunk)
                }
                const zipBuffer = Buffer.concat(chunks)
                return await s3Service.putObject(
                  bucketName,
                  s3Key,
                  zipBuffer,
                  'application/zip'
                )
              })()

        // Handle upload completion
        uploadPromise
          .then(() => {
            console.log(
              `✅ Project ${projectId} completed (${projectSizeMB}MB)`
            )
            resolve({ success: true })
          })
          .catch((s3UploadError) => {
            console.error(
              `❌ Failed to upload ZIP to S3 for project ${projectId}: ${s3UploadError}`
            )
            resolve({ success: false, error: s3UploadError.message })
          })

        // Handle errors in the stream
        uploadStream.on('error', (error) => {
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
          uploadStream
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
    let skippedCount = 0

    for (let i = 0; i < PROJECT_IDS.length; i++) {
      const projectId = PROJECT_IDS[i]
      const result = await uploadSingleProject(projectId)
      results.push({ projectId, ...result })

      if (result.success) {
        successCount++
      } else if (result.skipped) {
        skippedCount++
      } else {
        failureCount++
      }
    }

    // Summary
    console.log(
      `\n📊 Summary: ${successCount} successful, ${skippedCount} skipped (too large), ${failureCount} failed`
    )

    if (skippedCount > 0) {
      console.log(
        `⚠️  Skipped (too large): ${results
          .filter((r) => r.skipped)
          .map((r) => r.projectId)
          .join(', ')}`
      )
    }

    if (failureCount > 0) {
      console.log(
        `❌ Failed: ${results
          .filter((r) => !r.success && !r.skipped)
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
