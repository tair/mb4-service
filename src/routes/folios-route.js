import express from 'express'
import * as controller from '../controllers/folios-controller.js'

const folioRouter = express.Router({ mergeParams: true })

folioRouter.get('/', controller.getFolios)
folioRouter.post('/create', controller.createFolio)
folioRouter.post('/delete', controller.deleteFolios)

folioRouter.get('/:folioId', controller.getFolio)
folioRouter.post('/:folioId/edit',controller.editFolio)

folioRouter.get('/:folioId/media', controller.getMedia)
folioRouter.post('/:folioId/media/create', controller.createMedia)
folioRouter.post('/:folioId/media/:mediaId/reorder', controller.editMedia)
folioRouter.post('/:folioId/media/delete', controller.deleteMedia)

export default folioRouter