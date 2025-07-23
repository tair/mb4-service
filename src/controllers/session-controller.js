/**
 * Session Controller
 * Provides session information and bot detection capabilities
 */

import { detectBot } from '../lib/session-middleware.js'

/**
 * Get session information including bot detection
 */
export async function getSessionInfo(req, res) {
  try {
    const sessionInfo = req.sessionInfo || {}
    const { sessionKey, fingerprint, ipAddr, userAgent } = sessionInfo

    if (!sessionKey) {
      return res.status(400).json({
        error: 'No session found',
        message: 'Session key is required'
      })
    }

    // Perform bot detection
    const botDetection = detectBot(fingerprint, userAgent)

    const response = {
      sessionKey: sessionKey.substring(0, 8) + '...', // Only show first 8 characters for security
      ipAddress: ipAddr,
      userAgent: userAgent,
      hasFingerprint: !!fingerprint,
      botDetection: {
        isBot: botDetection.isBot,
        confidence: botDetection.confidence,
        reasons: botDetection.reasons
      },
      timestamp: Date.now()
    }

    // Log bot detection results if suspicious
    if (botDetection.isBot) {
      console.warn(`Potential bot detected: session=${sessionKey.substring(0, 8)}..., confidence=${botDetection.confidence}, reasons=${botDetection.reasons.join(', ')}`)
    }

    res.status(200).json(response)
  } catch (error) {
    console.error('Error getting session info:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve session information'
    })
  }
}

/**
 * Get session statistics
 */
export async function getSessionStats(req, res) {
  try {
    // This could be expanded to provide session-based statistics
    // For now, just return basic session validation
    const sessionInfo = req.sessionInfo || {}
    
    res.status(200).json({
      hasValidSession: !!sessionInfo.sessionKey,
      sessionType: sessionInfo.sessionKey ? 'tracked' : 'anonymous',
      timestamp: Date.now()
    })
  } catch (error) {
    console.error('Error getting session stats:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve session statistics'
    })
  }
} 