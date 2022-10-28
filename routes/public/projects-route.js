import express from 'express'
import * as projectsController from '../../controllers/projects-controller.js'
import * as mediaController from '../../controllers/media-controller.js'
import * as dataDumpController from '../../controllers/datadump-controller.js'

const projectsRouter = express.Router()

projectsRouter.get('/data_dump', dataDumpController.dataDump)

projectsRouter.get('/', projectsController.getProjects)
projectsRouter.get('/:id', projectsController.getProjectsById)
projectsRouter.get('/titles/:sort_by', projectsController.getProjectTitles)
projectsRouter.get('/:id/media', mediaController.getMediaFiles)

export default projectsRouter
