import express from 'express'
import * as sessionController from '../controllers/session-controller.js'

const sessionRouter = express.Router()

// Get session information and bot detection
sessionRouter.get('/info', sessionController.getSessionInfo)

// Get session statistics
sessionRouter.get('/stats', sessionController.getSessionStats)

export default sessionRouter 