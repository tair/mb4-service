import s3Service from '../services/s3-service.js'
import config from '../config.js'
import { Datamodel } from './datamodel/datamodel.js'

export class S3DocumentUploader {
  constructor(transaction, user) {
    // Validate S3 configuration before proceeding
    if (!config.aws.defaultBucket || !config.aws.accessKeyId || !config.aws.secretAccessKey) {
      throw new Error('AWS S3 configuration is incomplete. Check AWS credentials and bucket settings.')
    }
    
    this.transaction = transaction
    this.user = user
    this.uploadedFiles = []
  }

  async setDocument(model, fieldName, file) {
    const tableName = model.constructor.tableName
    const fieldAttributes = model.rawAttributes[fieldName]
    const volume = fieldAttributes.volume || tableName

    const datamodel = Datamodel.getInstance()
    const primaryKeys = datamodel.getPrimaryKey(model)
    if (primaryKeys.length != 1) {
      throw new Error('Model does not have a single primary key')
    }

    const rowId = model[primaryKeys[0]]
    const projectId = model.project_id
    
    if (!rowId) {
      throw new Error('Document ID is not defined')
    }
    
    if (!projectId) {
      throw new Error('Project ID is not defined')
    }

    // Extract file extension from original filename
    const extension = file.originalname.split('.').pop().toLowerCase() || 'bin'
    
    // Read file buffer
    let fileBuffer
    if (file.buffer) {
      fileBuffer = file.buffer
    } else if (file.path) {
      const fs = await import('fs')
      fileBuffer = await fs.promises.readFile(file.path)
    } else {
      throw new Error('No file buffer or path provided')
    }

    // Validate file size (300MB limit)
    const MAX_FILE_SIZE = 300 * 1024 * 1024 // 300MB
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new Error(`File size ${fileBuffer.length} bytes exceeds maximum allowed size of ${MAX_FILE_SIZE} bytes`)
    }

    // Basic file validation
    if (fileBuffer.length === 0) {
      throw new Error('File is empty')
    }

    // Generate S3 key following the specified format
    // Format: documents/{projectId}/{documentId}/{projectId}_{documentId}_original.{extension}
    const fileName = `${projectId}_${rowId}_original.${extension}`
    const s3Key = `documents/${projectId}/${rowId}/${fileName}`

    try {
      // Upload to S3
      const result = await s3Service.putObject(
        config.aws.defaultBucket,
        s3Key,
        fileBuffer,
        file.mimetype || 'application/octet-stream'
      )

      // Create document JSON structure compatible with existing serving system
      // Using lowercase keys to match the existing document format
      const json = {
        original_filename: file.originalname,
        s3_key: s3Key,
        s3_etag: result.etag,
        filesize: fileBuffer.length,
        mimetype: file.mimetype || 'application/octet-stream',
        extension: extension,
        properties: {
          mimetype: file.mimetype || 'application/octet-stream',
          filesize: fileBuffer.length,
        },
      }

      this.uploadedFiles.push({
        bucket: config.aws.defaultBucket,
        key: s3Key,
        etag: result.etag,
      })

      // Set the document data on the model
      model.set(fieldName, json)
      
    } catch (error) {
      console.error(`Error uploading document to S3:`, error)
      throw new Error(`Failed to upload document to S3: ${error.message}`)
    }
  }

  commit() {
    // Clear the uploaded files list after successful commit
    this.uploadedFiles = []
  }

  async rollback() {
    // Log rollback for debugging - in production you might want to delete the S3 objects
    console.log(`Rollback requested for ${this.uploadedFiles.length} uploaded document files`)
    for (const file of this.uploadedFiles) {
      console.log(`Uploaded document file: ${file.bucket}/${file.key}`)
    }
    // Note: We're not actually deleting the S3 objects here to avoid data loss
    // In a production system, you might want to implement S3 cleanup
  }
}