import DiskUsageTracker from '../services/disk-usage-tracker.js'

/**
 * Install disk usage tracking hooks on all relevant models
 * This should be called after models are initialized
 */
export function installDiskUsageHooks(models) {
  
  // Media Files
  models.MediaFile.addHook('afterCreate', 'diskUsageTracker', async (mediaFile, options) => {
    await DiskUsageTracker.handleMediaFileChange(mediaFile, options, false)
  })

  // Capture previous values before update
  models.MediaFile.addHook('beforeUpdate', 'diskUsageTrackerBeforeUpdate', async (mediaFile, options) => {
    // Store the old media value for comparison in afterUpdate
    const oldMediaFile = await models.MediaFile.findByPk(mediaFile.media_id, {
      attributes: ['media'],
      transaction: options.transaction,
      raw: true
    })
    if (oldMediaFile) {
      options._diskUsageOldMedia = oldMediaFile.media
    }
  })

  models.MediaFile.addHook('afterUpdate', 'diskUsageTracker', async (mediaFile, options) => {
    // Use the captured old media value if available
    if (options._diskUsageOldMedia !== undefined) {
      const oldSize = DiskUsageTracker.getFileSize(options._diskUsageOldMedia)
      const newSize = DiskUsageTracker.getFileSize(mediaFile.media)
      const sizeDelta = newSize - oldSize
      
      
      if (sizeDelta !== 0) {
        await DiskUsageTracker.updateProjectDiskUsage(mediaFile.project_id, sizeDelta, options)
      }
    } else {
      // Fallback to the original method
      await DiskUsageTracker.handleMediaFileChange(mediaFile, options, false)
    }
  })

  // Capture file data before deletion
  models.MediaFile.addHook('beforeDestroy', 'diskUsageTrackerCapture', async (mediaFile, options) => {
    // Store the media data and project_id for use in afterDestroy
    options._diskUsageData = {
      media: mediaFile.media,
      project_id: mediaFile.project_id,
      media_id: mediaFile.media_id
    }
  })

  models.MediaFile.addHook('afterDestroy', 'diskUsageTracker', async (mediaFile, options) => {
    // Use captured data from beforeDestroy hook
    if (options._diskUsageData) {
      const capturedData = options._diskUsageData
      const sizeDelta = -DiskUsageTracker.getFileSize(capturedData.media)
      
      if (sizeDelta !== 0) {
        await DiskUsageTracker.updateProjectDiskUsage(capturedData.project_id, sizeDelta, options)
        
        // Optionally recalculate to ensure accuracy after deletion
        // Note: Disabled automatic recalculation to avoid changelog issues
        // Manual recalculation can be run via CLI if needed
        // setTimeout(async () => {
        //   try {
        //     await DiskUsageTracker.validateAndRecalculate(capturedData.project_id)
        //     console.log(`DiskUsageTracker: Recalculated project ${capturedData.project_id} after file deletion`)
        //   } catch (error) {
        //     console.error('Error recalculating after deletion:', error)
        //   }
        // }, 1000) // Delay to ensure transaction is committed
      }
    }
  })

  // Project Documents
  models.ProjectDocument.addHook('afterCreate', 'diskUsageTracker', async (document, options) => {
    await DiskUsageTracker.handleDocumentChange(document, options, false)
  })

  // Capture previous values before update for documents
  models.ProjectDocument.addHook('beforeUpdate', 'diskUsageTrackerBeforeUpdate', async (document, options) => {
    const oldDocument = await models.ProjectDocument.findByPk(document.document_id, {
      attributes: ['upload'],
      transaction: options.transaction,
      raw: true
    })
    if (oldDocument) {
      options._diskUsageOldUpload = oldDocument.upload
    }
  })

  models.ProjectDocument.addHook('afterUpdate', 'diskUsageTracker', async (document, options) => {
    // Use the captured old upload value if available
    if (options._diskUsageOldUpload !== undefined) {
      const oldSize = DiskUsageTracker.getFileSize(options._diskUsageOldUpload)
      const newSize = DiskUsageTracker.getFileSize(document.upload)
      const sizeDelta = newSize - oldSize
      
      
      if (sizeDelta !== 0) {
        await DiskUsageTracker.updateProjectDiskUsage(document.project_id, sizeDelta, options)
      }
    } else {
      // Fallback to the original method
      await DiskUsageTracker.handleDocumentChange(document, options, false)
    }
  })

  models.ProjectDocument.addHook('beforeDestroy', 'diskUsageTrackerCapture', async (document, options) => {
    options._diskUsageData = {
      upload: document.upload,
      project_id: document.project_id,
      document_id: document.document_id
    }
  })

  models.ProjectDocument.addHook('afterDestroy', 'diskUsageTracker', async (document, options) => {
    if (options._diskUsageData) {
      const capturedData = options._diskUsageData
      const sizeDelta = -DiskUsageTracker.getFileSize(capturedData.upload)
      
      if (sizeDelta !== 0) {
        await DiskUsageTracker.updateProjectDiskUsage(capturedData.project_id, sizeDelta, options)
      }
    }
  })

  // Matrix File Uploads
  models.MatrixFileUpload.addHook('afterCreate', 'diskUsageTracker', async (matrixFile, options) => {
    await DiskUsageTracker.handleMatrixFileChange(matrixFile, options, false)
  })

  models.MatrixFileUpload.addHook('afterUpdate', 'diskUsageTracker', async (matrixFile, options) => {
    await DiskUsageTracker.handleMatrixFileChange(matrixFile, options, false)
  })

  models.MatrixFileUpload.addHook('beforeDestroy', 'diskUsageTrackerCapture', async (matrixFile, options) => {
    // Need to get project_id through matrix relationship
    const matrix = await models.Matrix.findByPk(matrixFile.matrix_id, {
      attributes: ['project_id'],
      transaction: options.transaction
    })
    
    options._diskUsageData = {
      upload: matrixFile.upload,
      project_id: matrix ? matrix.project_id : null,
      upload_id: matrixFile.upload_id
    }
  })

  models.MatrixFileUpload.addHook('afterDestroy', 'diskUsageTracker', async (matrixFile, options) => {
    if (options._diskUsageData && options._diskUsageData.project_id) {
      const capturedData = options._diskUsageData
      const sizeDelta = -DiskUsageTracker.getFileSize(capturedData.upload)
      
      if (sizeDelta !== 0) {
        await DiskUsageTracker.updateProjectDiskUsage(capturedData.project_id, sizeDelta, options)
      }
    }
  })

}

export default installDiskUsageHooks
