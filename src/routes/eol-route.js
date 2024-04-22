import express from 'express'
import * as controller from '../controllers/eol-controller.js'

const eolRouter = express.Router({ mergeParams: true })

eolRouter.get('/', controller.getEolInfo)
eolRouter.post('/fetch', controller.fetchEolImages)

export default eolRouter
