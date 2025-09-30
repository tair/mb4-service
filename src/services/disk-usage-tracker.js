import { models } from '../models/init-models.js'

/**
 * Centralized Disk Usage Tracking Service
 * Handles disk usage updates for all file types across the system
 */
export class DiskUsageTracker {
  
  /**
   * Track file size change for a project
   * @param {number} projectId - Project ID
   * @param {number} sizeDelta - Size change in bytes (can be negative)
   * @param {Object} options - Transaction and user options
   * @returns {Promise<boolean>} Success status
   */
  static async updateProjectDiskUsage(projectId, sizeDelta, options = {}) {
    try {
      if (!projectId) {
        return true
      }

      if (sizeDelta === 0) {
        return true
      }

      const project = await models.Project.findByPk(projectId, {
        transaction: options.transaction
      })

      if (!project) {
        console.error(`DiskUsageTracker: Invalid project_id ${projectId}`)
        return false
      }

      // Calculate new disk usage (ensure it doesn't go below 0)
      const currentUsage = parseInt(project.disk_usage) || 0
      const newUsage = Math.max(0, currentUsage + sizeDelta)

      // Update project record
      await project.update(
        { disk_usage: newUsage },
        {
          transaction: options.transaction,
          user: options.user,
          shouldSkipLogChange: true // Skip changelog for disk usage updates
        }
      )

      return true

    } catch (error) {
      console.error(
        `Disk usage update failed - Project: ${projectId}, Delta: ${sizeDelta}, Error: ${error.message}`,
        error
      )
      return false
    }
  }

  /**
   * Extract file size from various JSON formats used across the system
   * For images, we calculate total size of all variants to get accurate disk usage
   * @param {Object} fileData - File data JSON object
   * @param {string} version - File version ('original', etc.) - only used for non-image files
   * @returns {number} Size in bytes
   */
  static getFileSize(fileData, version = 'original') {
    if (!fileData || typeof fileData !== 'object') {
      return 0
    }

    try {
      // For media files with multiple sizes, sum ALL variants for accurate disk usage
      const isMediaFile = fileData.original || fileData.large || fileData.medium || fileData.small || fileData.thumbnail
      
      if (isMediaFile) {
        let totalSize = 0
        const variants = ['original', 'large', 'medium', 'small', 'thumbnail', 'icon', 'preview']
        
        for (const variant of variants) {
          if (fileData[variant]) {
            // Try FILESIZE first
            if (fileData[variant].FILESIZE) {
              totalSize += parseInt(fileData[variant].FILESIZE) || 0
            }
            // Try PROPERTIES.filesize
            else if (fileData[variant].PROPERTIES && fileData[variant].PROPERTIES.filesize) {
              totalSize += parseInt(fileData[variant].PROPERTIES.filesize) || 0
            }
          }
        }
        
        return totalSize
      }
      
      // For non-media files (documents), use simpler extraction
      // Priority 1: Direct FILESIZE property (documents, etc.)
      if (fileData.FILESIZE) {
        return parseInt(fileData.FILESIZE) || 0
      }
      
      // Priority 2: PROPERTIES.filesize at root level
      if (fileData.PROPERTIES && fileData.PROPERTIES.filesize) {
        return parseInt(fileData.PROPERTIES.filesize) || 0
      }

      // Priority 3: INPUT section (used by some legacy formats)
      if (fileData.INPUT && fileData.INPUT.FILESIZE) {
        return parseInt(fileData.INPUT.FILESIZE) || 0
      }

      // Priority 4: S3_KEY based data (for documents - lowercase keys)
      if (fileData.s3_key && fileData.filesize) {
        return parseInt(fileData.filesize) || 0
      }
      
      // Priority 5: properties.filesize (documents use lowercase)
      if (fileData.properties && fileData.properties.filesize) {
        return parseInt(fileData.properties.filesize) || 0
      }

      return 0
    } catch (error) {
      console.error('Error extracting file size from:', fileData, error)
      return 0
    }
  }

  /**
   * Handle media file changes
   * @param {Object} mediaFile - MediaFile instance
   * @param {Object} options - Hook options
   * @param {boolean} isDelete - Whether this is a delete operation
   */
  static async handleMediaFileChange(mediaFile, options = {}, isDelete = false) {
    try {
      const projectId = mediaFile.project_id
      if (!projectId) {
        return
      }

      let sizeDelta = 0

      if (isDelete) {
        // For delete operations, subtract the current size
        sizeDelta = -this.getFileSize(mediaFile.media)
      } else {
        // For create/update operations, calculate the size difference
        const currentSize = this.getFileSize(mediaFile.media)
        // For updates, check if media field has changed
        if (mediaFile._previousDataValues) {
          // This is an update operation
          const previousSize = this.getFileSize(mediaFile._previousDataValues.media)
          sizeDelta = currentSize - previousSize
          
          // Special case: if previous was 0 and current > 0, this is likely the second save after upload
          // No additional logging needed for this case
        } else if (currentSize > 0) {
          // For new records, add the full size
          sizeDelta = currentSize
        } else {
          // This is likely the first save before file upload
          return
        }
      }

      if (sizeDelta !== 0) {
        await this.updateProjectDiskUsage(projectId, sizeDelta, options)
      }
    } catch (error) {
      console.error('Error handling media file change:', error)
    }
  }

  /**
   * Handle document file changes
   * @param {Object} document - ProjectDocument instance
   * @param {Object} options - Hook options
   * @param {boolean} isDelete - Whether this is a delete operation
   */
  static async handleDocumentChange(document, options = {}, isDelete = false) {
    try {
      const projectId = document.project_id
      if (!projectId) {
        return
      }

      let sizeDelta = 0

      if (isDelete) {
        sizeDelta = -this.getFileSize(document.upload)
      } else {
        const currentSize = this.getFileSize(document.upload)
        
        if (document._previousDataValues) {
          // This is an update
          const previousSize = this.getFileSize(document._previousDataValues.upload)
          sizeDelta = currentSize - previousSize
          
          // Special case: if previous was 0 and current > 0, this is likely the second save after upload
          // No additional logging needed for this case
        } else if (currentSize > 0) {
          sizeDelta = currentSize
        } else {
          return
        }
      }

      if (sizeDelta !== 0) {
        await this.updateProjectDiskUsage(projectId, sizeDelta, options)
      }
    } catch (error) {
      console.error('Error handling document change:', error)
    }
  }

  /**
   * Handle matrix file changes
   * @param {Object} matrixFile - MatrixFileUpload instance
   * @param {Object} options - Hook options
   * @param {boolean} isDelete - Whether this is a delete operation
   */
  static async handleMatrixFileChange(matrixFile, options = {}, isDelete = false) {
    try {
      // Matrix files are associated with matrices, which belong to projects
      // We need to get the project_id through the matrix relationship
      const matrix = await models.Matrix.findByPk(matrixFile.matrix_id, {
        attributes: ['project_id'],
        transaction: options.transaction
      })

      if (!matrix || !matrix.project_id) return

      let sizeDelta = 0

      if (isDelete) {
        sizeDelta = -this.getFileSize(matrixFile.upload)
      } else {
        const currentSize = this.getFileSize(matrixFile.upload)
        
        if (matrixFile.changed && matrixFile.changed('upload') && matrixFile._previousDataValues && matrixFile._previousDataValues.upload) {
          const previousSize = this.getFileSize(matrixFile._previousDataValues.upload)
          sizeDelta = currentSize - previousSize
        } else {
          sizeDelta = currentSize
        }
      }

      await this.updateProjectDiskUsage(matrix.project_id, sizeDelta, options)
    } catch (error) {
      console.error('Error handling matrix file change:', error)
    }
  }

  /**
   * Calculate total disk usage for a project from all file sources
   * @param {number} projectId - Project ID
   * @returns {Promise<number>} Total usage in bytes
   */
  static async calculateProjectDiskUsage(projectId) {
    try {
      let totalUsage = 0

      // Media files
      const mediaFiles = await models.MediaFile.findAll({
        where: { project_id: projectId },
        attributes: ['media']
      })
      for (const mediaFile of mediaFiles) {
        totalUsage += this.getFileSize(mediaFile.media)
      }

      // Project documents
      const documents = await models.ProjectDocument.findAll({
        where: { project_id: projectId },
        attributes: ['upload']
      })
      for (const document of documents) {
        totalUsage += this.getFileSize(document.upload)
      }

      // Matrix files (through matrices)
      const matrices = await models.Matrix.findAll({
        where: { project_id: projectId },
        attributes: ['matrix_id']
      })
      
      for (const matrix of matrices) {
        const matrixFiles = await models.MatrixFileUpload.findAll({
          where: { matrix_id: matrix.matrix_id },
          attributes: ['upload']
        })
        for (const matrixFile of matrixFiles) {
          totalUsage += this.getFileSize(matrixFile.upload)
        }
      }

      return totalUsage
    } catch (error) {
      console.error(`Error calculating disk usage for project ${projectId}:`, error)
      throw error
    }
  }

  /**
   * Validate and recalculate disk usage for a project
   * @param {number} projectId - Project ID
   * @returns {Promise<Object>} Validation and recalculation results
   */
  static async validateAndRecalculate(projectId) {
    try {
      const project = await models.Project.findByPk(projectId, {
        attributes: ['project_id', 'name', 'disk_usage']
      })

      if (!project) {
        throw new Error(`Project ${projectId} not found`)
      }

      const calculatedUsage = await this.calculateProjectDiskUsage(projectId)
      const storedUsage = parseInt(project.disk_usage) || 0
      const discrepancy = Math.abs(calculatedUsage - storedUsage)

      // Update if there's a discrepancy
      if (discrepancy > 0) {
        await project.update(
          { disk_usage: calculatedUsage },
          { 
            shouldSkipLogChange: true // Skip changelog for disk usage recalculations
          }
        )
      }

      return {
        project_id: projectId,
        project_name: project.name,
        old_usage: storedUsage,
        new_usage: calculatedUsage,
        discrepancy: discrepancy,
        was_updated: discrepancy > 0,
        old_mb: (storedUsage / 1048576).toFixed(2),
        new_mb: (calculatedUsage / 1048576).toFixed(2)
      }
    } catch (error) {
      console.error(`Error validating project ${projectId}:`, error)
      throw error
    }
  }

  /**
   * Recalculate disk usage for all projects
   * @returns {Promise<Array>} Array of recalculation results
   */
  static async recalculateAllProjects() {
    try {
      const projects = await models.Project.findAll({
        where: { deleted: 0 },
        attributes: ['project_id']
      })

      const results = []
      for (const project of projects) {
        try {
          const result = await this.validateAndRecalculate(project.project_id)
          results.push(result)
        } catch (error) {
          results.push({
            project_id: project.project_id,
            error: error.message
          })
        }
      }

      return results
    } catch (error) {
      console.error('Error recalculating all projects:', error)
      throw error
    }
  }
}

export default DiskUsageTracker
