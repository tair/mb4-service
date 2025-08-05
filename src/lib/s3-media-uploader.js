import sharp from 'sharp'
import s3Service from '../services/s3-service.js'
import config from '../config.js'
import { Datamodel } from './datamodel/datamodel.js'
import { MEDIA_TYPES } from '../util/media-constants.js'

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
      thumbnail: { width: 120, height: 120 },
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
            if (
              metadata.width > dimensions.maxWidth ||
              metadata.height > dimensions.maxHeight
            ) {
              processedImage = image.resize(
                dimensions.maxWidth,
                dimensions.maxHeight,
                {
                  fit: 'inside',
                  withoutEnlargement: true,
                }
              )
            }
          } else if (sizeName === 'thumbnail') {
            // For thumbnail, resize to exact dimensions
            processedImage = image.resize(dimensions.width, dimensions.height, {
              fit: 'cover',
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
          etag: result.etag,
        })
      } catch (error) {
        console.error(`Error processing ${sizeName} variant:`, error)
        throw new Error(
          `Failed to process ${sizeName} variant: ${error.message}`
        )
      }
    }

    // Set the media data
    model.set(fieldName, json)
  }

  commit() {
    this.uploadedFiles = []
  }

  async setNonImageMedia(model, fieldName, file) {
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
    const originalExtension = extension

    // Prepare the file buffer
    let fileBuffer
    if (file.buffer) {
      fileBuffer = file.buffer
    } else if (file.path) {
      const fs = await import('fs')
      fileBuffer = await fs.promises.readFile(file.path)
    } else {
      throw new Error('No file buffer or path provided')
    }

    // Generate S3 key - preserve original extension for non-image files
    const fileName = `${model.project_id}_${rowId}_original.${originalExtension}`
    const s3Key = `media_files/images/${model.project_id}/${rowId}/${fileName}`

    // Upload original file to S3
    const result = await s3Service.putObject(
      config.aws.defaultBucket,
      s3Key,
      fileBuffer,
      file.mimetype || 'application/octet-stream'
    )

    // Create media JSON structure for non-image files
    const json = {
      ORIGINAL_FILENAME: file.originalname,
      original: {
        S3_KEY: s3Key,
        S3_ETAG: result.etag,
        FILESIZE: fileBuffer.length,
        MIMETYPE: file.mimetype || 'application/octet-stream',
        EXTENSION: originalExtension,
        PROPERTIES: {
          mimetype: file.mimetype || 'application/octet-stream',
          filesize: fileBuffer.length,
          version: 'original',
        },
      },
    }

    // For 3D files, set an icon to indicate it's a 3D file
    if (model.media_type === MEDIA_TYPES.MODEL_3D) {
      json.thumbnail = {
        USE_ICON: '3d',
        PROPERTIES: {
          version: 'thumbnail',
        },
      }
    }

    // For video files, set an icon to indicate it's a video file
    if (model.media_type === MEDIA_TYPES.VIDEO) {
      json.thumbnail = {
        USE_ICON: 'video',
        PROPERTIES: {
          version: 'thumbnail',
        },
      }
    }



    this.uploadedFiles.push({
      bucket: config.aws.defaultBucket,
      key: s3Key,
      etag: result.etag,
    })

    // Set the media data
    model.set(fieldName, json)
  }

  async uploadVideoThumbnails(model, thumbnailData) {
    const { promises: fs } = await import('fs')
    
    try {
      // Get existing media data
      const existingMedia = model.media || {}
      
      // Upload large thumbnail
      if (thumbnailData.large.path) {
        const largeBuffer = await fs.readFile(thumbnailData.large.path)
        const largeFileName = `${model.project_id}_${model.media_id}_large.jpg`
        const largeS3Key = `media_files/images/${model.project_id}/${model.media_id}/${largeFileName}`
        
        const largeResult = await s3Service.putObject(
          config.aws.defaultBucket,
          largeS3Key,
          largeBuffer,
          'image/jpeg'
        )
        
        existingMedia.large = {
          S3_KEY: largeS3Key,
          S3_ETAG: largeResult.etag,
          WIDTH: thumbnailData.large.width,
          HEIGHT: thumbnailData.large.height,
          FILESIZE: largeBuffer.length,
          MIMETYPE: 'image/jpeg',
          EXTENSION: 'jpg',
          PROPERTIES: {
            height: thumbnailData.large.height,
            width: thumbnailData.large.width,
            mimetype: 'image/jpeg',
            filesize: largeBuffer.length,
            version: 'large',
          },
        }
        
        this.uploadedFiles.push({
          bucket: config.aws.defaultBucket,
          key: largeS3Key,
          etag: largeResult.etag,
        })
      }
      
      // Upload thumbnail
      if (thumbnailData.thumbnail.path) {
        const thumbBuffer = await fs.readFile(thumbnailData.thumbnail.path)
        const thumbFileName = `${model.project_id}_${model.media_id}_thumbnail.jpg`
        const thumbS3Key = `media_files/images/${model.project_id}/${model.media_id}/${thumbFileName}`
        
        const thumbResult = await s3Service.putObject(
          config.aws.defaultBucket,
          thumbS3Key,
          thumbBuffer,
          'image/jpeg'
        )
        
        existingMedia.thumbnail = {
          S3_KEY: thumbS3Key,
          S3_ETAG: thumbResult.etag,
          WIDTH: thumbnailData.thumbnail.width,
          HEIGHT: thumbnailData.thumbnail.height,
          FILESIZE: thumbBuffer.length,
          MIMETYPE: 'image/jpeg',
          EXTENSION: 'jpg',
          PROPERTIES: {
            height: thumbnailData.thumbnail.height,
            width: thumbnailData.thumbnail.width,
            mimetype: 'image/jpeg',
            filesize: thumbBuffer.length,
            version: 'thumbnail',
          },
        }
        
        this.uploadedFiles.push({
          bucket: config.aws.defaultBucket,
          key: thumbS3Key,
          etag: thumbResult.etag,
        })
      }
      
      // Update the model with the new media data
      model.set('media', existingMedia)
      
    } catch (error) {
      console.error('Failed to upload video thumbnails:', error)
      throw error
    }
  }

  async rollback() {
    // Log rollback for debugging - files will remain in S3
    console.log(
      `Rollback requested for ${this.uploadedFiles.length} uploaded files`
    )
    for (const file of this.uploadedFiles) {
      console.log(`Uploaded file: ${file.bucket}/${file.key}`)
    }
  }
}
