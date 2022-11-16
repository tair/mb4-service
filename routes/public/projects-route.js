import express from 'express'
import * as projectsController from '../../controllers/projects-controller.js'
import * as mediaController from '../../controllers/media-controller.js'
import * as dataDumpController from '../../controllers/datadump-controller.js'

const projectsRouter = express.Router()

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

projectsRouter.get('/taxonomy', projectsController.getProjectTaxonomy)

projectsRouter.get('/titles', projectsController.getProjectTitles)

projectsRouter.get('/:id', projectsController.getProjectsById)

projectsRouter.get('/:id/media', mediaController.getMediaFiles)

export default projectsRouter
