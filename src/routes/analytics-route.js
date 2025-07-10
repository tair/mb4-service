import express from 'express'
import * as analyticsController from '../controllers/analytics-controller.js'
import { authenticateToken } from './auth-interceptor.js'

const analyticsRouter = express.Router()

analyticsRouter.post('/view', analyticsController.logProjectView)
analyticsRouter.post('/download', analyticsController.logDownload)

export default analyticsRouter
