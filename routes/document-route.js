import express from 'express'
import * as controller from '../controllers/document-controller.js'
import { upload } from './upload.js'

const documentRouter = express.Router({ mergeParams: true })

documentRouter.get('/', controller.getDocuments)
documentRouter.post('/create', upload.single('file'), controller.createDocument)
documentRouter.post('/delete', controller.deleteDocuments)

documentRouter.get('/:documentId', controller.getDocument)
documentRouter.post(
  '/:documentId/edit',
  upload.single('file'),
  controller.editDocument
)
documentRouter.get('/:documentId/download', controller.downloadDocument)

documentRouter.post('/folder/create', controller.createFolder)
documentRouter.post(
  '/folder/:folderId/edit',
  upload.single('file'),
  controller.editFolder
)
documentRouter.post('/folder/:folderId/delete', controller.deleteFolder)

export default documentRouter
