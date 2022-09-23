import express from 'express';
import matrixRouter from './matrix-route.js';
import {authenticateToken} from '../controllers/auth-controller.js';

const projectRouter = express.Router()

projectRouter.use('/:projectId/matrix', matrixRouter)

export default projectRouter;