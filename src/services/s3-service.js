import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import config from '../config.js'
import { Readable } from 'stream'

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
        throw new Error(`Object not found: ${error.message}`)
      }

      // Log other unexpected errors
      console.error('S3 Service Error:', error)
      throw new Error(`Failed to get object from S3: ${error.message}`)
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
      console.error('S3 Service Error:', error)
      throw new Error(`Failed to upload object to S3: ${error.message}`)
    }
  }

  /**
   * Upload a stream to S3 using multipart upload (for large files)
   * @param {string} bucketName - The S3 bucket name
   * @param {string} key - The object key/path
   * @param {Readable} stream - The readable stream to upload
   * @param {string} contentType - The content type of the object
   * @param {number} partSize - Size of each part in bytes (default: 100MB)
   * @returns {Promise<{key: string, etag: string}>}
   */
  async putObjectMultipart(
    bucketName,
    key,
    stream,
    contentType,
    partSize = 100 * 1024 * 1024
  ) {
    let uploadId
    try {
      // Step 1: Initiate multipart upload
      const createCommand = new CreateMultipartUploadCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: contentType,
      })
      const createResponse = await this.s3Client.send(createCommand)
      uploadId = createResponse.UploadId

      // Step 2: Upload parts
      const uploadedParts = []
      let partNumber = 1
      let buffer = Buffer.alloc(0)

      // Convert stream to async iterator if it isn't already
      if (typeof stream[Symbol.asyncIterator] !== 'function') {
        stream = Readable.from(stream)
      }

      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk])

        // Upload when buffer reaches part size
        while (buffer.length >= partSize) {
          const partData = buffer.slice(0, partSize)
          buffer = buffer.slice(partSize)

          const uploadPartCommand = new UploadPartCommand({
            Bucket: bucketName,
            Key: key,
            PartNumber: partNumber,
            UploadId: uploadId,
            Body: partData,
          })

          const uploadPartResponse = await this.s3Client.send(uploadPartCommand)
          uploadedParts.push({
            ETag: uploadPartResponse.ETag,
            PartNumber: partNumber,
          })

          console.log(
            `Uploaded part ${partNumber} (${Math.round(
              partData.length / 1024 / 1024
            )}MB)`
          )
          partNumber++
        }
      }

      // Upload remaining data as final part
      if (buffer.length > 0) {
        const uploadPartCommand = new UploadPartCommand({
          Bucket: bucketName,
          Key: key,
          PartNumber: partNumber,
          UploadId: uploadId,
          Body: buffer,
        })

        const uploadPartResponse = await this.s3Client.send(uploadPartCommand)
        uploadedParts.push({
          ETag: uploadPartResponse.ETag,
          PartNumber: partNumber,
        })

        console.log(
          `Uploaded final part ${partNumber} (${Math.round(
            buffer.length / 1024 / 1024
          )}MB)`
        )
      }

      // Step 3: Complete multipart upload
      const completeCommand = new CompleteMultipartUploadCommand({
        Bucket: bucketName,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: uploadedParts,
        },
      })

      const completeResponse = await this.s3Client.send(completeCommand)

      return {
        key,
        etag: completeResponse.ETag,
        versionId: completeResponse.VersionId,
      }
    } catch (error) {
      // Abort multipart upload on error
      if (uploadId) {
        try {
          await this.s3Client.send(
            new AbortMultipartUploadCommand({
              Bucket: bucketName,
              Key: key,
              UploadId: uploadId,
            })
          )
          console.log('Aborted multipart upload due to error')
        } catch (abortError) {
          console.error('Failed to abort multipart upload:', abortError)
        }
      }

      console.error('S3 Service Error:', error)
      throw new Error(
        `Failed to upload object to S3 (multipart): ${error.message}`
      )
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
      console.error('S3 Service Error:', error)
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
      console.error('S3 Service Error:', error)
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
      console.error('S3 Service Error:', error)
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
        commandParams.ResponseContentDisposition =
          options.responseContentDisposition
      }

      const command = new GetObjectCommand(commandParams)

      const signedUrl = await getSignedUrl(this.s3Client, command, {
        expiresIn,
      })

      return signedUrl
    } catch (error) {
      console.error('S3 Service Error:', error)
      throw new Error(`Failed to generate signed URL: ${error.message}`)
    }
  }
}

export default new S3Service()
