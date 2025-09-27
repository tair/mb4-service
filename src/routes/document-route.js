import express from 'express'
import * as controller from '../controllers/document-controller.js'
import { upload } from './upload.js'
import { requireEntityEditPermission, EntityType } from '../lib/auth-middleware.js'

const documentRouter = express.Router({ mergeParams: true })

documentRouter.get('/', controller.getDocuments)
documentRouter.post('/create', requireEntityEditPermission(EntityType.DOCUMENT), upload.single('file'), controller.createDocument)
documentRouter.post('/delete', requireEntityEditPermission(EntityType.DOCUMENT), controller.deleteDocuments)

documentRouter.get('/:documentId', controller.getDocument)
documentRouter.post(
  '/:documentId/edit',
  requireEntityEditPermission(EntityType.DOCUMENT),
  upload.single('file'),
  controller.editDocument
)
documentRouter.get('/:documentId/download', controller.downloadDocument)

documentRouter.post('/folder/create', requireEntityEditPermission(EntityType.DOCUMENT), controller.createFolder)
documentRouter.post(
  '/folder/:folderId/edit',
  requireEntityEditPermission(EntityType.DOCUMENT),
  upload.single('file'),
  controller.editFolder
)
documentRouter.post('/folder/:folderId/delete', requireEntityEditPermission(EntityType.DOCUMENT), controller.deleteFolder)

export default documentRouter
