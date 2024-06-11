import express from 'express'
import * as controller from '../controllers/idigbio-controller.js'

const iDigBioRouter = express.Router({ mergeParams: true })

iDigBioRouter.get('/', controller.getiDigBioInfo)
iDigBioRouter.post('/media', controller.fetchMedia)
iDigBioRouter.post('/import', controller.importMedia)

export default iDigBioRouter
