import s3Service from '../services/s3-service.js'
import config from '../config.js'
import multer from 'multer'
import path from 'path'
import { MEDIA_TYPES } from '../util/media-constants.js'

/**
 * Get object from S3
 * GET /s3/:key*
 */
export const getObject = async (req, res) => {
  try {
    const key = req.params[0] // This captures the full path

    // Use default bucket from config
    const bucket = config.aws.defaultBucket

    if (!bucket) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Default S3 bucket not configured',
      })
    }

    // Validate required parameters
    if (!key) {
      return res.status(400).json({
        error: 'Missing parameters',
        message: 'Object key is required',
      })
    }

    // Get object from S3
    const result = await s3Service.getObject(bucket, key)

    // Set appropriate headers
    res.set({
      'Content-Type': result.contentType || 'application/octet-stream',
      'Content-Length': result.contentLength,
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Last-Modified': result.lastModified,
    })

    // Send the data
    res.send(result.data)
  } catch (error) {
    // Handle 404 errors without logging (expected behavior for missing files)
    if (error.name === 'NoSuchKey' || error.message.includes('NoSuchKey')) {
      return res.status(404).json({
        error: 'Object not found',
        message: 'The requested object does not exist',
      })
    }

    if (error.name === 'NoSuchBucket') {
      return res.status(404).json({
        error: 'Bucket not found',
        message: 'The specified bucket does not exist',
      })
    }

    // Log only non-404 errors
    console.error('S3 Controller Error:', error)

    if (error.name === 'AccessDenied') {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient permissions to access the requested object',
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve object from S3',
    })
  }
}

/**
 * Check if object exists in S3
 * HEAD /s3/:key*
 */
export const checkObject = async (req, res) => {
  try {
    const key = req.params[0]

    // Use default bucket from config
    const bucket = config.aws.defaultBucket

    if (!bucket) {
      return res.status(500).end()
    }

    const exists = await s3Service.objectExists(bucket, key)

    if (exists) {
      res.status(200).end()
    } else {
      res.status(404).end()
    }
  } catch (error) {
    console.error('S3 Controller Error:', error)
    res.status(500).end()
  }
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for video and 3D files
  },
  fileFilter: (req, file, cb) => {
    const mediaType = req.body.mediaType
    
    if (mediaType === MEDIA_TYPES.IMAGE) {
      const allowedImageTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
      ]
      if (allowedImageTypes.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(
          new Error(
            'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
          ),
          false
        )
      }
    } else if (mediaType === MEDIA_TYPES.VIDEO) {
      const allowedVideoTypes = [
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo',
        'video/avi',
        'video/webm',
        'video/x-matroska',
        'video/x-ms-wmv',
        'video/x-flv',
        'video/x-m4v'
      ]
      if (allowedVideoTypes.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(
          new Error(
            'Invalid file type. Only MP4, MOV, AVI, WebM, MKV, WMV, FLV, and M4V video files are allowed.'
          ),
          false
        )
      }
    } else if (mediaType === MEDIA_TYPES.MODEL_3D) {
      const allowed3DTypes = [
        'application/ply',
        'application/stl',
        'model/ply',
        'model/stl',
        'model/obj',
        'model/gltf+json',
        'model/gltf-binary',
        'application/octet-stream' // For STL, PLY, and other binary formats
      ]
      if (allowed3DTypes.includes(file.mimetype)) {
        cb(null, true)
      } else {
        // Also check by file extension for 3D files since MIME types can be inconsistent
        const extension = file.originalname.split('.').pop()?.toLowerCase()
        const allowed3DExtensions = ['ply', 'stl', 'obj', 'gltf', 'glb', 'fbx']
        if (allowed3DExtensions.includes(extension)) {
          cb(null, true)
        } else {
          cb(
            new Error(
              'Invalid file type. Only PLY, STL, OBJ, GLTF, GLB, and FBX 3D model files are allowed.'
            ),
            false
          )
        }
      }
    } else if (mediaType === MEDIA_TYPES.STACKS) {
      // For stacks, we only accept ZIP files containing DICOM/TIFF
      const allowedStacksTypes = [
        'application/zip',
        'application/x-zip-compressed',
        'application/octet-stream' // Some systems send this for ZIP files
      ]
      if (allowedStacksTypes.includes(file.mimetype) || file.originalname.toLowerCase().endsWith('.zip')) {
        cb(null, true)
      } else {
        cb(
          new Error(
            'Invalid file type. Only ZIP archives are allowed for stack uploads.'
          ),
          false
        )
      }
    } else {
      // For other media types, allow all files
      cb(null, true)
    }
  },
})

// Configure multer for bulk uploads (multiple files)
const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 3, // Maximum 3 files (original, large, thumbnail)
  },
  fileFilter: (req, file, cb) => {
    // Allow only image files for now (can be extended for other media types)
    if (req.body.mediaType === 'image') {
      const allowedImageTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
      ]
      if (allowedImageTypes.includes(file.mimetype)) {
        cb(null, true)
      } else {
        cb(
          new Error(
            'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
          ),
          false
        )
      }
    } else {
      // For future media types, allow all files
      cb(null, true)
    }
  },
})

/**
 * Upload object to S3
 * PUT /s3/upload
 * Body: { mediaType: 'image', projectId: '123', mediaId: '456', fileSize: 'large' }
 * File: multipart/form-data with 'file' field
 */
export const uploadObject = [
  upload.single('file'),
  async (req, res) => {
    try {
      const { mediaType, projectId, mediaId, fileSize } = req.body
      const file = req.file

      // Validate required parameters
      if (!mediaType || !projectId || !mediaId || !fileSize) {
        return res.status(400).json({
          error: 'Missing parameters',
          message: 'mediaType, projectId, mediaId, and fileSize are required',
        })
      }

      if (!file) {
        return res.status(400).json({
          error: 'Missing file',
          message: 'File is required for upload',
        })
      }

      // Validate media type (currently only 'image' is supported)
      const supportedMediaTypes = [MEDIA_TYPES.IMAGE, MEDIA_TYPES.VIDEO, MEDIA_TYPES.MODEL_3D]
      if (!supportedMediaTypes.includes(mediaType)) {
        return res.status(400).json({
          error: 'Unsupported media type',
          message: `Media type '${mediaType}' is not supported. Supported types: ${supportedMediaTypes.join(
            ', '
          )}`,
        })
      }

      // Validate file size type
      const supportedFileSizes = ['large', 'original', 'thumbnail']
      if (!supportedFileSizes.includes(fileSize)) {
        return res.status(400).json({
          error: 'Invalid file size',
          message: `File size '${fileSize}' is not supported. Supported sizes: ${supportedFileSizes.join(
            ', '
          )}`,
        })
      }

      // Get file extension
      const fileExtension =
        path.extname(file.originalname).toLowerCase() ||
        getExtensionFromMimeType(file.mimetype)

      // Construct S3 key based on the required structure
      // Format: {mediaType}s/{projectId}/{mediaId}/{projectId}_{mediaId}_{fileSize}.{extension}
      // Example: images/100/9586/100_9586_large.jpg
      const fileName = `${projectId}_${mediaId}_${fileSize}${fileExtension}`
      const s3Key = `${mediaType}s/${projectId}/${mediaId}/${fileName}`

      // Use default bucket from config
      const bucket = config.aws.defaultBucket

      if (!bucket) {
        return res.status(500).json({
          error: 'Configuration error',
          message: 'Default S3 bucket not configured',
        })
      }

      // Upload to S3
      const result = await s3Service.putObject(
        bucket,
        s3Key,
        file.buffer,
        file.mimetype
      )

      // Return success response
      res.status(200).json({
        success: true,
        message: 'File uploaded successfully',
        data: {
          key: result.key,
          etag: result.etag,
          bucket: bucket,
          url: `https://${bucket}.s3.amazonaws.com/${result.key}`,
          metadata: {
            mediaType,
            projectId,
            mediaId,
            fileSize,
            fileName,
            originalFilename: file.originalname,
            uploadedFileSize: file.size,
            contentType: file.mimetype,
          },
        },
      })
    } catch (error) {
      console.error('S3 Upload Error:', error)

      // Handle multer errors
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large',
          message: 'File size exceeds the maximum allowed limit of 10MB',
        })
      }

      if (error.message.includes('Invalid file type')) {
        return res.status(400).json({
          error: 'Invalid file type',
          message: error.message,
        })
      }

      // Handle AWS S3 errors
      if (error.name === 'NoSuchBucket') {
        return res.status(404).json({
          error: 'Bucket not found',
          message: 'The specified bucket does not exist',
        })
      }

      if (error.name === 'AccessDenied') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Insufficient permissions to upload to S3',
        })
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to upload file to S3',
      })
    }
  },
]

/**
 * Upload multiple objects to S3 (bulk upload for different file sizes)
 * PUT /s3/upload/bulk
 * Body: { mediaType: 'image', projectId: '123', mediaId: '456' }
 * Files: multipart/form-data with fields: 'original', 'large', 'thumbnail'
 */
export const uploadBulkObjects = [
  bulkUpload.fields([
    { name: 'original', maxCount: 1 },
    { name: 'large', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { mediaType, projectId, mediaId } = req.body
      const files = req.files

      // Validate required parameters
      if (!mediaType || !projectId || !mediaId) {
        return res.status(400).json({
          error: 'Missing parameters',
          message: 'mediaType, projectId, and mediaId are required',
        })
      }

      if (!files || Object.keys(files).length === 0) {
        return res.status(400).json({
          error: 'Missing files',
          message: 'At least one file is required for upload',
        })
      }

      // Validate media type (currently only 'image' is supported)
      const supportedMediaTypes = [MEDIA_TYPES.IMAGE, MEDIA_TYPES.VIDEO, MEDIA_TYPES.MODEL_3D]
      if (!supportedMediaTypes.includes(mediaType)) {
        return res.status(400).json({
          error: 'Unsupported media type',
          message: `Media type '${mediaType}' is not supported. Supported types: ${supportedMediaTypes.join(
            ', '
          )}`,
        })
      }

      // Use default bucket from config
      const bucket = config.aws.defaultBucket

      if (!bucket) {
        return res.status(500).json({
          error: 'Configuration error',
          message: 'Default S3 bucket not configured',
        })
      }

      const uploadResults = []
      const errors = []

      // Process each file size
      for (const [fileSize, fileArray] of Object.entries(files)) {
        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0] // Get the first file from the array

          try {
            // Get file extension
            const fileExtension =
              path.extname(file.originalname).toLowerCase() ||
              getExtensionFromMimeType(file.mimetype)

            // Construct S3 key based on the required structure
            // Format: {mediaType}s/{projectId}/{mediaId}/{projectId}_{mediaId}_{fileSize}.{extension}
            // Example: images/100/9586/100_9586_large.jpg
            const fileName = `${projectId}_${mediaId}_${fileSize}${fileExtension}`
            const s3Key = `${mediaType}s/${projectId}/${mediaId}/${fileName}`

            // Upload to S3
            const result = await s3Service.putObject(
              bucket,
              s3Key,
              file.buffer,
              file.mimetype
            )

            uploadResults.push({
              fileSize,
              key: result.key,
              etag: result.etag,
              fileName,
              url: `https://${bucket}.s3.amazonaws.com/${result.key}`,
              metadata: {
                originalFilename: file.originalname,
                uploadedFileSize: file.size,
                contentType: file.mimetype,
              },
            })
          } catch (error) {
            console.error(`S3 Upload Error for ${fileSize}:`, error)
            errors.push({
              fileSize,
              error: error.message,
              originalFilename: file.originalname,
            })
          }
        }
      }

      // Return response
      const response = {
        success: uploadResults.length > 0,
        message:
          errors.length > 0
            ? `Uploaded ${uploadResults.length} files with ${errors.length} errors`
            : `Successfully uploaded ${uploadResults.length} files`,
        data: {
          mediaType,
          projectId,
          mediaId,
          bucket,
          uploads: uploadResults,
          totalUploaded: uploadResults.length,
          totalErrors: errors.length,
        },
      }

      if (errors.length > 0) {
        response.data.errors = errors
      }

      // Return appropriate status code
      const statusCode = uploadResults.length > 0 ? 200 : 400
      res.status(statusCode).json(response)
    } catch (error) {
      console.error('S3 Bulk Upload Error:', error)

      // Handle multer errors
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          error: 'File too large',
          message: 'One or more files exceed the maximum allowed limit of 10MB',
        })
      }

      if (error.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({
          error: 'Too many files',
          message: 'Maximum of 3 files allowed (original, large, thumbnail)',
        })
      }

      if (error.message.includes('Invalid file type')) {
        return res.status(400).json({
          error: 'Invalid file type',
          message: error.message,
        })
      }

      // Handle AWS S3 errors
      if (error.name === 'NoSuchBucket') {
        return res.status(404).json({
          error: 'Bucket not found',
          message: 'The specified bucket does not exist',
        })
      }

      if (error.name === 'AccessDenied') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Insufficient permissions to upload to S3',
        })
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to upload files to S3',
      })
    }
  },
]

/**
 * Get file extension from MIME type
 * @param {string} mimeType - The MIME type
 * @returns {string} - The file extension
 */
function getExtensionFromMimeType(mimeType) {
  const mimeTypeMap = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      '.docx',
  }

  return mimeTypeMap[mimeType] || '.bin'
}

/**
 * Validate if bucket is allowed based on configuration
 * @param {string} bucketName - The bucket name to validate
 * @returns {boolean} - Whether the bucket is valid
 */
function isValidBucket(bucketName) {
  // Get allowed buckets from config
  const allowedBuckets = config.aws.allowedBuckets || []

  // If no specific buckets are configured, allow all (less secure)
  if (allowedBuckets.length === 0) {
    console.warn('No S3 bucket restrictions configured - allowing all buckets')
    return true
  }

  return allowedBuckets.includes(bucketName)
}
