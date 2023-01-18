import express from 'express'
import matrixRouter from './matrix-route.js'
import { maybeAuthenticateToken } from '../controllers/auth-controller.js'

const projectRouter = express.Router({ mergeParams: true })

projectRouter.use('/:projectId/matrices', maybeAuthenticateToken, matrixRouter)

export default projectRouter
