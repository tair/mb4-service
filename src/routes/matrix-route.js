import express from 'express'
import matrixEditorRouter from './matrix-editor-route.js'
import * as controller from '../controllers/matrix-controller.js'
import { upload } from './upload.js'

const matrixRouter = express.Router({ mergeParams: true })

matrixRouter.use('/:matrixId/edit', matrixEditorRouter)

matrixRouter.get('/', controller.getMatrices)
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
matrixRouter.post('/:matrixId/setPreference', controller.setPreference)
matrixRouter.post('/:matrixId/run', controller.run)

export default matrixRouter
