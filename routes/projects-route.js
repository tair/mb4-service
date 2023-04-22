import express from 'express'

import characterRouter from './characters-route.js'
import documentRouter from './document-route.js'
import matrixRouter from './matrix-route.js'
import taxaRouter from './taxa-route.js'
import * as controller from '../controllers/project-controller.js'
import { authenticateToken } from './auth-interceptor.js'
import { authorizeProject } from './project-interceptor.js'

// This route focuses on /projects
const projectsRouter = express.Router({ mergeParams: true })
projectsRouter.use(authenticateToken)


// This is a sub-route focused on /projects/<ID>
const projectRouter = express.Router({ mergeParams: true })
projectsRouter.use('/:projectId/', projectRouter)

projectRouter.use(authorizeProject)

projectRouter.use('/characters', characterRouter)
projectRouter.use('/documents', documentRouter)
projectRouter.use('/matrices', matrixRouter)
projectRouter.use('/taxa', taxaRouter)

projectRouter.post('/copyright', controller.setCopyright)

export default projectsRouter
