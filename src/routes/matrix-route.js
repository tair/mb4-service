import express from 'express'
import matrixEditorRouter from './matrix-editor-route.js'
import * as controller from '../controllers/matrix-controller.js'
import { upload } from './upload.js'
import { requireEntityEditPermission, EntityType } from '../lib/auth-middleware.js'

const matrixRouter = express.Router({ mergeParams: true })

matrixRouter.use('/:matrixId/edit', matrixEditorRouter)

matrixRouter.get('/', controller.getMatrices)
matrixRouter.get('/:matrixId(\\d+)', controller.getMatrix)
matrixRouter.get(
  '/:matrixId(\\d+)/can-delete',
  controller.checkDeletePermission
)
matrixRouter.put('/:matrixId(\\d+)', requireEntityEditPermission(EntityType.MATRIX), controller.updateMatrix)
matrixRouter.delete('/:matrixId(\\d+)', requireEntityEditPermission(EntityType.MATRIX), controller.deleteMatrix)
matrixRouter.get('/:matrixId/download', controller.download)
matrixRouter.get(
  '/:matrixId/download/characters',
  controller.downloadCharacters
)
matrixRouter.get(
  '/:matrixId/download/ontology',
  controller.downloadCharacterRules
)

matrixRouter.post('/upload', requireEntityEditPermission(EntityType.MATRIX), upload.single('file'), controller.uploadMatrix)
matrixRouter.post('/create', requireEntityEditPermission(EntityType.MATRIX), controller.createMatrix)
matrixRouter.post(
  '/:matrixId/upload',
  requireEntityEditPermission(EntityType.MATRIX),
  upload.single('matrix_file'),
  controller.mergeMatrixFile
)
matrixRouter.post('/:matrixId/setPreference', requireEntityEditPermission(EntityType.MATRIX), controller.setPreference)
matrixRouter.post('/:matrixId/run', requireEntityEditPermission(EntityType.MATRIX), controller.run)
matrixRouter.post('/:matrixId/deleteJob', requireEntityEditPermission(EntityType.MATRIX), controller.deleteJob)

export default matrixRouter
