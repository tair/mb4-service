import * as documentService from '../services/document-service.js'
import config from '../config.js'
import { models } from '../models/init-models.js'
import { normalizeJson } from '../util/json.js'

export async function getDocument(req, res) {
  const projectId = req.params.projectId
  const documentId = req.params.documentId
  const document = await models.ProjectDocument.findByPk(documentId)
  if (document == null || document.project_id != projectId) {
    res.status(404).json({ message: 'Document is not found' })
    return
  }

  const json = normalizeJson(document.upload)
  const originalFileName = json['original_filename']
  const mimeType = json['mimetype'] || json['properties']['mimetype']
  const filesize = json['properties']['filesize']
  const data = {
    document_id: document.document_id,
    folder_id: document.folder_id,
    access: document.access,
    publish: document.publish,
    uploaded_on: document.uploaded_on,
    title: document.title,
    description: document.description,
    file_name: originalFileName,
    mime_type: mimeType,
    size: filesize,
  }
  res.status(200).json(data)
}

export async function getDocuments(req, res) {
  const projectId = req.params.projectId
  const documents = await documentService.getDocuments(projectId)
  const folders = await documentService.getDocumentFolders(projectId)
  const data = {
    documents,
    folders,
  }
  res.status(200).json(data)
}

export async function createDocument(req, res) {
  const projectId = req.params.projectId

  // Ensure that the supplied folder belongs to the current project.
  const folderId = req.body.folder_id ?? null
  if (folderId) {
    const folder = await models.ProjectDocumentFolder.findByPk(folderId)
    if (folder == null || folder.project_id != projectId) {
      res.status(404).json({ message: 'Folder is not found' })
      return
    }
  }

  const document = models.ProjectDocument.build({
    project_id: projectId,
    title: req.body.title,
    description: req.body.description,
    user_id: req.user.user_id,
    access: req.body.access,
    published: req.body.published,
    folder_id: folderId,
  })

  const transaction = await sequelizeConn.transaction()

  if (req.file) {
    const fileUploader = new FileUploader(transaction, req.user)
    await fileUploader.setFile(document, 'upload', req.file)
  }

  await document.save({
    transaction,
    user: req.user,
  })
  await transaction.commit()
  res.status(200).json({ document_id: documentId })
}

export async function deleteDocuments(req, res) {
  const documentIds = req.body.documentIds
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
  res.status(200).json({ document_ids: documentIds })
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
    const folder = await models.ProjectDocumentFolder.findByPk(
      req.body.folder_id
    )
    if (folder == null || folder.project_id != projectId) {
      res.status(404).json({ message: 'Folder is not found' })
      return
    }

    document.folder_id = req.body.folder_id
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

  if (req.file) {
    const fileUploader = new FileUploader(transaction, req.user)
    await fileUploader.setFile(document, 'upload', req.file)
  }

  await document.save({
    transaction,
    user: req.user,
  })
  await transaction.commit()
  res.status(200).json({ document_id: documentId })
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
  const { volume, hash, magic, filename } = json
  if (!volume || !hash || !magic || !filename) {
    res
      .status(404)
      .json({ message: 'Document does not exist' })
    return
  }

  const basePath = `${config.media.directory}/${config.app.name}/${volume}`
  const path = `${basePath}/${hash}/${magic}_${filename}`
  const originalFileName = json['original_filename'] ?? filename
  res.status(200).download(path, originalFileName)
}

export async function createFolder(req, res) {
  const projectId = req.params.projectId
  const transaction = await sequelizeConn.transaction()
  const folder = await models.ProjectDocumentFolder.create(
    {
      title: req.body.title,
      description: req.body.title,
      access: req.body.access,
      user_id: req.user.user_id,
      project_id: projectId,
    },
    {
      transaction: transaction,
      user: req.user,
    }
  )
  await transaction.commit()
  res.status(200).json({ folder_id: folder.folder_id })
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
  await folder.save({
    transaction,
    user: req.user,
  })
  await transaction.commit()
  res.status(200).json({ folder_id: folder.folder_id })
}

export async function deleteFolder(req, res) {
  const folderId = req.params.folderId
  const folder = await models.ProjectDocumentFolder.findByPk(folderId)
  if (folder == null || folder.project_id != projectId) {
    res.status(404).json({ message: 'Folder is not found' })
    return
  }

  await models.ProjectDocument.destroy({
    where: {
      folder_id: folderId,
    },
    transaction: transaction,
    individualHooks: true,
    user: req.user,
  })
  await transaction.commit()
  res.status(200).json({ document_ids: documentIds })
}
