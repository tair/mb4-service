import express from 'express'
import multer from 'multer'

import bibliographyRouter from './bibliography-route.js'
import characterRouter from './characters-route.js'
import documentRouter from './document-route.js'
import eolRouter from './eol-route.js'
import foliosRouter from './folios-route.js'
import iDigBioRouter from './idigbio-route.js'
import institutionRouter from './institution-route.js'
import matrixRouter from './matrix-route.js'
import mediaRouter from './media-route.js'
import mediaViewsRouter from './media-views-route.js'
import projectMemberGroupsRouter from './project-member-groups-route.js'
import projectUsersRouter from './project-users-route.js'
import specimensRouter from './specimens-route.js'
import taxaRouter from './taxa-route.js'
import * as controller from '../controllers/project-controller.js'
import {
  authenticateToken,
  maybeAuthenticateToken,
} from './auth-interceptor.js'
import { authorizeProject } from './project-interceptor.js'
import { authorizeUser } from './user-interceptor.js'

// Configure multer for handling form data
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, '/tmp/') // Use temp directory
    },
    filename: (req, file, cb) => {
      // Generate unique filename
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
      cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname)
    },
  }),
  limits: {
    fileSize: 9 * 1024 * 1024, // 9MB limit
  },
})

// This route focuses on /projects
const projectsRouter = express.Router({ mergeParams: true })
projectsRouter.use(authenticateToken)
projectsRouter.use(authorizeUser)

projectsRouter.get('/', controller.getProjects)

// Add a new route for retrieving curator projects
projectsRouter.get('/curator-projects', controller.getCuratorProjects)

// Add a new route for retrieving journals
projectsRouter.get('/journals', controller.getJournalList)

// Add a new route for retrieving journal cover
projectsRouter.get('/journal-cover', controller.getJournalCover)

// Overview endpoint with optional authentication (must be before /:projectId middleware)
projectsRouter.get(
  '/:projectId/overview',
  maybeAuthenticateToken,
  controller.getOverview
)

// Project creation and DOI retrieval routes
projectsRouter.post(
  '/create',
  upload.single('journal_cover'),
  controller.createProject
)
projectsRouter.post('/doi', controller.retrieveDOI)

// This is a sub-route focused on /projects/<ID>
const projectRouter = express.Router({ mergeParams: true })
projectsRouter.use('/:projectId/', projectRouter)

projectRouter.use(authorizeProject)

projectRouter.use('/bibliography', bibliographyRouter)
projectRouter.use('/characters', characterRouter)
projectRouter.use('/documents', documentRouter)
projectRouter.use('/eol', eolRouter)
projectRouter.use('/folios', foliosRouter)
projectRouter.use('/groups', projectMemberGroupsRouter)
projectRouter.use('/idigbio', iDigBioRouter)
projectRouter.use('/institutions', institutionRouter)
projectRouter.use('/matrices', matrixRouter)
projectRouter.use('/media', mediaRouter)
projectRouter.use('/specimens', specimensRouter)
projectRouter.use('/taxa', taxaRouter)
projectRouter.use('/users', projectUsersRouter)
projectRouter.use('/views', mediaViewsRouter)

projectRouter.get('/overview', controller.getOverview)
projectRouter.get(
  '/duplication/request',
  controller.getDuplicationRequestCriteria
)
projectRouter.get('/publish/partition', controller.getProjectPartitions)
projectRouter.get(
  '/publish/partition/:partitionId',
  controller.getPartitionSummary
)

projectRouter.post('/copyright', controller.setCopyright)
projectRouter.put('/update', controller.updateProject)
projectRouter.post('/duplication/request', controller.createDuplicationRequest)
projectRouter.post(
  '/publish/partition/:partitionId',
  controller.publishPartition
)

export default projectsRouter
