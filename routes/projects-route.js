import express from 'express'

import documentRouter from './document-route.js'
import characterRouter from './characters-route.js'
import matrixRouter from './matrix-route.js'
import taxaRouter from './taxa-route.js'
import { authenticateToken } from '../controllers/auth-controller.js'

const projectRouter = express.Router({ mergeParams: true })

projectRouter.use('/:projectId/characters', authenticateToken, characterRouter)
projectRouter.use('/:projectId/documents', documentRouter)
projectRouter.use('/:projectId/matrices', authenticateToken, matrixRouter)
projectRouter.use('/:projectId/taxa', authenticateToken, taxaRouter)

export default projectRouter
