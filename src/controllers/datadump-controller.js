import * as projectsService from '../services/published-projects-service.js'
import * as statsService from '../services/published-stats-service.js'
import * as mediaService from '../services/media-service.js'
import * as utilService from '../util/util.js'
import * as projectDetailService from '../services/project-detail-service.js'
import * as projectService from '../services/projects-service.js'
import { SDDExporter } from '../lib/project-export/sdd-exporter.js'
import s3Service from '../services/s3-service.js'
import config from '../config.js'
import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'
import * as taskQueueService from '../services/task-queue-service.js'

const dir = 'data'
const mediaDir = 'media_files'
const detailDir = 'prj_details'
const statsDir = 'stats'
const projectStatsDir = 'project_stats'

/**
 * Helper function to upload content to S3 with consistent error handling
 * @param {string} bucket - S3 bucket name
 * @param {string} s3Key - S3 key/path for the file
 * @param {Buffer} content - File content to upload
 * @param {string} contentType - MIME type of the content
 * @param {string} type - Type identifier for logging and result tracking
 * @param {number} projectId - Project ID for logging
 * @returns {Object} Result object with success status and metadata
 */
async function uploadToS3(
  bucket,
  s3Key,
  content,
  contentType,
  type,
  projectId
) {
  try {
    const s3Result = await s3Service.putObject(
      bucket,
      s3Key,
      content,
      contentType
    )

    return {
      type: type,
      success: true,
      key: s3Result.key,
      etag: s3Result.etag,
      bucket: bucket,
      url: `https://${bucket}.s3.amazonaws.com/${s3Result.key}`,
    }
  } catch (s3Error) {
    console.error(
      `Failed to upload project ${projectId} ${type} to S3:`,
      s3Error.message
    )
    return {
      type: type,
      success: false,
      error: s3Error.message,
    }
  }
}

async function statsDump(req, res) {
  try {
    console.log('Start dumping stats data...')

    const projectViewsForLast30Days =
      await statsService.getProjectViewsForLast30Days()
    utilService.writeToFile(
      `../${dir}/${statsDir}/projectViewsForLast30Days.json`,
      JSON.stringify(projectViewsForLast30Days, null, 2)
    )

    const getMediaViewsForLast30Days =
      await statsService.getMediaViewsForLast30Days()
    utilService.writeToFile(
      `../${dir}/${statsDir}/mediaViewsForLast30Days.json`,
      JSON.stringify(getMediaViewsForLast30Days, null, 2)
    )

    const getMatrixDownloadsForLast30Days =
      await statsService.getMatrixDownloadsForLast30Days()
    utilService.writeToFile(
      `../${dir}/${statsDir}/matrixDownloadsForLast30Days.json`,
      JSON.stringify(getMatrixDownloadsForLast30Days, null, 2)
    )

    const getDocDownloadsForLast30Days =
      await statsService.getDocDownloadsForLast30Days()
    utilService.writeToFile(
      `../${dir}/${statsDir}/docDownloadsForLast30Days.json`,
      JSON.stringify(getDocDownloadsForLast30Days, null, 2)
    )

    console.log('Dumped stats data - DONE!')
    res.status(200).json('done!')
    return
  } catch (err) {
    console.error(`Error while dumping stats data. `, err.message)
    res.status(500).json({ message: 'Error while running stats dump process.' })
  }
}

async function dataDump(req, res) {
  try {
    const start = Date.now()
    console.log('Start dumping project data...')

    const projects = await projectsService.getProjects()
    utilService.writeToFile(
      `../${dir}/projects.json`,
      JSON.stringify(projects, null, 2)
    )
    console.log('Dumped project list data - DONE!')

    utilService.createDir(`${dir}/${mediaDir}`)
    utilService.createDir(`${dir}/${detailDir}`)

    console.log('Start dumping project details...')

    const matrixMap = await projectDetailService.getMatrixMap()
    const folioMap = await projectDetailService.getFolioMap()
    const documentMap = await projectDetailService.getDocumentMap()

    for (let i = 0; i < projects.length; i++) {
      const project = projects[i]
      const projectId = project.project_id
      const media_files = await mediaService.getMediaFileDump(projectId)
      const project_details = await projectDetailService.getProjectDetails(
        projectId,
        matrixMap,
        folioMap,
        documentMap
      )

      await utilService.writeToFile(
        `../${dir}/${detailDir}/prj_${projectId}.json`,
        JSON.stringify(project_details, null, 2)
      )
      await utilService.writeToFile(
        `../${dir}/${mediaDir}/prj_${projectId}.json`,
        JSON.stringify(media_files, null, 2)
      )
    }
    console.log('Dumped project details data - DONE!')
    const end = Date.now()
    let timeElapsed = (end - start) / 1000
    console.log(`Dump DONE in ${timeElapsed} seconds!`)

    res.status(200).json('done!')
  } catch (err) {
    console.error(`Error while dumping data. `, err.message)
    res.status(500).json({ message: 'Error while running dump process.' })
  }
}

async function projectStatsDump(req, res) {
  try {
    console.log('Start dumping project stats data...')

    const projects = await projectsService.getProjects()
    utilService.createDir(`${dir}/${projectStatsDir}`)

    const matrixMap = await projectDetailService.getMatrixMap()
    const folioMap = await projectDetailService.getFolioMap()
    const documentMap = await projectDetailService.getDocumentMap()

    for (let i = 0; i < projects.length; i++) {
      const project = projects[i]
      const projectId = project.project_id

      const project_views = await projectDetailService.getProjectViews(
        projectId,
        matrixMap,
        folioMap
      )
      const project_downloads = await projectDetailService.getProjectDownloads(
        projectId,
        matrixMap,
        documentMap
      )

      const projectStats = {
        project_id: projectId,
        project_views: project_views,
        project_downloads: project_downloads,
        generated_at: new Date().toISOString(),
      }

      await utilService.writeToFile(
        `../${dir}/${projectStatsDir}/prj_${projectId}.json`,
        JSON.stringify(projectStats, null, 2)
      )
    }

    console.log('Dumped project stats data - DONE!')
    res.status(200).json('done!')
    return
  } catch (err) {
    console.error(`Error while dumping project stats data. `, err.message)
    res
      .status(500)
      .json({ message: 'Error while running project stats dump process.' })
  }
}

/**
 * Generate and download SDD ZIP file for a specific project
 * This function is designed for programmatic/background use
 */
async function projectSDDZipDump(req, res) {
  try {
    const { projectId } = req.params
    const { partitionId } = req.query

    console.log(
      `Starting SDD ZIP dump for project ${projectId}${
        partitionId ? ` with partition ${partitionId}` : ''
      }`
    )

    // Validate access - for datadump operations, we typically only allow published projects
    // or you can modify this based on your specific requirements
    const { hasAccess, project, partition } =
      await projectService.validateProjectSDDAccess(
        projectId,
        null, // No user ID - only allow published projects
        partitionId
      )

    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    if (!hasAccess) {
      return res.status(403).json({
        message: 'Access denied - only published projects can be dumped',
      })
    }

    if (partitionId && !partition) {
      return res.status(404).json({ message: 'Partition not found' })
    }

    // Create progress callback for logging
    const progressCallback = (progress) => {
      console.log(
        `[Project ${projectId}] ${progress.stage}: ${progress.message} (${progress.overallProgress}%)`
      )
    }

    // Create SDD exporter with progress tracking
    const exporter = new SDDExporter(projectId, partitionId, progressCallback)
    const filename = `${projectId}_morphobank.zip`

    // Set headers for ZIP download
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    // Set timeout for large downloads
    req.setTimeout(1800000) // 30 minutes
    res.setTimeout(1800000)

    // Stream ZIP directly to response
    await exporter.exportAsZip(res)

    console.log(`SDD ZIP dump completed for project ${projectId}`)
  } catch (error) {
    console.error('Error generating SDD ZIP dump:', error)

    // If response hasn't been sent yet, send error
    if (!res.headersSent) {
      return res.status(500).json({
        message: 'Failed to generate SDD ZIP dump',
        error: error.message,
      })
    }
  }
}

/**
 * Generate SDD ZIP file and save to filesystem and/or upload to S3
 * @param {number} projectId - Project ID
 * @param {number|null} partitionId - Optional partition ID
 * @param {string} outputDir - Local output directory (optional if only uploading to S3)
 * @param {boolean} uploadToS3Only - If true, only upload to S3 without saving locally
 * @returns {Object} Result object with success status, file info, and S3 result
 */
async function saveProjectSDDZip(
  projectId,
  partitionId = null,
  outputDir = '../data/sdd_exports',
  uploadToS3Only = false
) {
  const start = Date.now()

  try {
    console.log(`Starting SDD ZIP file generation for project ${projectId}`)

    // Validate access
    const { hasAccess, project, partition } =
      await projectService.validateProjectSDDAccess(
        projectId,
        null, // No user ID - only allow published projects
        partitionId
      )

    if (!project) {
      throw new Error('Project not found')
    }

    if (!hasAccess) {
      throw new Error('Access denied - only published projects can be exported')
    }

    if (partitionId && !partition) {
      throw new Error('Partition not found')
    }

    // Create progress callback for logging
    const progressCallback = (progress) => {
      console.log(
        `[Project ${projectId}] ${progress.stage}: ${progress.message} (${progress.overallProgress}%)`
      )
    }

    // Create SDD exporter with progress tracking
    const exporter = new SDDExporter(projectId, partitionId, progressCallback)
    const filename = `${projectId}_morphobank.zip`

    let filePath = null
    let s3Result = { success: false, type: 'sdd_zip' }

    if (uploadToS3Only) {
      // Generate ZIP in memory and upload directly to S3
      const { Readable, PassThrough } = await import('stream')
      const chunks = []

      // Create a PassThrough stream to collect ZIP data
      const collectStream = new PassThrough()
      collectStream.on('data', (chunk) => chunks.push(chunk))

      // Generate ZIP and collect data
      await exporter.exportAsZip(collectStream)

      // Combine all chunks into a single buffer
      const zipBuffer = Buffer.concat(chunks)

      // Upload to S3
      if (config.aws.accessKeyId && config.aws.secretAccessKey) {
        const bucket = config.aws.defaultBucket || 'mb4-data'
        const s3Key = `sdd_exports/${filename}`

        console.log(`[Project ${projectId}] Uploading ZIP to S3: ${s3Key}`)

        s3Result = await uploadToS3(
          bucket,
          s3Key,
          zipBuffer,
          'application/zip',
          'sdd_zip',
          projectId
        )

        if (s3Result.success) {
          console.log(
            `[Project ${projectId}] ✅ S3 upload successful: ${s3Result.url}`
          )
          console.log(
            `[Project ${projectId}] File size: ${(
              zipBuffer.length /
              1024 /
              1024
            ).toFixed(2)} MB`
          )
        } else {
          console.error(
            `[Project ${projectId}] ❌ S3 upload failed: ${s3Result.error}`
          )
        }
      } else {
        console.warn(
          `[Project ${projectId}] ⚠️ AWS credentials not configured - skipping S3 upload`
        )
      }
    } else {
      // Save locally and optionally upload to S3
      utilService.createDir(outputDir)
      filePath = `${outputDir}/${filename}`

      // Create a write stream to save the file
      const fs = await import('fs')
      const writeStream = fs.createWriteStream(filePath)

      // Export as ZIP to the file stream
      await exporter.exportAsZip(writeStream)

      console.log(`SDD ZIP file saved locally: ${filePath}`)

      // Also upload to S3 if configured
      if (config.aws.accessKeyId && config.aws.secretAccessKey) {
        try {
          // Read the file and upload to S3
          const zipBuffer = fs.readFileSync(filePath)
          const bucket = config.aws.defaultBucket || 'mb4-data'
          const s3Key = `sdd_exports/${filename}`
          s3Result = await uploadToS3(
            bucket,
            s3Key,
            zipBuffer,
            'application/zip',
            'sdd_zip',
            projectId
          )

          if (s3Result.success) {
            console.log(`SDD ZIP file also uploaded to S3: ${s3Result.url}`)
          }
        } catch (s3Error) {
          console.error('Failed to upload ZIP to S3:', s3Error.message)
          s3Result.error = s3Error.message
        }
      }
    }

    const end = Date.now()
    const timeElapsed = (end - start) / 1000

    return {
      success: true,
      filePath,
      filename,
      projectId,
      partitionId,
      timeElapsed,
      s3Result,
      uploadedToS3: s3Result.success,
      s3Url: s3Result.success ? s3Result.url : null,
    }
  } catch (error) {
    console.error(
      `[Project ${projectId}] ❌ Error saving SDD ZIP file:`,
      error.message
    )
    console.error(`[Project ${projectId}] Stack trace:`, error.stack)
    return {
      success: false,
      error: error.message,
      projectId,
      partitionId,
      s3Result: { success: false, type: 'sdd_zip', error: error.message },
    }
  }
}

/**
 * HTTP endpoint to generate and upload SDD ZIP to S3 for a specific project
 * This is for authenticated users to trigger SDD export with S3 upload
 */
async function exportProjectSDDToS3(req, res) {
  try {
    const { projectId } = req.params
    const { partitionId } = req.query
    const userId = req.user?.user_id

    console.log(
      `Starting SDD S3 export for project ${projectId}${
        partitionId ? ` with partition ${partitionId}` : ''
      } by user ${userId}`
    )

    // Use the enhanced function to upload directly to S3
    const result = await saveProjectSDDZip(projectId, partitionId, null, true)

    if (result.success) {
      const response = {
        success: true,
        message: 'SDD export completed successfully',
        projectId: result.projectId,
        partitionId: result.partitionId,
        filename: result.filename,
        timeElapsed: result.timeElapsed,
        uploadedToS3: result.uploadedToS3,
        s3Url: result.s3Url,
      }

      if (result.uploadedToS3) {
        console.log(
          `SDD S3 export completed for project ${projectId}: ${result.s3Url}`
        )
        res.status(200).json(response)
      } else {
        console.error(
          `SDD S3 export failed for project ${projectId}: ${result.s3Result.error}`
        )
        res.status(500).json({
          success: false,
          message: 'Failed to upload SDD export to S3',
          error: result.s3Result.error,
          projectId: result.projectId,
          partitionId: result.partitionId,
        })
      }
    } else {
      console.error(
        `SDD export failed for project ${projectId}: ${result.error}`
      )
      res.status(500).json({
        success: false,
        message: 'Failed to generate SDD export',
        error: result.error,
        projectId: result.projectId,
        partitionId: result.partitionId,
      })
    }
  } catch (error) {
    console.error('Error in SDD S3 export endpoint:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error during SDD export',
      error: error.message,
    })
  }
}

/**
 * Get all published project IDs for bulk export
 */
async function getAllPublishedProjects() {
  const [projects] = await sequelizeConn.query(`
    SELECT project_id, name, disk_usage
    FROM projects 
    WHERE published = 1 AND deleted = 0
    ORDER BY project_id
  `)
  return projects
}

/**
 * Queue bulk SDD export for all published projects
 * Admin-only endpoint for backup purposes
 */
async function queueBulkSDDExportTask(req, res) {
  try {
    console.log('Starting bulk SDD export for all published projects...')

    // Get all published projects
    const projects = await getAllPublishedProjects()
    console.log(`Found ${projects.length} published projects to export`)

    if (projects.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No published projects found to export',
        projectCount: 0,
      })
    }

    // Process projects in sequential batches: create batch → process batch → next batch
    const BATCH_SIZE = 5 // Process 5 projects at a time
    const totalBatches = Math.ceil(projects.length / BATCH_SIZE)

    console.log(
      `[BULK_EXPORT] Starting sequential batch processing: ${projects.length} projects in ${totalBatches} batches of ${BATCH_SIZE}`
    )

    // Start the sequential batch processing in background
    setImmediate(async () => {
      try {
        const adminUser = { user_id: 1, fname: 'System', lname: 'Admin' }
        let totalProcessed = 0
        let totalSuccessful = 0
        let totalFailed = 0

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const batchStart = batchIndex * BATCH_SIZE
          const batchEnd = Math.min(batchStart + BATCH_SIZE, projects.length)
          const batch = projects.slice(batchStart, batchEnd)

          console.log(
            `[BULK_EXPORT] === BATCH ${batchIndex + 1}/${totalBatches} ===`
          )
          console.log(
            `[BULK_EXPORT] Creating tasks for projects ${
              batchStart + 1
            }-${batchEnd}`
          )

          // Step 1: Create tasks for this batch
          const batchTaskIds = []
          const batchTransaction = await sequelizeConn.transaction()

          try {
            for (const project of batch) {
              const task = await models.TaskQueue.create(
                {
                  user_id: 1,
                  priority: 300,
                  completed_on: null,
                  handler: 'SDDExport',
                  parameters: {
                    projectId: project.project_id,
                    partitionId: null,
                    userId: 1,
                    uploadToS3Only: true,
                    outputDir: '../data/sdd_exports',
                    isBulkExport: true,
                  },
                },
                {
                  transaction: batchTransaction,
                  user: adminUser,
                }
              )
              batchTaskIds.push(task.task_id)
            }
            await batchTransaction.commit()
            console.log(
              `[BULK_EXPORT] Created ${batchTaskIds.length} tasks for batch ${
                batchIndex + 1
              }`
            )
          } catch (error) {
            await batchTransaction.rollback()
            console.error(
              `[BULK_EXPORT] Error creating tasks for batch ${batchIndex + 1}:`,
              error
            )
            continue // Skip this batch and continue with next
          }

          // Step 2: Process this batch (wait for completion)
          console.log(
            `[BULK_EXPORT] Processing batch ${batchIndex + 1} tasks...`
          )

          try {
            // Process tasks and wait for this batch to complete
            await taskQueueService.processTasks()

            // Wait a bit for tasks to start processing
            await new Promise((resolve) => setTimeout(resolve, 2000))

            // Monitor batch completion
            let batchCompleted = false
            let attempts = 0
            const maxAttempts = 60 // 5 minutes max wait per batch

            while (!batchCompleted && attempts < maxAttempts) {
              const [pendingTasks] = await sequelizeConn.query(`
                SELECT COUNT(*) as count 
                FROM ca_task_queue 
                WHERE task_id IN (${batchTaskIds.join(',')}) 
                AND completed_on IS NULL
              `)

              const pendingCount = pendingTasks[0].count
              if (pendingCount === 0) {
                batchCompleted = true
                console.log(`[BULK_EXPORT] Batch ${batchIndex + 1} completed!`)
              } else {
                console.log(
                  `[BULK_EXPORT] Batch ${
                    batchIndex + 1
                  }: ${pendingCount} tasks still processing...`
                )
                await new Promise((resolve) => setTimeout(resolve, 5000)) // Wait 5 seconds
                attempts++
              }
            }

            if (!batchCompleted) {
              console.warn(
                `[BULK_EXPORT] Batch ${
                  batchIndex + 1
                } timed out, moving to next batch`
              )
            }

            // Count successes/failures for this batch
            const [results] = await sequelizeConn.query(`
              SELECT 
                SUM(CASE WHEN completed_on IS NOT NULL AND error IS NULL THEN 1 ELSE 0 END) as successful,
                SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) as failed
              FROM ca_task_queue 
              WHERE task_id IN (${batchTaskIds.join(',')})
            `)

            const batchSuccessful = parseInt(results[0].successful) || 0
            const batchFailed = parseInt(results[0].failed) || 0

            totalProcessed += batch.length
            totalSuccessful += batchSuccessful
            totalFailed += batchFailed

            console.log(
              `[BULK_EXPORT] Batch ${
                batchIndex + 1
              } results: ${batchSuccessful} successful, ${batchFailed} failed`
            )
            console.log(
              `[BULK_EXPORT] Overall progress: ${totalProcessed}/${projects.length} projects processed`
            )
          } catch (error) {
            console.error(
              `[BULK_EXPORT] Error processing batch ${batchIndex + 1}:`,
              error
            )
            totalFailed += batch.length
          }

          // Small delay before next batch
          if (batchIndex < totalBatches - 1) {
            console.log(`[BULK_EXPORT] Waiting 2 seconds before next batch...`)
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }
        }

        console.log(`[BULK_EXPORT] === ALL BATCHES COMPLETED ===`)
        console.log(
          `[BULK_EXPORT] Total: ${totalProcessed} processed, ${totalSuccessful} successful, ${totalFailed} failed`
        )
      } catch (error) {
        console.error(
          '[BULK_EXPORT] Error in sequential batch processing:',
          error
        )
      }
    })

    // Return immediate response
    res.status(202).json({
      success: true,
      message: `Bulk SDD export started for ${projects.length} published projects`,
      projectCount: projects.length,
      batchSize: BATCH_SIZE,
      totalBatches: totalBatches,
      status: 'Sequential batch processing started in background',
      note: `Projects will be processed in batches of ${BATCH_SIZE}. Each batch completes before the next begins.`,
      processingMode: 'sequential',
    })
  } catch (error) {
    console.error('Error queueing bulk SDD export tasks:', error)
    res.status(500).json({
      success: false,
      message: 'Internal server error during bulk SDD export queueing',
      error: error.message,
    })
  }
}

/**
 * Queue SDD export as background task and start processing immediately
 * Returns task ID for status checking while processing in background
 */
async function queueSDDExportTask(req, res) {
  try {
    const { projectId } = req.params
    const { partitionId, uploadToS3Only = true } = req.query
    const userId = req.user?.user_id

    console.log(
      `Queueing SDD export task for project ${projectId}${
        partitionId ? ` with partition ${partitionId}` : ''
      } by user ${userId}`
    )

    // Validate access first (quick check before queuing)
    const { hasAccess, project } =
      await projectService.validateProjectSDDAccess(
        projectId,
        userId,
        partitionId
      )

    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' })
    }

    // Create task in queue
    const transaction = await sequelizeConn.transaction()

    try {
      const task = await models.TaskQueue.create(
        {
          user_id: userId,
          priority: 200, // Medium priority
          completed_on: null,
          handler: 'SDDExport',
          parameters: {
            projectId: parseInt(projectId),
            partitionId: partitionId ? parseInt(partitionId) : null,
            userId: userId,
            uploadToS3Only: uploadToS3Only === 'true',
            outputDir: '../data/sdd_exports',
          },
        },
        {
          transaction: transaction,
          user: req.user,
        }
      )

      await transaction.commit()

      console.log(
        `SDD export task ${task.task_id} queued for project ${projectId}`
      )

      // Trigger immediate task processing
      console.log(`Triggering immediate processing for task ${task.task_id}`)

      // Process tasks in background (don't await to avoid blocking response)
      taskQueueService.processTasks().catch((error) => {
        console.error('Error processing tasks:', error)
      })

      res.status(202).json({
        success: true,
        message: 'SDD export task queued and processing started',
        taskId: task.task_id,
        projectId: parseInt(projectId),
        partitionId: partitionId ? parseInt(partitionId) : null,
        status: 'queued',
        statusUrl: `/api/tasks/${task.task_id}/status`,
      })
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  } catch (error) {
    console.error('Error queueing SDD export task:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to queue SDD export task',
      error: error.message,
    })
  }
}

/**
 * Get status of SDD export task
 */
async function getSDDExportTaskStatus(req, res) {
  try {
    const { taskId } = req.params
    const userId = req.user?.user_id

    const task = await models.TaskQueue.findOne({
      where: {
        task_id: taskId,
        user_id: userId, // Only allow users to check their own tasks
        handler: 'SDDExport',
      },
    })

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or access denied',
      })
    }

    const statusMap = {
      0: 'queued',
      1: 'processing',
      2: 'completed',
      3: 'failed',
    }

    const response = {
      success: true,
      taskId: task.task_id,
      status: statusMap[task.status] || 'unknown',
      projectId: task.parameters?.projectId,
      partitionId: task.parameters?.partitionId,
      createdAt: new Date(task.created_on * 1000).toISOString(),
      completedAt: task.completed_on
        ? new Date(task.completed_on * 1000).toISOString()
        : null,
    }

    // Add result data if completed successfully
    if (task.status === 2 && task.result) {
      try {
        const result =
          typeof task.result === 'string'
            ? JSON.parse(task.result)
            : task.result
        response.result = {
          filename: result.filename,
          timeElapsed: result.timeElapsed,
          uploadedToS3: result.uploadedToS3,
          s3Url: result.s3Url,
          message: result.message,
        }
      } catch (parseError) {
        console.error('Error parsing task result:', parseError)
      }
    }

    // Add error info if failed
    if (task.status === 3) {
      response.error = {
        code: task.error_code,
        message: task.notes || 'Export failed',
      }
    }

    res.status(200).json(response)
  } catch (error) {
    console.error('Error getting task status:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get task status',
      error: error.message,
    })
  }
}

export {
  dataDump,
  statsDump,
  projectStatsDump,
  projectSDDZipDump,
  saveProjectSDDZip,
  exportProjectSDDToS3,
  queueSDDExportTask,
  queueBulkSDDExportTask,
  getSDDExportTaskStatus,
}
