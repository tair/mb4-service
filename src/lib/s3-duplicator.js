import s3Service from '../services/s3-service.js'
import config from '../config.js'

/**
 * S3 File Duplication Utility
 * Handles copying ALL files from source folders to destination folders during project duplication
 */
export class S3Duplicator {
  constructor() {
    this.createdKeys = [] // Track created keys for cleanup on error
    this.bucket = config.aws.defaultBucket
  }

  /**
   * Duplicate ALL media files in S3 folder from old project to new project
   * This copies ALL files in the source folder, not just what's in the database
   * @param {string} mediaType - Type of media (image, video, model_3d) 
   * @param {number} oldProjectId - Original project ID
   * @param {number} newProjectId - New project ID  
   * @param {number} oldMediaId - Original media ID
   * @param {number} newMediaId - New media ID
   * @param {Object} mediaJson - Media file JSON data
   * @returns {Object} Updated media JSON with new S3 keys
   */
  async duplicateMediaFiles(mediaType, oldProjectId, newProjectId, oldMediaId, newMediaId, mediaJson) {
    const updatedJson = { ...mediaJson }
    
    try {
      // Step 1: Try to copy actual files from OLD to NEW locations (use original mediaJson)
      await this.copyMediaFilesIfExist(mediaType, oldProjectId, newProjectId, oldMediaId, newMediaId, mediaJson)
      
      // Step 2: Update all S3 keys in JSON to point to new paths (always do this)
      this.updateMediaJsonS3Keys(updatedJson, oldProjectId, newProjectId, oldMediaId, newMediaId)

      return updatedJson
    } catch (error) {
      console.error('Error duplicating media files in S3:', error)
      throw error
    }
  }

  /**
   * Duplicate ALL document files in S3 folder 
   * @param {number} oldProjectId - Original project ID
   * @param {number} newProjectId - New project ID
   * @param {number} oldDocumentId - Original document ID
   * @param {number} newDocumentId - New document ID
   * @param {Object} documentJson - Document file JSON data
   * @returns {Object} Updated document JSON with new S3 keys
   */
  async duplicateDocumentFiles(oldProjectId, newProjectId, oldDocumentId, newDocumentId, documentJson) {
    const updatedJson = { ...documentJson }
    
    try {
      // Documents folder structure: documents/{projectId}/{documentId}/
      const sourceFolderPrefix = `documents/${oldProjectId}/${oldDocumentId}/`
      
      // List ALL files in the source folder
      const sourceObjects = await s3Service.listObjects(this.bucket, sourceFolderPrefix)
      
      if (sourceObjects.length === 0) {
        console.warn(`No S3 objects found in document folder: ${sourceFolderPrefix}`)
        return updatedJson
      }

      // Copy ALL files from source to destination folder
      for (const obj of sourceObjects) {
        const sourceKey = obj.Key
        const newKey = this.transformDocumentS3Key(sourceKey, oldProjectId, newProjectId, oldDocumentId, newDocumentId)
        
        await this.copyS3Object(sourceKey, newKey)
        this.createdKeys.push(newKey)
        
        console.log(`S3 document file copied: ${sourceKey} -> ${newKey}`)
      }

      // Update the JSON with new S3 keys
      if (documentJson.S3_KEY) {
        const oldS3Key = documentJson.S3_KEY
        const newS3Key = this.transformDocumentS3Key(oldS3Key, oldProjectId, newProjectId, oldDocumentId, newDocumentId)
        updatedJson.S3_KEY = newS3Key
      }
      
      if (documentJson.s3_key) {
        const oldS3Key = documentJson.s3_key
        const newS3Key = this.transformDocumentS3Key(oldS3Key, oldProjectId, newProjectId, oldDocumentId, newDocumentId)
        updatedJson.s3_key = newS3Key
      }

      return updatedJson
    } catch (error) {
      console.error('Error duplicating document files in S3:', error)
      throw error
    }
  }

  /**
   * Update media JSON to point S3 keys to new project and media IDs
   * @param {Object} mediaJson - Media JSON to update (modified in place)
   * @param {number} oldProjectId - Original project ID
   * @param {number} newProjectId - New project ID
   * @param {number} oldMediaId - Original media ID
   * @param {number} newMediaId - New media ID
   */
  updateMediaJsonS3Keys(mediaJson, oldProjectId, newProjectId, oldMediaId, newMediaId) {
    let updatedCount = 0
    
    // Handle both uppercase S3_KEY and lowercase s3_key in variants
    const variants = ['original', 'large', 'thumbnail', 'medium', 'small']
    
    for (const variant of variants) {
      if (mediaJson[variant]) {
        const variantData = mediaJson[variant]
        
        // Handle uppercase S3_KEY
        if (variantData.S3_KEY) {
          const oldS3Key = variantData.S3_KEY
          const newS3Key = this.transformMediaS3Key(oldS3Key, oldProjectId, newProjectId, oldMediaId, newMediaId)
          variantData.S3_KEY = newS3Key
          updatedCount++
        }
        
        // Handle lowercase s3_key (this is what the database actually uses!)
        if (variantData.s3_key) {
          const oldS3Key = variantData.s3_key
          const newS3Key = this.transformMediaS3Key(oldS3Key, oldProjectId, newProjectId, oldMediaId, newMediaId)
          variantData.s3_key = newS3Key
          updatedCount++
        }
      }
    }

    // Handle direct S3_KEY/s3_key (for files without variants)
    if (mediaJson.S3_KEY) {
      const oldS3Key = mediaJson.S3_KEY
      const newS3Key = this.transformMediaS3Key(oldS3Key, oldProjectId, newProjectId, oldMediaId, newMediaId)
      mediaJson.S3_KEY = newS3Key
      updatedCount++
    }
    
    if (mediaJson.s3_key) {
      const oldS3Key = mediaJson.s3_key
      const newS3Key = this.transformMediaS3Key(oldS3Key, oldProjectId, newProjectId, oldMediaId, newMediaId)
      mediaJson.s3_key = newS3Key
      updatedCount++
    }
    
    if (updatedCount > 0) {
      console.log(`Updated ${updatedCount} S3 keys for media ${oldMediaId} -> ${newMediaId}`)
    }
  }

  /**
   * Try to copy media files from old S3 paths to new ones if they exist
   * @param {string} mediaType - Media type
   * @param {number} oldProjectId - Original project ID
   * @param {number} newProjectId - New project ID
   * @param {number} oldMediaId - Original media ID
   * @param {number} newMediaId - New media ID
   * @param {Object} mediaJson - Original media JSON data
   */
  async copyMediaFilesIfExist(mediaType, oldProjectId, newProjectId, oldMediaId, newMediaId, mediaJson) {
    // Collect all S3 keys from the original JSON
    const s3KeysToTry = []
    
    // Check variants
    const variants = ['original', 'large', 'thumbnail', 'medium', 'small']
    for (const variant of variants) {
      if (mediaJson[variant] && (mediaJson[variant].S3_KEY || mediaJson[variant].s3_key)) {
        s3KeysToTry.push({
          variant,
          oldKey: mediaJson[variant].S3_KEY || mediaJson[variant].s3_key
        })
      }
    }
    
    // Check direct keys
    if (mediaJson.S3_KEY || mediaJson.s3_key) {
      s3KeysToTry.push({
        variant: 'direct',
        oldKey: mediaJson.S3_KEY || mediaJson.s3_key
      })
    }

    let copiedCount = 0
    let skippedCount = 0

    // Try to copy each file from OLD location to NEW location
    for (const {variant, oldKey} of s3KeysToTry) {
      try {
        const newKey = this.transformMediaS3Key(oldKey, oldProjectId, newProjectId, oldMediaId, newMediaId)
        
        // Check if source file exists at OLD location and copy it to NEW location
        const exists = await s3Service.objectExists(this.bucket, oldKey)
        if (exists) {
          await this.copyS3Object(oldKey, newKey)
          this.createdKeys.push(newKey)
          copiedCount++
        } else {
          console.warn(`Source S3 file not found: ${oldKey} (${variant})`)
          skippedCount++
        }
      } catch (error) {
        console.error(`Failed to copy S3 media file for ${variant}:`, error.message)
        skippedCount++
        // Continue with other files even if one fails
      }
    }
    
    if (copiedCount > 0 || skippedCount > 0) {
      console.log(`S3 media duplication: ${copiedCount} files copied, ${skippedCount} skipped for media ${oldMediaId} -> ${newMediaId}`)
    }
  }

  /**
   * Get media folder prefix based on media type and IDs
   * @param {string} mediaType - Media type (image, video, model_3d)
   * @param {number} projectId - Project ID
   * @param {number} mediaId - Media ID
   * @returns {string} S3 folder prefix
   */
  getMediaFolderPrefix(mediaType, projectId, mediaId) {
    // Handle different media types and their S3 folder structures
    switch (mediaType.toLowerCase()) {
      case 'image':
        return `media_files/images/${projectId}/${mediaId}/`
      case 'video':
        return `media_files/videos/${projectId}/${mediaId}/`
      case 'model_3d':
        return `media_files/model_3ds/${projectId}/${mediaId}/`
      default:
        // Default to images for unknown types
        console.warn(`Unknown media type: ${mediaType}, defaulting to images`)
        return `media_files/images/${projectId}/${mediaId}/`
    }
  }

  /**
   * Transform media S3 key from old project/media ID to new ones
   * @param {string} oldS3Key - Original S3 key
   * @param {number} oldProjectId - Original project ID
   * @param {number} newProjectId - New project ID
   * @param {number} oldMediaId - Original media ID
   * @param {number} newMediaId - New media ID
   * @returns {string} New S3 key with correct IDs
   */
  transformMediaS3Key(oldS3Key, oldProjectId, newProjectId, oldMediaId, newMediaId) {
    // Extract the filename from the old key
    const oldFileName = oldS3Key.split('/').pop()
    
    // Replace old IDs with new IDs in the filename
    // Handle different naming patterns: projectId_mediaId_variant.ext
    let newFileName = oldFileName
      .replace(new RegExp(`^${oldProjectId}_${oldMediaId}_`), `${newProjectId}_${newMediaId}_`)
      .replace(new RegExp(`^${oldProjectId}_${oldMediaId}\.`), `${newProjectId}_${newMediaId}.`)
    
    // Extract media type from old S3 key path
    const pathParts = oldS3Key.split('/')
    let mediaTypeFolder = 'images' // default
    if (pathParts.length >= 2 && pathParts[1]) {
      mediaTypeFolder = pathParts[1] // e.g., 'images', 'videos', 'model_3ds'
    }
    
    // Construct new S3 key: media_files/{type}/{newProjectId}/{newMediaId}/{newFileName}
    return `media_files/${mediaTypeFolder}/${newProjectId}/${newMediaId}/${newFileName}`
  }

  /**
   * Transform document S3 key from old project/document ID to new ones
   * @param {string} oldS3Key - Original S3 key
   * @param {number} oldProjectId - Original project ID
   * @param {number} newProjectId - New project ID
   * @param {number} oldDocumentId - Original document ID
   * @param {number} newDocumentId - New document ID
   * @returns {string} New S3 key with correct IDs
   */
  transformDocumentS3Key(oldS3Key, oldProjectId, newProjectId, oldDocumentId, newDocumentId) {
    // Extract the filename from the old key
    const oldFileName = oldS3Key.split('/').pop()
    
    // Replace old IDs with new IDs in the filename
    // Handle different naming patterns: projectId_documentId_original.ext
    let newFileName = oldFileName
      .replace(new RegExp(`^${oldProjectId}_${oldDocumentId}_`), `${newProjectId}_${newDocumentId}_`)
      .replace(new RegExp(`^${oldProjectId}_${oldDocumentId}\.`), `${newProjectId}_${newDocumentId}.`)
    
    // Construct new S3 key: documents/{newProjectId}/{newDocumentId}/{newFileName}
    return `documents/${newProjectId}/${newDocumentId}/${newFileName}`
  }

  /**
   * Copy an object from one S3 key to another
   * @param {string} sourceKey - Source S3 key
   * @param {string} destinationKey - Destination S3 key
   */
  async copyS3Object(sourceKey, destinationKey) {
    try {
      await s3Service.copyObject(
        this.bucket,
        sourceKey,
        this.bucket,
        destinationKey
      )
    } catch (error) {
      console.error(`Failed to copy S3 object ${sourceKey} to ${destinationKey}:`, error)
      throw error
    }
  }

  /**
   * Clean up created S3 objects in case of error during duplication
   */
  async cleanup() {
    console.log(`Cleaning up ${this.createdKeys.length} created S3 objects...`)
    
    for (const key of this.createdKeys) {
      try {
        await s3Service.deleteObject(this.bucket, key)
        console.log(`Cleaned up S3 object: ${key}`)
      } catch (error) {
        console.error(`Failed to clean up S3 object ${key}:`, error.message)
        // Continue cleanup even if individual deletions fail
      }
    }
    
    this.createdKeys = []
  }

  /**
   * Get all created S3 keys (for tracking purposes)
   * @returns {string[]} Array of created S3 keys
   */
  getCreatedKeys() {
    return [...this.createdKeys]
  }
}
