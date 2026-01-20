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

specimenRouter.get('/:specimenId/citations', controller.getCitations)
specimenRouter.post('/:specimenId/citations/create', controller.createCitation)
specimenRouter.post(
  '/:specimenId/citations/:citationId/edit',
  controller.editCitation
)
specimenRouter.post('/:specimenId/citations/delete', controller.deleteCitations)

// Get most recent copyright for specimen (for auto-populate feature)
specimenRouter.get('/:specimenId/copyright', controller.getSpecimenCopyright)

export default specimenRouter
