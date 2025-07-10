import express from 'express'
import matrixEditorRouter from './matrix-editor-route.js'
import * as controller from '../controllers/matrix-controller.js'
import { upload } from './upload.js'

const matrixRouter = express.Router({ mergeParams: true })

matrixRouter.use('/:matrixId/edit', matrixEditorRouter)

matrixRouter.get('/', controller.getMatrices)
matrixRouter.get('/:matrixId(\\d+)', controller.getMatrix)
matrixRouter.get(
  '/:matrixId(\\d+)/can-delete',
  controller.checkDeletePermission
)
matrixRouter.put('/:matrixId(\\d+)', controller.updateMatrix)
matrixRouter.delete('/:matrixId(\\d+)', controller.deleteMatrix)
matrixRouter.get('/:matrixId/download', controller.download)
matrixRouter.get(
  '/:matrixId/download/characters',
  controller.downloadCharacters
)
matrixRouter.get(
  '/:matrixId/download/ontology',
  controller.downloadCharacterRules
)

matrixRouter.post('/upload', upload.single('file'), controller.uploadMatrix)
matrixRouter.post('/create', controller.createMatrix)
matrixRouter.post(
  '/:matrixId/upload',
  upload.single('matrix_file'),
  controller.mergeMatrixFile
)
matrixRouter.post('/:matrixId/setPreference', controller.setPreference)

export default matrixRouter
