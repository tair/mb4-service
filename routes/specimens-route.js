import express from 'express'
import * as controller from '../controllers/specimens-controller.js'

const specimenRouter = express.Router({ mergeParams: true })

specimenRouter.get('/', controller.getSpecimens)
specimenRouter.post('/create', controller.createSpecimen)
specimenRouter.post('/create/batch', controller.createSpecimens)
specimenRouter.post('/delete', controller.deleteSpecimens)
specimenRouter.post('/usages', controller.getUsage)
specimenRouter.post('/search', controller.search)

specimenRouter.post('/:specimenId/edit', controller.editSpecimen)

export default specimenRouter
