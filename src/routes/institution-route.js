import express from 'express'
import * as controller from '../controllers/institution-controller.js'

const institutionRouter = express.Router({ mergeParams: true })

institutionRouter.get('/', controller.fetchProjectInstitutions)
institutionRouter.get('/add', controller.searchInstitutionById)
institutionRouter.get('/search', controller.searchInstitutions)

institutionRouter.post('/add', controller.addInstitutionToProject)
institutionRouter.post('/remove', controller.removeInstitutionFromProject)

export default institutionRouter
