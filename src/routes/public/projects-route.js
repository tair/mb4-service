import express from 'express'
import * as projectsController from '../../controllers/published-projects-controller.js'
import * as mediaController from '../../controllers/media-controller.js'
import * as dataDumpController from '../../controllers/datadump-controller.js'
import * as matrixController from '../../controllers/matrix-controller.js'
import { getPublishedFolio } from '../../controllers/folios-controller.js'
import matrixEditorRouter from '../matrix-editor-route.js'
import { authorizePublishedProject } from '../project-interceptor.js'

const projectsRouter = express.Router({ mergeParams: true })

projectsRouter.get('/data_dump', dataDumpController.dataDump)

projectsRouter.get('/', projectsController.getProjects)
projectsRouter.get(
  '/authors_projects',
  projectsController.getAuthorsWithProjects
)
projectsRouter.get(
  '/journals_projects',
  projectsController.getJournalsWithProjects
)
projectsRouter.get(
  '/institutions',
  projectsController.getInstitutionsWithProjects
)

projectsRouter.get('/folios/:folioId', getPublishedFolio)

projectsRouter.get('/taxonomy', projectsController.getProjectTaxonomy)

projectsRouter.get('/titles', projectsController.getProjectTitles)

projectsRouter.get('/stats', projectsController.getProjectStats)

// This is a sub-route focused on /public/projects/<projectId>
const projectRouter = express.Router({ mergeParams: true })
projectsRouter.use('/:projectId/', projectRouter)

// authenticate to make sure the project is public
projectRouter.use(authorizePublishedProject)

projectRouter.get('/', projectsController.getProjectsById)

projectRouter.get('/media', mediaController.getMediaFiles)

projectRouter.use('/matrices/:matrixId/view', matrixEditorRouter)

projectRouter.get('/matrices/:matrixId/download', matrixController.download)

projectRouter.get(
  '/matrices/:matrixId/download/characters',
  matrixController.downloadCharacters
)
projectRouter.get(
  '/matrices/:matrixId/download/ontology',
  matrixController.downloadCharacterRules
)

// SDD ZIP dump endpoint for published projects
projectRouter.get('/download/sdd', dataDumpController.projectSDDZipDump)

export default projectsRouter
