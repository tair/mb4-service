import express from 'express'
import * as controller from '../controllers/pbdb-controller.js'

const pbdbRouter = express.Router({ mergeParams: true })

pbdbRouter.get('/', controller.getPbdbInfo)
pbdbRouter.post('/validate', controller.validateTaxa)
pbdbRouter.post('/import', controller.importTaxaInfo)

export default pbdbRouter