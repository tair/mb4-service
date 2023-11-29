import express from 'express'
import * as controller from '../controllers/taxa-controller.js'

const taxaRouter = express.Router({ mergeParams: true })

taxaRouter.get('/', controller.getTaxa)
taxaRouter.post('/create', controller.createTaxon)
taxaRouter.post('/create/batch', controller.createTaxa)
taxaRouter.post('/delete', controller.deleteTaxa)
taxaRouter.post('/usages', controller.getUsage)
taxaRouter.post('/search', controller.search)

taxaRouter.post('/:taxonId/edit', controller.editTaxon)

export default taxaRouter
