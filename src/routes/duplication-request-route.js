import express from 'express'
import * as controller from '../controllers/duplication-controller.js'

const duplicationRequestRouter = express.Router({ mergeParams: true })

duplicationRequestRouter.get('/', controller.getCondition)

duplicationRequestRouter.post('/', controller.createRequest)

export default duplicationRequestRouter
