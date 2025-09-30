import sharp from 'sharp'
import s3Service from '../services/s3-service.js'
import config from '../config.js'
import path from 'path'

/**
 * S3 Journal Cover Uploader
 * 
 * Specialized uploader for journal covers that follows the new format:
 * - Uploads directly to S3 without creating MediaFile records
 * - Uses standardized naming: projects_journal_cover_{project_id}.{extension}
 * - Stores files in media_files/journal_covers/uploads/
 * - Returns new journal cover format for database storage
 */
export class S3JournalCoverUploader {
  constructor(transaction, user) {
    this.transaction = transaction
    this.user = user
    this.uploadedFiles = []
  }

  /**
   * Upload journal cover and return new format data
   * @param {number} projectId - The project ID
   * @param {Object} file - The uploaded file object
   * @returns {Object} New journal cover format for database storage
   */
  async uploadJournalCover(projectId, file) {
    try {
      const originalFilename = file.originalname
      const extension = path.extname(originalFilename).toLowerCase()
      
      // Generate standardized filename
      const standardizedFilename = `projects_journal_cover_${projectId}${extension}`
      const s3Key = `media_files/journal_covers/uploads/${standardizedFilename}`
      
      // Process image with Sharp to ensure it's optimized
      const image = sharp(file.path)
      const metadata = await image.metadata()
      
      // Optimize the image (compress while maintaining quality)
      const optimizedBuffer = await image
        .jpeg({ quality: 90, progressive: true })
        .toBuffer()
      
      // Upload to S3
      const result = await s3Service.putObject(
        config.aws.defaultBucket,
        s3Key,
        optimizedBuffer,
        'image/jpeg'
      )
      
      // Track uploaded file for rollback if needed
      this.uploadedFiles.push({
        bucket: config.aws.defaultBucket,
        key: s3Key,
        etag: result.etag,
      })
      
      // Return new journal cover format
      return {
        filename: standardizedFilename,
        ORIGINAL_FILENAME: originalFilename,
        migrated: true,
        migrated_at: new Date().toISOString(),
        s3_key: s3Key,
        width: metadata.width,
        height: metadata.height,
        filesize: optimizedBuffer.length,
        mimetype: 'image/jpeg'
      }
      
    } catch (error) {
      console.error('Error uploading journal cover:', error)
      throw new Error(`Failed to upload journal cover: ${error.message}`)
    }
  }

  /**
   * Commit the upload (no-op for journal covers since we don't use transactions)
   */
  commit() {
    // Journal covers are uploaded directly to S3, no transaction commit needed
  }

  /**
   * Rollback the upload by deleting uploaded files from S3
   */
  async rollback() {
    for (const file of this.uploadedFiles) {
      try {
        await s3Service.deleteObject(file.bucket, file.key)
        console.log(`Rolled back journal cover upload: ${file.key}`)
      } catch (error) {
        console.error(`Failed to rollback journal cover upload ${file.key}:`, error)
      }
    }
    this.uploadedFiles = []
  }
}
