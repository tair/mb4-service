import express from 'express'
import * as controller from '../controllers/scheduler-controller.js'
import { authenticateToken } from './auth-interceptor.js'

const schedulerRouter = express.Router()

// Apply authentication to all scheduler routes
schedulerRouter.use(authenticateToken)

// Health check endpoint
schedulerRouter.get('/health', controller.healthCheck)

// Scheduler management endpoints
schedulerRouter.get('/status', controller.getSchedulerStatus)
schedulerRouter.post('/start', controller.startScheduler)
schedulerRouter.post('/stop', controller.stopScheduler)

// Job management endpoints
schedulerRouter.post('/sync-cipres-jobs', controller.syncCipresJobs)
schedulerRouter.post('/trigger/:jobName', controller.triggerJob)

export default schedulerRouter
