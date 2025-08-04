import express from 'express'
import * as controller from '../controllers/taxa-controller.js'

const taxaRouter = express.Router({ mergeParams: true })

taxaRouter.get('/', controller.getTaxa)
taxaRouter.post('/create', controller.createTaxon)
taxaRouter.post('/create/batch', controller.createTaxa)
taxaRouter.post('/delete', controller.deleteTaxa)
taxaRouter.post('/edit', controller.editTaxa)
taxaRouter.post('/extinct/batch', controller.updateExtinctStatusBatch)
taxaRouter.post('/search', controller.search)
taxaRouter.post('/usages', controller.getUsage)

taxaRouter.post('/:taxonId/edit', controller.editTaxon)

taxaRouter.get('/:taxonId/citations', controller.getCitations)
taxaRouter.post('/:taxonId/citations/create', controller.createCitation)
taxaRouter.post('/:taxonId/citations/:citationId/edit', controller.editCitation)
taxaRouter.post('/:taxonId/citations/delete', controller.deleteCitations)

export default taxaRouter
