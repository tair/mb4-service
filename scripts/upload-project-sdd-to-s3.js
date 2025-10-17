// Usage examples:
//   node scripts/upload-project-sdd-to-s3.js --project-id=1234
//   node scripts/upload-project-sdd-to-s3.js --project-id=1234 --partition-id=5678
//
// Env expected (already set in container):
//   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
//   AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_DEFAULT_BUCKET
//
// RUN ON LOCAL: docker exec -it mb4-service-container-local npm run upload:sdd -- --project-id=1234

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

const ARGS = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v = true] = a.replace(/^--/, '').split('=')
    return [k, v]
  })
)

const PROJECT_ID = ARGS['project-id']
const PARTITION_ID = ARGS['partition-id'] || null

if (!PROJECT_ID) {
  console.error('Missing required --project-id argument')
  console.error(
    'Usage: node scripts/upload-project-sdd-to-s3.js --project-id=1234 [--partition-id=5678]'
  )
  process.exit(1)
}

console.log(
  `Starting SDD upload for project ${PROJECT_ID}${
    PARTITION_ID ? ` (partition ${PARTITION_ID})` : ''
  }`
)

async function uploadProjectSDD() {
  try {
    // First, get the project details to validate it exists and get the name
    console.log('Fetching project details...')
    const project = await getProject(PROJECT_ID)

    if (!project || !project.project_id) {
      console.error(`Project ${PROJECT_ID} not found`)
      process.exit(1)
    }

    console.log(`Found project: ${project.name}`)

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
        const s3Key = `sdd_exports/${PROJECT_ID}_morphobank.zip`
        const bucketName = process.env.AWS_S3_DEFAULT_BUCKET || 'mb4-data'

        console.log(`ZIP generated successfully (${zipBuffer.length} bytes)`)
        console.log(`Uploading to S3: s3://${bucketName}/${s3Key}`)

        // Import S3 service
        const s3Service = (await import('../src/services/s3-service.js'))
          .default

        const uploadResult = await s3Service.putObject(
          bucketName,
          s3Key,
          zipBuffer,
          'application/zip'
        )

        console.log(
          `✅ Successfully uploaded ZIP to S3 for project ${PROJECT_ID}`
        )
        console.log(`S3 Key: ${s3Key}`)
        console.log(`Bucket: ${bucketName}`)
        console.log(`Size: ${zipBuffer.length} bytes`)
      } catch (s3UploadError) {
        console.error(
          `❌ Failed to upload ZIP to S3 for project ${PROJECT_ID}:`,
          s3UploadError
        )
        process.exit(1)
      }
    })

    // Handle errors in the stream
    captureStream.on('error', (error) => {
      console.error('❌ Error in capture stream:', error)
      process.exit(1)
    })

    console.log('Generating SDD export...')

    // Call the service function to generate the SDD export
    const result = await generateProjectSDDFallback(
      PROJECT_ID,
      PARTITION_ID,
      projectName,
      captureStream
    )

    if (!result.success) {
      console.error(`❌ Failed to generate SDD export: ${result.error}`)
      process.exit(1)
    }

    console.log('✅ SDD export generation completed')
  } catch (error) {
    console.error('❌ Error during SDD upload process:', error)
    process.exit(1)
  }
}

// Run the upload process
uploadProjectSDD()
