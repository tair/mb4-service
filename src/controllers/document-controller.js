import sequelizeConn from '../util/db.js'
import { models } from '../models/init-models.js'
import { getDocumentPath, getDocumentUrl } from '../util/document.js'
import { normalizeJson } from '../util/json.js'
import { S3DocumentUploader } from '../lib/s3-document-uploader.js'
import s3Service from '../services/s3-service.js'
import config from '../config.js'

export async function getDocument(req, res) {
  const projectId = req.params.projectId
  const documentId = req.params.documentId
  const document = await models.ProjectDocument.findByPk(documentId)
  if (document == null || document.project_id != projectId) {
    res.status(404).json({ message: 'Document is not found' })
    return
  }

  res.status(200).json({ document: convertDocumentResponse(document) })
}

export async function getDocuments(req, res) {
  const projectId = req.params.projectId
  const documents = await models.ProjectDocument.findAll({
    where: { project_id: projectId },
  })
  const folders = await models.ProjectDocumentFolder.findAll({
    where: { project_id: projectId },
  })
  const data = {
    documents: documents.map(convertDocumentResponse),
    folders: folders.map(convertFolderResponse),
  }
  res.status(200).json(data)
}

export async function createDocument(req, res) {
  const projectId = req.params.projectId

  // Ensure that the supplied folder belongs to the current project.
  const folderId = parseInt(req.body.folder_id) || null
  if (folderId) {
    const folder = await models.ProjectDocumentFolder.findByPk(folderId)
    if (folder == null || folder.project_id != projectId) {
      res.status(404).json({ message: 'Folder is not found' })
      return
    }
  }

  const transaction = await sequelizeConn.transaction()
  
  try {
    // 1. First create the document record to get the document_id
    const document = await models.ProjectDocument.create({
      project_id: projectId,
      title: req.body.title,
      description: req.body.description,
      user_id: req.user.user_id,
      access: req.body.access,
      published: req.body.published,
      folder_id: folderId,
    }, {
      transaction,
      user: req.user,
    })

    // 2. If file is provided, upload to S3
    if (req.file) {
      const s3Uploader = new S3DocumentUploader(transaction, req.user)
      await s3Uploader.setDocument(document, 'upload', req.file)
      
      // 3. Save document again with S3 metadata
      await document.save({
        transaction,
        user: req.user,
      })
      
      s3Uploader.commit()
    }

    await transaction.commit()
    res.status(200).json({ document: convertDocumentResponse(document) })
    
  } catch (error) {
    await transaction.rollback()
    console.error('Error creating document:', error)
    res.status(500).json({ message: 'Failed to create document', error: error.message })
  }
}

export async function deleteDocuments(req, res) {
  const documentIds = req.body.document_ids
  
  try {
    // 1. First fetch the documents to get their S3 metadata
    const documentsToDelete = await models.ProjectDocument.findAll({
      where: {
        document_id: documentIds,
      },
    })

    // 2. Delete S3 files first and track failures
    const s3DeletionPromises = []
    const s3DeletionFailures = []
    
    for (const document of documentsToDelete) {
      const json = normalizeJson(document.upload) ?? {}
      
      // Check if this document has an S3 file (handle both uppercase and lowercase formats)
      const s3Key = json.S3_KEY || json.s3_key
      if (s3Key) {
        const deletePromise = s3Service.deleteObject(config.aws.defaultBucket, s3Key)
          .catch(error => {
            console.error(`Failed to delete S3 object ${s3Key}:`, error)
            s3DeletionFailures.push({ s3Key, error: error.message })
            // Don't fail the entire operation if S3 deletion fails
          })
        s3DeletionPromises.push(deletePromise)
      }
    }

    // Wait for all S3 deletions to complete (or fail gracefully)
    await Promise.all(s3DeletionPromises)

    // 3. Delete from database
    const transaction = await sequelizeConn.transaction()
    await models.ProjectDocument.destroy({
      where: {
        document_id: documentIds,
      },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })
    await transaction.commit()
    
    // Include S3 deletion status in response
    const response = { document_ids: documentIds }
    if (s3DeletionFailures.length > 0) {
      response.warnings = {
        message: `${s3DeletionFailures.length} file(s) could not be deleted from storage`,
        failed_s3_deletions: s3DeletionFailures
      }
    }
    
    res.status(200).json(response)
    
  } catch (error) {
    console.error('Error deleting documents:', error)
    res.status(500).json({ message: 'Failed to delete documents', error: error.message })
  }
}

export async function editDocument(req, res) {
  const projectId = req.params.projectId
  const documentId = req.params.documentId
  const document = await models.ProjectDocument.findByPk(documentId)
  if (document == null || document.project_id != projectId) {
    res.status(404).json({ message: 'Document is not found' })
    return
  }

  // Ensure that the supplied folder belongs to the current project.
  if (req.body.folder_id !== undefined) {
    const folderId = parseInt(req.body.folder_id) || null
    if (folderId) {
      const folder = await models.ProjectDocumentFolder.findByPk(folderId)
      if (folder == null || folder.project_id != projectId) {
        res.status(404).json({ message: 'Folder is not found' })
        return
      }
    }
    document.folder_id = folderId
  }

  if (req.body.title !== undefined) {
    document.title = req.body.title
  }
  if (req.body.description !== undefined) {
    document.description = req.body.description
  }
  if (req.body.access !== undefined) {
    document.access = req.body.access
  }
  if (req.body.published !== undefined) {
    document.published = req.body.published
  }

  const transaction = await sequelizeConn.transaction()
  
  try {
    // Store old S3 key for cleanup if file is being replaced
    const oldUpload = document.upload ? normalizeJson(document.upload) : null
    const oldS3Key = oldUpload?.s3_key

    // If new file is provided, upload to S3
    if (req.file) {
      const s3Uploader = new S3DocumentUploader(transaction, req.user)
      await s3Uploader.setDocument(document, 'upload', req.file)
      s3Uploader.commit()
    }

    await document.save({
      transaction,
      user: req.user,
    })
    
    await transaction.commit()

    // Clean up old S3 file after successful database update
    if (req.file && oldS3Key) {
      const newUpload = normalizeJson(document.upload)
      const newS3Key = newUpload?.s3_key
      
      // Only delete if the S3 key has actually changed
      if (oldS3Key !== newS3Key) {
        s3Service.deleteObject(config.aws.defaultBucket, oldS3Key)
          .catch(error => {
            console.error(`Failed to cleanup old S3 file ${oldS3Key}:`, error)
            // Don't fail the operation, just log the cleanup failure
          })
      }
    }
    
    res.status(200).json({ document: convertDocumentResponse(document) })
    
  } catch (error) {
    await transaction.rollback()
    console.error('Error editing document:', error)
    res.status(500).json({ message: 'Failed to edit document', error: error.message })
  }
}

export async function downloadDocument(req, res) {
  const projectId = req.params.projectId
  const documentId = req.params.documentId
  const document = await models.ProjectDocument.findByPk(documentId)
  if (document == null || document.project_id != projectId) {
    res.status(404).json({ message: 'Document is not found' })
    return
  }

  const json = normalizeJson(document.upload)
  
  // Check if this is an S3-stored document
  if (json.s3_key || json.S3_KEY) {
    // Use the S3 serving function for downloads
    return serveDocumentFile(req, res)
  }
  
  // Handle legacy local file structure
  const { volume, hash, magic, filename } = json
  if (!volume || !hash || !magic || !filename) {
    res.status(404).json({ message: 'Document does not exist' })
    return
  }

  const path = getDocumentPath(json)
  const originalFileName = json['original_filename'] ?? filename
  res.status(200).download(path, originalFileName)
}

export async function createFolder(req, res) {
  const projectId = req.params.projectId
  if (!req.body.title) {
    res.status(400).json({ message: 'Title cannot be empty' })
    return
  }

  const transaction = await sequelizeConn.transaction()
  const folder = await models.ProjectDocumentFolder.create(
    {
      title: req.body.title,
      description: req.body.description || '',
      access: req.body.access || 0,
      user_id: req.user.user_id,
      project_id: projectId,
    },
    {
      transaction: transaction,
      user: req.user,
    }
  )
  await transaction.commit()
  res.status(200).json(convertFolderResponse(folder))
}

export async function editFolder(req, res) {
  const projectId = req.params.projectId
  const folderId = req.params.folderId
  const folder = await models.ProjectDocumentFolder.findByPk(folderId)
  if (folder == null || folder.project_id != projectId) {
    res.status(404).json({ message: 'Folder is not found' })
    return
  }

  if (req.body.title !== undefined) {
    folder.title = req.body.title
  }
  if (req.body.description !== undefined) {
    folder.description = req.body.description
  }
  if (req.body.access !== undefined) {
    folder.access = req.body.access
  }

  const transaction = await sequelizeConn.transaction()
  await folder.save({
    transaction,
    user: req.user,
  })
  await transaction.commit()
  res.status(200).json({ folder_id: folder.folder_id })
}

export async function deleteFolder(req, res) {
  const projectId = req.params.projectId
  const folderId = req.params.folderId
  const folder = await models.ProjectDocumentFolder.findByPk(folderId)
  if (folder == null || folder.project_id != projectId) {
    res.status(404).json({ message: 'Folder is not found' })
    return
  }

  try {
    // 1. First fetch all documents in the folder to get their S3 metadata
    const documentsInFolder = await models.ProjectDocument.findAll({
      where: {
        folder_id: folderId,
      },
    })

    // 2. Delete S3 files for all documents in the folder and track failures
    const s3DeletionPromises = []
    const s3DeletionFailures = []
    
    for (const document of documentsInFolder) {
      const json = normalizeJson(document.upload) ?? {}
      
      // Check if this document has an S3 file (handle both uppercase and lowercase formats)
      const s3Key = json.S3_KEY || json.s3_key
      if (s3Key) {
        const deletePromise = s3Service.deleteObject(config.aws.defaultBucket, s3Key)
          .catch(error => {
            console.error(`Failed to delete S3 object ${s3Key}:`, error)
            s3DeletionFailures.push({ s3Key, error: error.message })
            // Don't fail the entire operation if S3 deletion fails
          })
        s3DeletionPromises.push(deletePromise)
      }
    }

    // Wait for all S3 deletions to complete (or fail gracefully)
    await Promise.all(s3DeletionPromises)

    // 3. Delete documents and folder from database
    const transaction = await sequelizeConn.transaction()
    await models.ProjectDocument.destroy({
      where: {
        folder_id: folderId,
      },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })
    await models.ProjectDocumentFolder.destroy({
      where: {
        folder_id: folderId,
      },
      transaction: transaction,
      individualHooks: true,
      user: req.user,
    })
    await transaction.commit()
    
    // Include S3 deletion status in response
    const response = { folder_id: folderId }
    if (s3DeletionFailures.length > 0) {
      response.warnings = {
        message: `${s3DeletionFailures.length} file(s) could not be deleted from storage`,
        failed_s3_deletions: s3DeletionFailures
      }
    }
    
    res.status(200).json(response)
    
  } catch (error) {
    console.error('Error deleting folder:', error)
    res.status(500).json({ message: 'Failed to delete folder', error: error.message })
  }
}

function convertDocumentResponse(document) {
  const json = normalizeJson(document.upload) ?? {}
  
  // Handle both legacy local file format and S3 format (both use lowercase)
  const originalFileName = json.original_filename || json['original_filename']
  const properties = json.properties || json['properties'] || {}
  const filesize = json.filesize || json['filesize'] || properties['filesize']
  const mimeType = json.mimetype || json['mimetype'] || properties['mimetype']
  
  const data = {
    document_id: document.document_id,
    folder_id: document.folder_id,
    access: document.access,
    published: document.published,
    uploaded_on: document.uploaded_on,
    title: document.title,
    description: document.description,
    file_name: originalFileName,
    mime_type: mimeType,
    size: filesize,
    download_url: getDocumentUrl(json, document.project_id, document.document_id),
  }
  return data
}

function convertFolderResponse(folder) {
  return {
    folder_id: folder.folder_id,
    title: folder.title,
    description: folder.description,
    access: folder.access,
  }
}

/**
 * Serve a document file from S3
 * GET /public/documents/:projectId/serve/:documentId
 */
export async function serveDocumentFile(req, res) {
  const { projectId, documentId } = req.params
  
  try {
    // Get document info from database
    const document = await models.ProjectDocument.findOne({
      where: {
        document_id: documentId,
        project_id: projectId
      }
    })

    if (!document) {
      return res.status(404).json({
        error: 'Document not found',
        message: 'The requested document does not exist',
      })
    }

    const json = normalizeJson(document.upload) ?? {}
    // Handle both legacy local file format and S3 format (both use lowercase)
    const originalFileName = json.original_filename || json['original_filename']
    
    if (!originalFileName) {
      return res.status(404).json({
        error: 'Invalid document data',
        message: 'Document data is missing file information',
      })
    }

    // Check if there's an explicit S3 key stored in the database
    let s3Key = json.s3_key || json['s3_key'] || json.S3_KEY

    // If no explicit S3 key, construct it based on the expected structure
    if (!s3Key) {
      // Extract file extension from original filename
      const fileExtension = originalFileName.split('.').pop() || 'bin'
      
      // Construct S3 key based on the expected structure
      // Format: documents/{projectId}/{documentId}/{projectId}_{documentId}_original.{extension}
      const fileName = `${projectId}_${documentId}_original.${fileExtension}`
      s3Key = `documents/${projectId}/${documentId}/${fileName}`
    }

    // Use default bucket from config
    const bucket = config.aws.defaultBucket

    if (!bucket) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Default S3 bucket not configured',
      })
    }

    // Get object from S3
    const result = await s3Service.getObject(bucket, s3Key)

    // Encode filename for Content-Disposition header (RFC 5987)
    // This handles filenames with non-ASCII characters
    const encodedFilename = encodeURIComponent(originalFileName)
    const contentDisposition = `inline; filename="${originalFileName.replace(/[^\x00-\x7F]/g, '_')}"; filename*=UTF-8''${encodedFilename}`

    // Set appropriate headers
    res.set({
      'Content-Type': result.contentType || 'application/octet-stream',
      'Content-Length': result.contentLength,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Last-Modified': result.lastModified,
      'Content-Disposition': contentDisposition,
    })

    // Send the data
    res.send(result.data)
  } catch (error) {
    console.error('Document serve error:', error.message)

    if (error.name === 'NoSuchKey' || error.message.includes('NoSuchKey') || error.message.includes('Object not found')) {
      return res.status(404).json({
        error: 'File not found',
        message: 'The requested document file does not exist in S3',
      })
    }

    if (error.name === 'NoSuchBucket') {
      return res.status(404).json({
        error: 'Bucket not found',
        message: 'The specified bucket does not exist',
      })
    }

    if (error.name === 'AccessDenied' || error.message.includes('AccessDenied')) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient permissions to access the requested file',
      })
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to serve document file',
    })
  }
}
