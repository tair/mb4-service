import express from 'express'
import matrixRouter from './matrix-route.js'

const projectRouter = express.Router({ mergeParams: true })

projectRouter.use('/:projectId/matrix', matrixRouter)

export default projectRouter
