import express from 'express'
import { getSessionInfo, getSessionStats } from '../controllers/session-controller.js'

const sessionRouter = express.Router()

// Get session information and bot detection
sessionRouter.get('/info', getSessionInfo)

// Get session statistics
sessionRouter.get('/stats', getSessionStats)

export default sessionRouter 