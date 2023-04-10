import express from 'express'

import documentRouter from './document-route.js'
import characterRouter from './characters-route.js'
import matrixRouter from './matrix-route.js'
import taxaRouter from './taxa-route.js'
import matrixEditorRouter from './matrix-editor-route.js'
import matrixRouter from './matrix-route.js'
import { authenticateToken, maybeAuthenticateToken } from '../controllers/auth-controller.js'

const projectRouter = express.Router({ mergeParams: true })

projectRouter.use('/:projectId/characters', authenticateToken, characterRouter)
projectRouter.use('/:projectId/documents', authenticateToken, documentRouter)
projectRouter.use('/:projectId/matrices/:matrixId/edit', maybeAuthenticateToken, matrixEditorRouter)
projectRouter.use('/:projectId/matrices', authenticateToken, matrixRouter)
projectRouter.use('/:projectId/taxa', authenticateToken, taxaRouter)

export default projectRouter
