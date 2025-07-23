/**
 * Session Middleware
 * Enhances existing infrastructure to log sessions to existing database tables
 * Based on existing stats_session_log and stats_login_log tables
 */

import sequelizeConn from '../util/db.js'
import { time } from '../util/util.js'

// In-memory session tracking to avoid duplicate inserts
const activeSessionsCache = new Map()

/**
 * Session tracking middleware
 * Logs new sessions to stats_session_log table using existing schema
 */
export function trackSession(req, res, next) {
  try {
    const sessionKey = req.headers['x-session-key']
    const fingerprint = req.headers['x-session-fingerprint']
    const ipAddr = req.ip || req.connection.remoteAddress || 'unknown'
    const userAgent = req.headers['user-agent'] || 'unknown'

    // If no session key, continue without logging
    if (!sessionKey || sessionKey.trim() === '') {
      next()
      return
    }

    // Validate session key format (32-character hex string to match database char(32))
    if (!/^[a-f0-9]{32}$/i.test(sessionKey)) {
      console.warn('Invalid session key format:', sessionKey)
      next()
      return
    }

    // Check if this session is already being tracked
    if (!activeSessionsCache.has(sessionKey)) {
      // Mark session as active to prevent duplicate inserts
      activeSessionsCache.set(sessionKey, {
        ipAddr,
        userAgent,
        fingerprint,
        firstSeen: time()
      })

      // Log new session to database asynchronously
      logNewSession(sessionKey, ipAddr, userAgent, fingerprint)
        .catch(error => {
          console.error('Failed to log session:', error)
        })
    }

    // Attach session info to request for other middleware
    req.sessionInfo = {
      sessionKey,
      fingerprint,
      ipAddr,
      userAgent,
      isNewSession: !activeSessionsCache.has(sessionKey)
    }

  } catch (error) {
    console.error('Session tracking error:', error)
  }

  next()
}

/**
 * Normalize IP address for database storage (max 15 chars for IPv4)
 */
function normalizeIpAddress(ipAddr) {
  if (!ipAddr) return 'unknown'
  
  // Convert IPv4-mapped IPv6 addresses to IPv4
  if (ipAddr.startsWith('::ffff:')) {
    ipAddr = ipAddr.substring(7) // Remove '::ffff:' prefix
  }
  
  // Truncate to 15 characters to fit database schema
  return ipAddr.substring(0, 15)
}

/**
 * Log new session to stats_session_log table
 */
async function logNewSession(sessionKey, ipAddr, userAgent, fingerprint) {
  try {
    const currentTime = time()
    const normalizedIpAddr = normalizeIpAddress(ipAddr)
    
    // Insert into stats_session_log using existing schema
    await sequelizeConn.query(
      `INSERT INTO stats_session_log (session_key, datetime_started, datetime_ended, ip_addr, user_agent)
       VALUES (?, ?, NULL, ?, ?)`,
      {
        replacements: [sessionKey, currentTime, normalizedIpAddr, userAgent]
      }
    )

    console.log(`New session logged: ${sessionKey.substring(0, 8)}...`)
  } catch (error) {
    // Ignore duplicate key errors (session already exists)
    if (error.name === 'SequelizeUniqueConstraintError' || 
        error.code === 'ER_DUP_ENTRY' ||
        error.message.includes('Duplicate entry')) {
      // Session already logged, ignore silently
      return
    }
    
    console.error('Failed to log session:', error)
    // Don't throw - logging failure shouldn't break the request
  }
}

/**
 * Log user login with session association
 * This enhances the existing login process to populate stats_login_log
 */
export async function logUserLogin(sessionKey, userId, ipAddr, userAgent) {
  try {
    if (!sessionKey || !userId) {
      return
    }

    const currentTime = time()

    // Insert into stats_login_log with session association
    await sequelizeConn.query(
      `INSERT INTO stats_login_log (session_key, user_id, datetime_started, datetime_ended, ip_addr, user_agent)
       VALUES (?, ?, ?, NULL, ?, ?)`,
      {
        replacements: [sessionKey, userId, currentTime, ipAddr, userAgent]
      }
    )

    console.log(`User login logged: user_id=${userId}, session=${sessionKey.substring(0, 8)}...`)
  } catch (error) {
    console.error('Failed to log user login:', error)
  }
}

/**
 * Log user logout
 */
export async function logUserLogout(sessionKey, userId) {
  try {
    if (!sessionKey || !userId) {
      return
    }

    const currentTime = time()

    // Update the most recent login record for this session/user
    await sequelizeConn.query(
      `UPDATE stats_login_log 
       SET datetime_ended = ?
       WHERE session_key = ? AND user_id = ? AND datetime_ended IS NULL
       ORDER BY datetime_started DESC
       LIMIT 1`,
      {
        replacements: [currentTime, sessionKey, userId]
      }
    )

    console.log(`User logout logged: user_id=${userId}, session=${sessionKey.substring(0, 8)}...`)
  } catch (error) {
    console.error('Failed to log user logout:', error)
  }
}

/**
 * Update session end time (called when session expires or is renewed)
 */
export async function endSession(sessionKey) {
  try {
    if (!sessionKey) {
      return
    }

    const currentTime = time()

    // Update session end time
    await sequelizeConn.query(
      `UPDATE stats_session_log 
       SET datetime_ended = ?
       WHERE session_key = ? AND datetime_ended IS NULL`,
      {
        replacements: [currentTime, sessionKey]
      }
    )

    // Remove from active sessions cache
    activeSessionsCache.delete(sessionKey)

    console.log(`Session ended: ${sessionKey.substring(0, 8)}...`)
  } catch (error) {
    console.error('Failed to end session:', error)
  }
}

/**
 * Basic bot detection using fingerprint analysis
 */
export function detectBot(fingerprint, userAgent) {
  if (!fingerprint || !userAgent) {
    return { isBot: false, confidence: 0, reasons: [] }
  }

  const reasons = []
  let score = 0

  try {
    const fpData = JSON.parse(atob(fingerprint))

    // Check for common bot user agents
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scraper/i,
      /headless/i, /phantom/i, /selenium/i, /puppeteer/i
    ]
    
    if (botPatterns.some(pattern => pattern.test(userAgent))) {
      score += 0.5
      reasons.push('Bot user agent detected')
    }

    // Check for suspicious screen dimensions
    if (fpData.screen === '0x0x0' || fpData.screen === '1x1x1') {
      score += 0.3
      reasons.push('Suspicious screen dimensions')
    }

    // Check for missing browser features
    if (!fpData.cookieEnabled) {
      score += 0.2
      reasons.push('Cookies disabled')
    }

    // Check for very old or very new timestamps (possible manipulation)
    const now = Date.now()
    const timeDiff = Math.abs(now - fpData.timestamp)
    if (timeDiff > 60000) { // More than 1 minute difference
      score += 0.1
      reasons.push('Timestamp anomaly')
    }

  } catch (error) {
    score += 0.3
    reasons.push('Invalid fingerprint format')
  }

  return {
    isBot: score >= 0.5,
    confidence: Math.min(score, 1.0),
    reasons
  }
}

/**
 * Cleanup old sessions periodically (to be called by a scheduler)
 */
export async function cleanupOldSessions() {
  try {
    const cutoffTime = time() - (7 * 24 * 60 * 60) // 7 days ago

    // End sessions that haven't been seen in 7 days
    await sequelizeConn.query(
      `UPDATE stats_session_log 
       SET datetime_ended = datetime_started + 86400
       WHERE datetime_ended IS NULL AND datetime_started < ?`,
      {
        replacements: [cutoffTime]
      }
    )

    // Clean up memory cache for very old sessions
    for (const [sessionKey, data] of activeSessionsCache.entries()) {
      if (data.firstSeen < cutoffTime) {
        activeSessionsCache.delete(sessionKey)
      }
    }

    console.log('Old sessions cleaned up')
  } catch (error) {
    console.error('Failed to cleanup old sessions:', error)
  }
} 