import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import config from '../config.js'

class S3Service {
  constructor() {
    this.s3Client = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
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
      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
      
      await this.s3Client.send(command)
      return true
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
        return false
      }
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
}

export default new S3Service() 