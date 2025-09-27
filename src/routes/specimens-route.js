import express from 'express'
import * as controller from '../controllers/specimens-controller.js'
import { requireEntityEditPermission, EntityType } from '../lib/auth-middleware.js'

const specimenRouter = express.Router({ mergeParams: true })

specimenRouter.get('/', controller.getSpecimens)
specimenRouter.post('/create', requireEntityEditPermission(EntityType.SPECIMEN), controller.createSpecimen)
specimenRouter.post('/create/batch', requireEntityEditPermission(EntityType.SPECIMEN), controller.createSpecimens)
specimenRouter.post('/delete', requireEntityEditPermission(EntityType.SPECIMEN), controller.deleteSpecimens)
specimenRouter.post('/usages', controller.getUsage)
specimenRouter.post('/search', controller.search)

specimenRouter.post('/:specimenId/edit', requireEntityEditPermission(EntityType.SPECIMEN), controller.editSpecimen)

specimenRouter.get('/:specimenId/citations', controller.getCitations)
specimenRouter.post('/:specimenId/citations/create', requireEntityEditPermission(EntityType.SPECIMEN), controller.createCitation)
specimenRouter.post(
  '/:specimenId/citations/:citationId/edit',
  requireEntityEditPermission(EntityType.SPECIMEN),
  controller.editCitation
)
specimenRouter.post('/:specimenId/citations/delete', requireEntityEditPermission(EntityType.SPECIMEN), controller.deleteCitations)

export default specimenRouter
