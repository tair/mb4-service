/**
 * Session Middleware
 * Enhances existing infrastructure to log sessions to existing database tables
 * Based on existing stats_session_log and stats_login_log tables
 */

import sequelizeConn from '../util/db.js'
import { time } from '../util/util.js'

// In-memory session tracking to avoid duplicate inserts
const activeSessionsCache = new Map()

// Periodic cleanup to prevent memory leaks
const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour
const SESSION_TIMEOUT = 24 * 60 * 60 // 24 hours in seconds

// Schedule periodic cleanup
setInterval(() => {
  cleanupActiveSessionsCache()
}, CLEANUP_INTERVAL)

// Schedule database cleanup (every 6 hours)
setInterval(() => {
  cleanupOldSessions().catch(error => {
    console.error('Scheduled session cleanup failed:', error)
  })
}, 6 * 60 * 60 * 1000) // 6 hours

/**
 * Clean up old sessions from memory cache
 */
function cleanupActiveSessionsCache() {
  const now = time()
  let cleanedCount = 0
  
  for (const [sessionKey, data] of activeSessionsCache.entries()) {
    // Remove sessions older than 24 hours from memory
    if (now - data.firstSeen > SESSION_TIMEOUT) {
      activeSessionsCache.delete(sessionKey)
      cleanedCount++
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} old sessions from memory cache`)
  }
}

/**
 * Session tracking middleware
 * Logs new sessions to stats_session_log table using existing schema
 */
export function trackSession(req, res, next) {
  try {
    const sessionKey = req.headers['x-session-key']
    const fingerprint = req.headers['x-session-fingerprint']
    const rawIpAddr = extractRealIpAddress(req)
    const ipAddr = normalizeIpAddress(rawIpAddr)
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
      // Check if there's an existing session from same IP/user agent that should be ended
      const similarSession = findSimilarActiveSession(ipAddr, userAgent)
      if (similarSession) {
        // End the previous session (likely a renewal scenario)
        endSession(similarSession.sessionKey).catch(error => {
          console.error('Failed to end previous session:', error)
        })
      }

      // Mark session as active to prevent duplicate inserts
      activeSessionsCache.set(sessionKey, {
        ipAddr,
        userAgent,
        fingerprint,
        firstSeen: time(),
        sessionKey
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
 * Find existing session from same IP/user agent (for renewal detection)
 */
function findSimilarActiveSession(ipAddr, userAgent) {
  for (const [sessionKey, data] of activeSessionsCache.entries()) {
    if (data.ipAddr === ipAddr && data.userAgent === userAgent) {
      return { sessionKey, ...data }
    }
  }
  return null
}

/**
 * Extract the real client IP address, handling Docker/proxy scenarios
 */
function extractRealIpAddress(req) {
  // Priority order for IP extraction:
  // 1. X-Forwarded-For (most common proxy header, may contain multiple IPs)
  // 2. X-Real-IP (nginx proxy header)
  // 3. X-Client-IP (Apache proxy header)
  // 4. CF-Connecting-IP (Cloudflare)
  // 5. X-Cluster-Client-IP (load balancer)
  // 6. Forwarded (RFC 7239 standard)
  // 7. req.ip (Express default)
  // 8. req.connection.remoteAddress (fallback)

  // X-Forwarded-For can contain multiple IPs: "client, proxy1, proxy2"
  // We want the first (leftmost) IP which is the original client
  const xForwardedFor = req.headers['x-forwarded-for']
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map(ip => ip.trim())
    if (ips.length > 0 && ips[0] !== '') {
      return ips[0]
    }
  }

  // Check other proxy headers
  const xRealIp = req.headers['x-real-ip']
  if (xRealIp && xRealIp !== '') {
    return xRealIp
  }

  const xClientIp = req.headers['x-client-ip']
  if (xClientIp && xClientIp !== '') {
    return xClientIp
  }

  const cfConnectingIp = req.headers['cf-connecting-ip']
  if (cfConnectingIp && cfConnectingIp !== '') {
    return cfConnectingIp
  }

  const xClusterClientIp = req.headers['x-cluster-client-ip']
  if (xClusterClientIp && xClusterClientIp !== '') {
    return xClusterClientIp
  }

  // RFC 7239 Forwarded header (more complex parsing)
  const forwarded = req.headers['forwarded']
  if (forwarded) {
    const forMatch = forwarded.match(/for=([^;,\s]+)/)
    if (forMatch && forMatch[1]) {
      // Remove quotes and brackets if present
      let ip = forMatch[1].replace(/["[\]]/g, '')
      // Handle IPv6 format
      if (ip.startsWith('[') && ip.endsWith(']')) {
        ip = ip.slice(1, -1)
      }
      return ip
    }
  }

  // Fallback to Express defaults
  return req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown'
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
export async function logUserLogin(sessionKey, userId, req) {
  try {
    if (!sessionKey || !userId) {
      return
    }

    const currentTime = time()
    const realIpAddr = extractRealIpAddress(req)
    const normalizedIpAddr = normalizeIpAddress(realIpAddr)
    const userAgent = req.headers['user-agent'] || 'unknown'

    // Insert into stats_login_log with session association
    await sequelizeConn.query(
      `INSERT INTO stats_login_log (session_key, user_id, datetime_started, datetime_ended, ip_addr, user_agent)
       VALUES (?, ?, ?, NULL, ?, ?)`,
      {
        replacements: [sessionKey, userId, currentTime, normalizedIpAddr, userAgent]
      }
    )

    // Retroactively update analytics entries for this session
    await updateSessionAnalytics(sessionKey, userId)

    console.log(`User login logged: user_id=${userId}, session=${sessionKey.substring(0, 8)}...`)
  } catch (error) {
    console.error('Failed to log user login:', error)
  }
}

/**
 * Update analytics entries to associate anonymous activities with the logged-in user
 * This solves the "user logged in halfway through session" problem
 */
async function updateSessionAnalytics(sessionKey, userId) {
  try {
    // Update previous anonymous analytics hits for this session
    const hitUpdateResult = await sequelizeConn.query(
      `UPDATE stats_pub_hit_log 
       SET user_id = ? 
       WHERE session_key = ? AND user_id IS NULL`,
      {
        replacements: [userId, sessionKey]
      }
    )

    // Update previous anonymous download logs for this session  
    const downloadUpdateResult = await sequelizeConn.query(
      `UPDATE stats_pub_download_log 
       SET user_id = ? 
       WHERE session_key = ? AND user_id IS NULL`,
      {
        replacements: [userId, sessionKey]
      }
    )

    const hitsUpdated = hitUpdateResult[1]?.affectedRows || 0
    const downloadsUpdated = downloadUpdateResult[1]?.affectedRows || 0
    
    if (hitsUpdated > 0 || downloadsUpdated > 0) {
      console.log(`Retroactively associated ${hitsUpdated} hits and ${downloadsUpdated} downloads with user_id=${userId}`)
    }
  } catch (error) {
    console.error('Failed to update session analytics:', error)
    // Don't throw - this is a nice-to-have feature that shouldn't break login
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