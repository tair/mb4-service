import express from 'express'
import * as controller from '../controllers/idigbio-controller.js'

const iDigBioRouter = express.Router({ mergeParams: true })

iDigBioRouter.get('/', controller.getiDigBioInfo)
iDigBioRouter.post('/fetch', controller.fetchiDigBioImages)

export default iDigBioRouter