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
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'

// Get the project root directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, '..')

// Import the service function and dependencies
import { generateProjectSDDFallback } from '../src/services/projects-service.js'
import { getProject } from '../src/services/projects-service.js'
import sequelizeConn from '../src/util/db.js'
import config from '../src/config.js'

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

        // Create stream for tracking and collecting data
        const trackingStream = new PassThrough()
        let bytesReceived = 0
        let lastBytesReceived = 0
        let lastBytesUpdateTime = Date.now()
        const startTime = Date.now()
        const s3Key = `sdd_exports/${projectId}_morphobank.zip`
        const bucketName = process.env.AWS_S3_DEFAULT_BUCKET || 'mb4-data'
        const STALL_TIMEOUT = 180000 // 3 minutes without any data = stalled

        // Create S3 client
        const s3Client = new S3Client({
          region: config.aws.region,
          credentials: {
            accessKeyId: config.aws.accessKeyId,
            secretAccessKey: config.aws.secretAccessKey,
          },
          maxAttempts: 3,
          retryMode: 'adaptive',
        })

        // Multipart upload state
        const PART_SIZE = 100 * 1024 * 1024 // 100MB per part
        let uploadId = null
        const parts = []
        let partBuffer = Buffer.alloc(0)
        let partNumber = 1
        let isUploading = false
        let uploadError = null

        // Helper function to upload a part
        async function uploadPart(partData, partNum) {
          const command = new UploadPartCommand({
            Bucket: bucketName,
            Key: s3Key,
            UploadId: uploadId,
            PartNumber: partNum,
            Body: partData,
          })
          const response = await s3Client.send(command)
          return { ETag: response.ETag, PartNumber: partNum }
        }

        // Process uploads in the background (non-blocking)
        async function processUploads() {
          if (isUploading || !uploadId || uploadError) return

          while (partBuffer.length >= PART_SIZE && uploadId && !uploadError) {
            isUploading = true
            const partData = partBuffer.slice(0, PART_SIZE)
            partBuffer = partBuffer.slice(PART_SIZE)
            const currentPartNumber = partNumber
            partNumber++

            try {
              console.log(
                `   📤 Starting upload of part ${currentPartNumber} (${(
                  partData.length /
                  1024 /
                  1024
                ).toFixed(2)}MB)...`
              )
              const partResult = await uploadPart(partData, currentPartNumber)
              parts.push(partResult)
              console.log(
                `   ✅ Completed upload of part ${partResult.PartNumber}`
              )
            } catch (partError) {
              uploadError = partError
              console.error(
                `   ❌ Failed to upload part ${currentPartNumber}: ${partError.message}`
              )
              // Abort multipart upload on error
              if (uploadId) {
                try {
                  await s3Client.send(
                    new AbortMultipartUploadCommand({
                      Bucket: bucketName,
                      Key: s3Key,
                      UploadId: uploadId,
                    })
                  )
                } catch (abortError) {
                  // Ignore abort errors
                }
              }
              trackingStream.destroy()
              return
            } finally {
              isUploading = false
            }
          }
        }

        // Track bytes for progress reporting (non-blocking)
        trackingStream.on('data', (chunk) => {
          if (uploadError) return // Stop processing if error occurred

          bytesReceived += chunk.length
          lastBytesUpdateTime = Date.now() // Update timestamp when data arrives
          partBuffer = Buffer.concat([partBuffer, chunk])

          // Trigger upload processing (non-blocking)
          processUploads().catch((err) => {
            uploadError = err
            trackingStream.destroy()
          })
        })

        // Stall detection and status update interval (every 5 seconds)
        const statusInterval = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000 // seconds
          const mbReceived = (bytesReceived / 1024 / 1024).toFixed(2)
          const mbPerSecond =
            elapsed > 0
              ? (bytesReceived / 1024 / 1024 / elapsed).toFixed(2)
              : '0.00'
          const progressPercent =
            projectSizeMB > 0
              ? ((bytesReceived / 1024 / 1024 / projectSizeMB) * 100).toFixed(1)
              : '0.0'

          // Check for stalled stream
          const timeSinceLastUpdate = Date.now() - lastBytesUpdateTime
          const hasStalled =
            timeSinceLastUpdate > STALL_TIMEOUT && bytesReceived > 0
          const isStalledWarning =
            timeSinceLastUpdate > 60000 && bytesReceived === lastBytesReceived // 1 minute without change

          // Monitor buffer sizes
          const partBufferMB = (partBuffer.length / 1024 / 1024).toFixed(2)
          const bufferWarning = partBuffer.length > 500 * 1024 * 1024 // 500MB buffer

          if (hasStalled) {
            console.error(
              `   ⚠️ STREAM STALLED: No data received for ${Math.floor(
                timeSinceLastUpdate / 1000
              )}s (${Math.floor(timeSinceLastUpdate / 60000)} minutes)`
            )
            console.error(
              `   ⚠️ Last received: ${mbReceived}MB. The export process may be stuck.`
            )
            console.error(
              `   ⚠️ Part buffer size: ${partBufferMB}MB | Parts uploaded: ${parts.length} | Is uploading: ${isUploading}`
            )
            console.error(
              `   ⚠️ This could indicate: archiver compression stalled, memory pressure, or the stream has silently failed.`
            )
            console.error(
              `   ⚠️ Consider: checking memory usage, archiver process state, or restarting the export.`
            )
          } else if (isStalledWarning) {
            console.warn(
              `   ⚠️ WARNING: No progress for ${Math.floor(
                timeSinceLastUpdate / 1000
              )}s - stream may be stalled`
            )
            console.warn(
              `   ⚠️ Part buffer: ${partBufferMB}MB | Parts: ${parts.length} | Uploading: ${isUploading}`
            )
          } else if (bufferWarning) {
            console.warn(
              `   ⚠️ Large buffer: ${partBufferMB}MB - S3 uploads may not be keeping up with stream`
            )
          }

          console.log(
            `   ⏳ Progress: ${mbReceived}MB / ${projectSizeMB}MB (${progressPercent}%) | ` +
              `Speed: ${mbPerSecond}MB/s | Elapsed: ${Math.floor(
                elapsed
              )}s | ` +
              `Buffer: ${partBufferMB}MB | Parts: ${parts.length}` +
              (hasStalled
                ? ' | ⚠️ STALLED'
                : isStalledWarning
                ? ' | ⚠️ Warning'
                : '')
          )

          lastBytesReceived = bytesReceived
        }, 5000) // Update every 5 seconds

        // Handle completion
        trackingStream.on('end', async () => {
          clearInterval(statusInterval) // Stop status updates

          // Wait for any in-progress uploads to finish
          while (isUploading) {
            await new Promise((resolve) => setTimeout(resolve, 100))
          }

          if (uploadError) {
            console.error(
              `❌ Project ${projectId}: Upload error occurred - ${uploadError.message}`
            )
            resolve({ success: false, error: uploadError.message })
            return
          }

          const totalElapsed = (Date.now() - startTime) / 1000
          const finalMB = (bytesReceived / 1024 / 1024).toFixed(2)
          const avgSpeed =
            totalElapsed > 0
              ? (bytesReceived / 1024 / 1024 / totalElapsed).toFixed(2)
              : '0.00'
          console.log(
            `   ✅ Stream complete: ${finalMB}MB received in ${Math.floor(
              totalElapsed
            )}s (avg: ${avgSpeed}MB/s)`
          )

          try {
            // Process any remaining buffered data
            await processUploads()

            // Upload remaining buffer as final part
            if (partBuffer.length > 0 && uploadId) {
              console.log(
                `   📤 Uploading final part (${(
                  partBuffer.length /
                  1024 /
                  1024
                ).toFixed(2)}MB)...`
              )
              const partResult = await uploadPart(partBuffer, partNumber)
              parts.push(partResult)
            }

            // Complete multipart upload
            console.log(`   📤 Finalizing S3 multipart upload...`)
            const uploadStartTime = Date.now()
            const completeCommand = new CompleteMultipartUploadCommand({
              Bucket: bucketName,
              Key: s3Key,
              UploadId: uploadId,
              MultipartUpload: { Parts: parts },
            })
            const uploadResult = await s3Client.send(completeCommand)
            const uploadElapsed = (
              (Date.now() - uploadStartTime) /
              1000
            ).toFixed(1)
            console.log(`   ✅ S3 upload completed in ${uploadElapsed}s`)

            const sizeMB = Math.round(bytesReceived / 1024 / 1024)
            console.log(`✅ Project ${projectId} completed (${sizeMB}MB)`)
            resolve({ success: true })
          } catch (s3UploadError) {
            // Abort multipart upload on error
            if (uploadId) {
              try {
                await s3Client.send(
                  new AbortMultipartUploadCommand({
                    Bucket: bucketName,
                    Key: s3Key,
                    UploadId: uploadId,
                  })
                )
              } catch (abortError) {
                // Ignore abort errors
              }
            }
            console.error(
              `❌ Project ${projectId}: Upload failed - ${s3UploadError.message}`
            )
            resolve({ success: false, error: s3UploadError.message })
          }
        })

        // Handle errors in the stream
        trackingStream.on('error', async (error) => {
          clearInterval(statusInterval) // Stop status updates
          // Abort multipart upload on error
          if (uploadId) {
            try {
              await s3Client.send(
                new AbortMultipartUploadCommand({
                  Bucket: bucketName,
                  Key: s3Key,
                  UploadId: uploadId,
                })
              )
            } catch (abortError) {
              // Ignore abort errors
            }
          }
          console.error(
            `❌ Project ${projectId}: Stream error - ${error.message}`
          )
          resolve({ success: false, error: error.message })
        })

        // Initialize multipart upload
        try {
          const createCommand = new CreateMultipartUploadCommand({
            Bucket: bucketName,
            Key: s3Key,
            ContentType: 'application/zip',
          })
          const createResponse = await s3Client.send(createCommand)
          uploadId = createResponse.UploadId
          console.log(
            `   📤 Initialized multipart upload (${parts.length} parts)`
          )

          // Start the export process
          const result = await generateProjectSDDFallback(
            projectId,
            PARTITION_ID,
            projectName,
            trackingStream
          )

          if (!result.success) {
            clearInterval(statusInterval) // Stop status updates
            // Abort multipart upload
            if (uploadId) {
              try {
                await s3Client.send(
                  new AbortMultipartUploadCommand({
                    Bucket: bucketName,
                    Key: s3Key,
                    UploadId: uploadId,
                  })
                )
              } catch (abortError) {
                // Ignore abort errors
              }
            }
            console.error(
              `❌ Project ${projectId}: Export failed - ${result.error}`
            )
            resolve({ success: false, error: result.error })
          }
        } catch (initError) {
          clearInterval(statusInterval) // Stop status updates
          console.error(
            `❌ Project ${projectId}: Failed to initialize upload - ${initError.message}`
          )
          resolve({ success: false, error: initError.message })
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
