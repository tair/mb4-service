import express from 'express'
import multer from 'multer'

import bibliographyRouter from './bibliography-route.js'
import characterRouter from './characters-route.js'
import documentRouter from './document-route.js'
import eolRouter from './eol-route.js'
import foliosRouter from './folios-route.js'
import iDigBioRouter from './idigbio-route.js'
import institutionRouter from './institution-route.js'
import pbdbRouter from './pbdb-route.js'
import matrixRouter from './matrix-route.js'
import mediaRouter from './media-route.js'
import mediaViewsRouter from './media-views-route.js'
import projectMemberGroupsRouter from './project-member-groups-route.js'
import projectUsersRouter from './project-users-route.js'
import specimensRouter from './specimens-route.js'
import taxaRouter from './taxa-route.js'
import * as controller from '../controllers/project-controller.js'
import * as publishingController from '../controllers/publishing-controller.js'
import * as dataDumpController from '../controllers/datadump-controller.js'
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

// Routes that don't require authentication (must be before authenticateToken middleware)
// Overview endpoint with optional authentication
projectsRouter.get(
  '/:projectId/overview',
  maybeAuthenticateToken,
  authorizeUser,
  controller.getOverview
)

// SDD download endpoint with optional authentication
projectsRouter.get(
  '/:projectId/download/sdd',
  maybeAuthenticateToken,
  authorizeUser,
  controller.downloadProjectSDD
)

// Apply authentication to all other routes
projectsRouter.use(authenticateToken)
projectsRouter.use(authorizeUser)

projectsRouter.get('/', controller.getProjects)

// Refresh project statistics endpoint (requires authentication and project access)
projectsRouter.post(
  '/:projectId/refresh-stats',
  authorizeProject,
  controller.refreshProjectStats
)

// Add a new route for retrieving curator projects
projectsRouter.get('/curator-projects', controller.getCuratorProjects)

// Add a new route for retrieving journals
projectsRouter.get('/journals', controller.getJournalList)

// Add a new route for retrieving journal cover
projectsRouter.get('/journal-cover', controller.getJournalCover)

// Project creation and DOI retrieval routes
projectsRouter.post(
  '/create',
  upload.fields([
    { name: 'journal_cover', maxCount: 1 },
    { name: 'exemplar_media', maxCount: 1 },
  ]),
  controller.createProject
)
projectsRouter.post('/doi', controller.retrieveDOI)

// Add edit route with file upload support before sub-router
projectsRouter.post(
  '/:projectId/edit',
  upload.fields([
    { name: 'journal_cover', maxCount: 1 },
    { name: 'exemplar_media', maxCount: 1 },
  ]),
  controller.editProject
)
projectsRouter.delete('/:projectId', controller.deleteProject)

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
projectRouter.use('/pbdb', pbdbRouter)
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
projectRouter.get('/publish/partitions', controller.getProjectPartitions)
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

// Publishing routes
projectRouter.get(
  '/publishing/preferences',
  publishingController.getPublishingPreferences
)
projectRouter.post(
  '/publishing/preferences',
  publishingController.savePublishingPreferences
)
projectRouter.get(
  '/publishing/validate/citation',
  publishingController.validateCitationInfo
)
projectRouter.get(
  '/publishing/validate/media',
  publishingController.validateMediaForPublishing
)
projectRouter.get(
  '/publishing/unpublished-items',
  publishingController.getUnpublishedItems
)
projectRouter.post('/publishing/publish', publishingController.publishProject)
projectRouter.post('/publishing/dump', publishingController.dumpProjectById)

// SDD export to S3 route (synchronous - may timeout for large projects)
projectRouter.post('/export/sdd', dataDumpController.exportProjectSDDToS3)

// SDD export as background task (recommended for large projects)
projectRouter.post('/export/sdd/async', dataDumpController.queueSDDExportTask)

// Bulk SDD export for all published projects (admin-only, no auth required for local use)
projectRouter.post(
  '/export/sdd/bulk',
  dataDumpController.queueBulkSDDExportTask
)

export default projectsRouter
