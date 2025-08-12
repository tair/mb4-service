import express from 'express'
import * as analyticsController from '../controllers/analytics-controller.js'
import { maybeAuthenticateToken } from './auth-interceptor.js'

const analyticsRouter = express.Router()

// Use maybeAuthenticateToken to populate req.credential for logged-in users
// while still allowing anonymous users to log analytics
analyticsRouter.post(
  '/view',
  maybeAuthenticateToken,
  analyticsController.logProjectView
)
analyticsRouter.post(
  '/download',
  maybeAuthenticateToken,
  analyticsController.logDownload
)

// Enhanced health status endpoint for comprehensive monitoring
analyticsRouter.get(
  '/health',
  maybeAuthenticateToken,
  (req, res) => {
    // Only allow authenticated users to see health status
    if (!req.credential && !req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    const healthStatus = analyticsController.getBufferStatus()
    res.json(healthStatus)
  }
)

// Detailed metrics endpoint for deep monitoring
analyticsRouter.get(
  '/metrics',
  maybeAuthenticateToken,
  (req, res) => {
    // Only allow authenticated users to see detailed metrics
    if (!req.credential && !req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    const metrics = analyticsController.getDetailedMetrics()
    res.json(metrics)
  }
)

// Legacy buffer status endpoint (maintained for backward compatibility)
analyticsRouter.get(
  '/buffer-status',
  maybeAuthenticateToken,
  (req, res) => {
    // Only allow authenticated users to see buffer status
    if (!req.credential && !req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    const status = analyticsController.getBufferStatus()
    res.json(status)
  }
)

// Manual flush endpoint for testing/debugging (requires authentication)
analyticsRouter.post(
  '/flush',
  maybeAuthenticateToken,
  async (req, res) => {
    // Only allow authenticated users to trigger manual flush
    if (!req.credential && !req.user) {
      return res.status(401).json({ message: 'Authentication required' })
    }
    
    try {
      const result = await analyticsController.flushAnalyticsBuffer()
      res.json({
        message: 'All logging buffers flushed successfully',
        result: result
      })
    } catch (error) {
      console.error('Manual flush failed:', error)
      res.status(500).json({
        message: 'Failed to flush logging buffers',
        error: error.message
      })
    }
  }
)

export default analyticsRouter
