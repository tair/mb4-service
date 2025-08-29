import { Handler } from './handler.js'
import { saveProjectSDDZip } from '../../controllers/datadump-controller.js'

/**
 * Task handler for SDD export operations
 * Processes SDD exports in the background to avoid HTTP timeouts
 */
export class SDDExportHandler extends Handler {
  getName() {
    return 'SDDExport'
  }

  /**
   * Process SDD export task
   * @param {Object} parameters - Task parameters
   * @param {number} parameters.projectId - Project ID to export
   * @param {number} parameters.partitionId - Optional partition ID
   * @param {number} parameters.userId - User ID who requested the export
   * @param {boolean} parameters.uploadToS3Only - Whether to upload only to S3
   * @param {string} parameters.outputDir - Output directory for local files
   * @returns {Promise<{result: Object, error: null}>}
   */
  async process(parameters) {
    try {
      const {
        projectId,
        partitionId = null,
        userId,
        uploadToS3Only = true,
        outputDir = '../data/sdd_exports',
        isBulkExport = false,
      } = parameters

      const logPrefix = isBulkExport ? '[BULK_SDD_EXPORT]' : '[SDD_EXPORT_TASK]'

      console.log(
        `${logPrefix} Starting SDD export for project ${projectId}${
          partitionId ? ` partition ${partitionId}` : ''
        } by user ${userId}`
      )

      // Use the existing saveProjectSDDZip function
      const result = await saveProjectSDDZip(
        projectId,
        partitionId,
        outputDir,
        uploadToS3Only
      )

      if (result.success) {
        console.log(
          `${logPrefix} ✅ SDD export completed for project ${projectId}`
        )
        console.log(`${logPrefix} Time elapsed: ${result.timeElapsed}s`)
        if (result.uploadedToS3) {
          console.log(`${logPrefix} S3 file: ${result.s3Url}`)
        }
        if (result.filePath) {
          console.log(`${logPrefix} Local file: ${result.filePath}`)
        }
        console.log(`${logPrefix} === PROJECT ${projectId} EXPORT COMPLETE ===`)

        return {
          result: {
            success: true,
            projectId: result.projectId,
            partitionId: result.partitionId,
            filename: result.filename,
            timeElapsed: result.timeElapsed,
            uploadedToS3: result.uploadedToS3,
            s3Url: result.s3Url,
            filePath: result.filePath,
            message: 'SDD export completed successfully',
          },
          error: null,
        }
      } else {
        const errorMsg = `SDD export failed for project ${projectId}: ${result.error}`

        if (isBulkExport) {
          // For bulk exports, log error but don't fail the entire process
          console.warn(
            `${logPrefix} ${errorMsg} - Continuing with next project`
          )
        } else {
          console.error(`${logPrefix} ${errorMsg}`)
        }

        return {
          result: null,
          error: {
            code: 500,
            message: result.error,
            projectId: result.projectId,
            partitionId: result.partitionId,
            isBulkExport: isBulkExport,
          },
        }
      }
    } catch (error) {
      const errorMsg = `Error processing SDD export for project ${projectId}: ${error.message}`

      if (isBulkExport) {
        // For bulk exports, log error but don't fail the entire process
        console.warn(`${logPrefix} ${errorMsg} - Continuing with next project`)
      } else {
        console.error(`${logPrefix} ${errorMsg}`)
      }

      return {
        result: null,
        error: {
          code: 500,
          message: error.message,
          stack: error.stack,
          projectId: projectId,
          isBulkExport: isBulkExport,
        },
      }
    }
  }
}
