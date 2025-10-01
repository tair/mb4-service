import express from 'express'
import * as controller from '../controllers/folios-controller.js'
import { requireEntityEditPermission, EntityType } from '../lib/auth-middleware.js'

const folioRouter = express.Router({ mergeParams: true })

folioRouter.get('/', controller.getFolios)
folioRouter.post('/create', requireEntityEditPermission(EntityType.FOLIO), controller.createFolio)
folioRouter.post('/delete', requireEntityEditPermission(EntityType.FOLIO), controller.deleteFolios)

folioRouter.get('/:folioId', controller.getFolio)
folioRouter.post('/:folioId/edit', requireEntityEditPermission(EntityType.FOLIO), controller.editFolio)

folioRouter.get('/:folioId/media', controller.getMedia)
folioRouter.post('/:folioId/media/create', requireEntityEditPermission(EntityType.FOLIO), controller.createMedia)
folioRouter.post('/:folioId/media/reorder', requireEntityEditPermission(EntityType.FOLIO), controller.reorderMedia)
folioRouter.post('/:folioId/media/delete', requireEntityEditPermission(EntityType.FOLIO), controller.deleteMedia)
folioRouter.post('/:folioId/media/search', controller.searchMedia)

export default folioRouter
