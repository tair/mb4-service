import sharp from 'sharp'
import s3Service from '../services/s3-service.js'
import config from '../config.js'
import { Datamodel } from './datamodel/datamodel.js'

export class S3MediaUploader {
  constructor(transaction, user) {
    this.transaction = transaction
    this.user = user
    this.uploadedFiles = []
  }

  async setMedia(model, fieldName, file) {
    const tableName = model.constructor.tableName
    const fieldAttributes = model.rawAttributes[fieldName]
    const volume = fieldAttributes.volume || tableName

    const datamodel = Datamodel.getInstance()
    const primaryKeys = datamodel.getPrimaryKey(model)
    if (primaryKeys.length != 1) {
      throw 'Model does not have a single primary key'
    }

    const rowId = model[primaryKeys[0]]
    if (!rowId) {
      throw 'Row Id is not defined'
    }

    const extension = file.originalname.split('.').pop().toLowerCase()
    
    // Process image with Sharp
    const image = sharp(file.path)
    const metadata = await image.metadata()

    // Define image sizes - only the three we need
    const sizes = {
      original: null, // No resizing, but will compress
      large: { maxWidth: 800, maxHeight: 800 },
      thumbnail: { width: 120, height: 120 }
    }

    const json = {
      ORIGINAL_FILENAME: file.originalname,
    }

    // Upload each size variant to S3
    for (const [sizeName, dimensions] of Object.entries(sizes)) {
      try {
        let processedImage = image
        
        // Resize if dimensions are specified
        if (dimensions) {
          if (sizeName === 'large') {
            // For large, maintain aspect ratio and compress if larger than 800px
            if (metadata.width > dimensions.maxWidth || metadata.height > dimensions.maxHeight) {
              processedImage = image.resize(dimensions.maxWidth, dimensions.maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
              })
            }
          } else if (sizeName === 'thumbnail') {
            // For thumbnail, resize to exact dimensions
            processedImage = image.resize(dimensions.width, dimensions.height, {
              fit: 'cover'
            })
          }
        }

        // Convert to buffer with compression - always use JPEG for consistency
        const buffer = await processedImage
          .jpeg({ quality: 85, progressive: true })
          .toBuffer()
        
        const processedMetadata = await processedImage.metadata()

        // Generate S3 key - always use .jpg extension since we're converting to JPEG
        const fileName = `${model.project_id}_${rowId}_${sizeName}.jpg`
        const s3Key = `media_files/images/${model.project_id}/${rowId}/${fileName}`

        // Upload to S3 with correct MIME type
        const result = await s3Service.putObject(
          config.aws.defaultBucket,
          s3Key,
          buffer,
          'image/jpeg' // Always use image/jpeg since we're converting everything to JPEG
        )

        // Store clean S3-based metadata (no legacy fields like HASH, MAGIC, etc.)
        json[sizeName] = {
          S3_KEY: s3Key,
          S3_ETAG: result.etag,
          WIDTH: processedMetadata.width,
          HEIGHT: processedMetadata.height,
          FILESIZE: buffer.length,
          MIMETYPE: 'image/jpeg', // Always JPEG since we convert everything
          EXTENSION: 'jpg', // Always jpg since we convert everything
          PROPERTIES: {
            height: processedMetadata.height,
            width: processedMetadata.width,
            mimetype: 'image/jpeg',
            filesize: buffer.length,
            version: sizeName,
          },
        }

        this.uploadedFiles.push({
          bucket: config.aws.defaultBucket,
          key: s3Key,
          etag: result.etag
        })

      } catch (error) {
        console.error(`Error processing ${sizeName} variant:`, error)
        throw new Error(`Failed to process ${sizeName} variant: ${error.message}`)
      }
    }

    // Set the media data
    model.set(fieldName, json)
  }

  commit() {
    this.uploadedFiles = []
  }

  async rollback() {
    // Log rollback for debugging - files will remain in S3
    console.log(`Rollback requested for ${this.uploadedFiles.length} uploaded files`)
    for (const file of this.uploadedFiles) {
      console.log(`Uploaded file: ${file.bucket}/${file.key}`)
    }
  }
} 