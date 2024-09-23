import express from 'express'
import * as controller from '../controllers/media-labels-controller.js'

const mediaLabelsRouter = express.Router({ mergeParams: true })

mediaLabelsRouter.get('/', controller.getMediaLabels)

mediaLabelsRouter.post('/edit', controller.editMediaLabels)

mediaLabelsRouter.post('/delete', controller.deleteMediaLabels)

export default mediaLabelsRouter
