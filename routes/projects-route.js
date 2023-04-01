import express from 'express'

import documentRouter from './document-route.js'
import characterRouter from './characters-route.js'
import matrixRouter from './matrix-route.js'
import taxaRouter from './taxa-route.js'

const projectRouter = express.Router({ mergeParams: true })

projectRouter.use('/:projectId/characters', characterRouter)
projectRouter.use('/:projectId/documents', documentRouter)
projectRouter.use('/:projectId/matrices', matrixRouter)
projectRouter.use('/:projectId/taxa', taxaRouter)

export default projectRouter
