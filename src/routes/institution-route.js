import express from 'express'
import * as controller from '../controllers/institution-controller.js'


const institutionRouter = express.Router({ mergeParams: true })

institutionRouter.get('/', controller.fetchProjectInstitutions)
institutionRouter.post('/assign', controller.assignInstitutionToProject)
institutionRouter.get('/search', controller.searchInstitutions)

export default institutionRouter