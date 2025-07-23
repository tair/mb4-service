import express from 'express'
import * as analyticsController from '../controllers/analytics-controller.js'
import { maybeAuthenticateToken } from './auth-interceptor.js'

const analyticsRouter = express.Router()

// Use maybeAuthenticateToken to populate req.credential for logged-in users
// while still allowing anonymous users to log analytics
analyticsRouter.post('/view', maybeAuthenticateToken, analyticsController.logProjectView)
analyticsRouter.post('/download', maybeAuthenticateToken, analyticsController.logDownload)

export default analyticsRouter
