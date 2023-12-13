import express from 'express'

import bibliographyRouter from './bibliography-route.js'
import characterRouter from './characters-route.js'
import documentRouter from './document-route.js'
import matrixRouter from './matrix-route.js'
import projectUsersRouter from './project-users-route.js'
import specimensRouter from './specimens-route.js'
import taxaRouter from './taxa-route.js'
import mediaViewsRouter from './media-views-route.js'
import * as controller from '../controllers/project-controller.js'
import { authenticateToken } from './auth-interceptor.js'
import { authorizeProject } from './project-interceptor.js'
import { authorizeUser } from './user-interceptor.js'

// This route focuses on /projects
const projectsRouter = express.Router({ mergeParams: true })
projectsRouter.use(authenticateToken)
projectsRouter.use(authorizeUser)

projectsRouter.get('/', controller.getProjects)

// This is a sub-route focused on /projects/<ID>
const projectRouter = express.Router({ mergeParams: true })
projectsRouter.use('/:projectId/', projectRouter)

projectRouter.use(authorizeProject)

projectRouter.use('/bibliography', bibliographyRouter)
projectRouter.use('/characters', characterRouter)
projectRouter.use('/documents', documentRouter)
projectRouter.use('/matrices', matrixRouter)
projectRouter.use('/specimens', specimensRouter)
projectRouter.use('/taxa', taxaRouter)
projectRouter.use('/users', projectUsersRouter)
projectRouter.use('/views', mediaViewsRouter)

projectRouter.get('/overview', controller.getOverview)

projectRouter.post('/copyright', controller.setCopyright)

export default projectsRouter
