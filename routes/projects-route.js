import express from 'express'
import matrixRouter from './matrix-route.js'
import characterRouter from './characters-route.js'
import taxaRouter from './taxa-route.js'
import { maybeAuthenticateToken } from '../controllers/auth-controller.js'

const projectRouter = express.Router({ mergeParams: true })

projectRouter.use(
  '/:projectId/characters',
  maybeAuthenticateToken,
  characterRouter
)
projectRouter.use('/:projectId/matrices', maybeAuthenticateToken, matrixRouter)
projectRouter.use('/:projectId/taxa', maybeAuthenticateToken, taxaRouter)

export default projectRouter
