import s3Service from '../../services/s3-service.js'
import config from '../../config.js'
import { Handler } from './handler.js'

/** A handler to delete files from S3. */
export class S3FileDeletionHandler extends Handler {
  async process(parameters) {
    const bucket = config.aws.defaultBucket
    const deletedFiles = []
    const failedFiles = []

    for (const s3Key of parameters.s3_keys) {
      try {
        await s3Service.deleteObject(bucket, s3Key)
        deletedFiles.push(s3Key)
      } catch (error) {
        console.error(`Failed to delete S3 file ${s3Key}:`, error.message)
        // If the file doesn't exist, consider it a success
        if (error.name === 'NoSuchKey') {
          deletedFiles.push(s3Key)
        } else {
          failedFiles.push({ key: s3Key, error: error.message })
        }
      }
    }

    return {
      result: {
        deleted_files: deletedFiles.length,
        failed_files: failedFiles.length,
        errors: failedFiles,
      },
    }
  }

  getName() {
    return 'S3FileDeletion'
  }
}
