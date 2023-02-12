import express from 'express'
import * as controller from '../controllers/taxa-controller.js'

const taxaRouter = express.Router({ mergeParams: true })

taxaRouter.get('/', controller.getTaxa)

export default taxaRouter
