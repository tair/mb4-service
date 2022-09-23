import express from 'express';
import * as matrixController from '../controllers/matrix-controller.js';
import * as matrixEditorController from '../controllers/matrix-editor-controller.js';

const matrixRouter = express.Router({ mergeParams: true })

matrixRouter.get('/', matrixController.getMatrices)

matrixRouter.get('/:matrixId/getMatrixData', matrixEditorController.getMatrixData)

export default matrixRouter;