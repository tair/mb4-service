import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import config from '../config.js'

class S3Service {
  constructor() {
    this.s3Client = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
      maxAttempts: 3, // Retry up to 3 times on network errors
      retryMode: 'adaptive', // Use adaptive retry mode for better handling
    })
  }

  /**
   * Get object from S3 bucket
   * @param {string} bucketName - The S3 bucket name
   * @param {string} key - The object key/path
   * @returns {Promise<{data: Buffer, contentType: string}>}
   */
  async getObject(bucketName, key) {
    try {
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })

      const response = await this.s3Client.send(command)

      // Convert stream to buffer
      const chunks = []
      for await (const chunk of response.Body) {
        chunks.push(chunk)
      }
      const data = Buffer.concat(chunks)

      return {
        data,
        contentType: response.ContentType,
        lastModified: response.LastModified,
        contentLength: response.ContentLength,
      }
    } catch (error) {
      // Don't log verbose errors for expected "not found" cases
      if (
        error.name === 'NoSuchKey' ||
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        const notFoundError = new Error(`Object not found: ${error.message}`)
        notFoundError.name = 'NoSuchKey'
        throw notFoundError
      }

      // Re-throw other errors without verbose logging
      const s3Error = new Error(`Failed to get object from S3: ${error.message}`)
      s3Error.name = error.name
      s3Error.originalError = error
      throw s3Error
    }
  }

  /**
   * Check if object exists in S3 bucket
   * @param {string} bucketName - The S3 bucket name
   * @param {string} key - The object key/path
   * @returns {Promise<boolean>}
   */
  async objectExists(bucketName, key) {
    try {
      const command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      })

      await this.s3Client.send(command)
      return true
    } catch (error) {
      if (
        error.name === 'NoSuchKey' ||
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        return false
      }
      // For other errors (permissions, network, etc.), re-throw
      throw error
    }
  }

  /**
   * Upload object to S3 bucket
   * @param {string} bucketName - The S3 bucket name
   * @param {string} key - The object key/path
   * @param {Buffer} body - The object data
   * @param {string} contentType - The content type of the object
   * @returns {Promise<{key: string, etag: string}>}
   */
  async putObject(bucketName, key, body, contentType) {
    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      })

      const response = await this.s3Client.send(command)

      return {
        key,
        etag: response.ETag,
        versionId: response.VersionId,
      }
    } catch (error) {
      throw new Error(`Failed to upload object to S3: ${error.message}`)
    }
  }

  /**
   * Delete object from S3 bucket
   * @param {string} bucketName - The S3 bucket name
   * @param {string} key - The object key/path
   * @returns {Promise<void>}
   */
  async deleteObject(bucketName, key) {
    try {
      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key,
      })

      await this.s3Client.send(command)
    } catch (error) {
      throw new Error(`Failed to delete object from S3: ${error.message}`)
    }
  }

  /**
   * Copy object from one S3 location to another
   * @param {string} sourceBucketName - The source S3 bucket name
   * @param {string} sourceKey - The source object key/path
   * @param {string} destinationBucketName - The destination S3 bucket name
   * @param {string} destinationKey - The destination object key/path
   * @returns {Promise<{key: string, etag: string}>}
   */
  async copyObject(
    sourceBucketName,
    sourceKey,
    destinationBucketName,
    destinationKey
  ) {
    try {
      const copySource = `${sourceBucketName}/${sourceKey}`

      const command = new CopyObjectCommand({
        CopySource: copySource,
        Bucket: destinationBucketName,
        Key: destinationKey,
      })

      const response = await this.s3Client.send(command)

      return {
        key: destinationKey,
        etag: response.ETag,
        versionId: response.VersionId,
      }
    } catch (error) {
      throw new Error(`Failed to copy object in S3: ${error.message}`)
    }
  }

  /**
   * List objects in S3 bucket with optional prefix
   * @param {string} bucketName - The S3 bucket name
   * @param {string} prefix - The prefix to filter objects (optional)
   * @returns {Promise<Array<{Key: string, Size: number, LastModified: Date}>>}
   */
  async listObjects(bucketName, prefix = '') {
    try {
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
      })

      const response = await this.s3Client.send(command)
      return response.Contents || []
    } catch (error) {
      throw new Error(`Failed to list objects in S3: ${error.message}`)
    }
  }

  /**
   * Generate a pre-signed URL for accessing an S3 object
   * @param {string} bucketName - The S3 bucket name
   * @param {string} key - The object key/path
   * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
   * @param {Object} options - Additional options
   * @param {string} options.responseContentDisposition - Content-Disposition header (e.g., 'attachment; filename="video.mp4"')
   * @returns {Promise<string>} - Pre-signed URL
   */
  async getSignedUrl(bucketName, key, expiresIn = 3600, options = {}) {
    try {
      const commandParams = {
        Bucket: bucketName,
        Key: key,
      }

      // Add Content-Disposition if provided (for forcing download)
      if (options.responseContentDisposition) {
        commandParams.ResponseContentDisposition = options.responseContentDisposition
      }

      const command = new GetObjectCommand(commandParams)

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      })

      return signedUrl
    } catch (error) {
      throw new Error(`Failed to generate signed URL: ${error.message}`)
    }
  }
}

export default new S3Service()
