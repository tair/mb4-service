import express from 'express';
import matrixEditorRouter from './matrix-editor-route.js';
import * as matrixController from '../controllers/matrix-controller.js';

const matrixRouter = express.Router({ mergeParams: true })

matrixRouter.use('/:matrixId/edit', matrixEditorRouter)

matrixRouter.get('/', matrixController.getMatrices)

export default matrixRouter;