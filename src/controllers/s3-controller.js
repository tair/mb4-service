import s3Service from '../services/s3-service.js'
import config from '../config.js'

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
    console.error('S3 Controller Error:', error)
    
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