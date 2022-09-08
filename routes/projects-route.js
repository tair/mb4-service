import express from 'express';
import * as projectsController from '../controllers/projects-controller.js';
import * as mediaController from '../controllers/media-controller.js';
import * as dataDumpController from '../controllers/datadump-controller.js';
import * as authController from '../controllers/auth-controller.js';

const projectRouter = express.Router()

projectRouter.get('/data_dump', dataDumpController.dataDump)

projectRouter.get('/', projectsController.getProjects)
projectRouter.get('/:id', projectsController.getProjectsById)
projectRouter.get('/media_files/:id', mediaController.getMediaFiles)

export default projectRouter;