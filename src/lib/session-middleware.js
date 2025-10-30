/**
 * Session Middleware
 * Enhances existing infrastructure to log sessions to existing database tables
 * Based on existing stats_session_log and stats_login_log tables
 */

import sequelizeConn from '../util/db.js'
import { time } from '../util/util.js'
import loggingService from '../services/logging-service.js'
import { isIPv6 } from 'net'

// In-memory session tracking to avoid duplicate inserts
const activeSessionsCache = new Map()

// Periodic cleanup to prevent memory leaks
const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour
const SESSION_TIMEOUT = 24 * 60 * 60 // 24 hours in seconds

// Store interval references for cleanup
let memoryCleanupInterval = null
let databaseCleanupInterval = null

// Schedule periodic cleanup with proper cleanup handling
memoryCleanupInterval = setInterval(() => {
  cleanupActiveSessionsCache()
}, CLEANUP_INTERVAL)

// Schedule database cleanup (every 6 hours)
databaseCleanupInterval = setInterval(() => {
  cleanupOldSessions().catch((error) => {
    console.error('Scheduled session cleanup failed:', error)
  })
}, 6 * 60 * 60 * 1000) // 6 hours

// Graceful shutdown handling
const cleanup = () => {
  if (memoryCleanupInterval) {
    clearInterval(memoryCleanupInterval)
    memoryCleanupInterval = null
  }
  if (databaseCleanupInterval) {
    clearInterval(databaseCleanupInterval)
    databaseCleanupInterval = null
  }
}

// Register cleanup handlers for various shutdown signals
process.on('SIGTERM', cleanup)
process.on('SIGINT', cleanup)
process.on('SIGHUP', cleanup)

// Export cleanup function for manual cleanup if needed
export const cleanupSessionMiddleware = cleanup

/**
 * Retry operation with exponential backoff
 */
async function retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
  let lastError = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      // Don't retry certain errors
      if (
        error.name === 'SequelizeUniqueConstraintError' ||
        error.code === 'ER_DUP_ENTRY' ||
        error.message.includes('Duplicate entry')
      ) {
        // These are expected for session duplicates
        return
      }

      if (attempt === maxRetries) {
        throw lastError
      }

      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000
      await new Promise((resolve) => setTimeout(resolve, delay))

      console.warn(
        `Retrying operation (attempt ${
          attempt + 1
        }/${maxRetries}) after error:`,
        error.message
      )
    }
  }

  throw lastError
}

/**
 * Clean up old sessions from memory cache
 */
function cleanupActiveSessionsCache() {
  const now = time()
  let cleanedCount = 0

  // Clean up old sessions
  for (const [sessionKey, data] of activeSessionsCache.entries()) {
    // Remove sessions older than 24 hours from memory
    if (now - data.firstSeen > SESSION_TIMEOUT) {
      activeSessionsCache.delete(sessionKey)
      cleanedCount++
    }
  }

  // cleanedCount tracked but not logged
}

/**
 * Session tracking middleware
 * Logs new sessions to stats_session_log table using existing schema
 */
export async function trackSession(req, res, next) {
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
    const isNewSession = !activeSessionsCache.has(sessionKey)

    if (isNewSession) {
      // Check if there's an existing session from same IP/user agent that should be ended
      const similarSession = findSimilarActiveSession(ipAddr, userAgent)
      if (similarSession) {
        // End the previous session (likely a renewal scenario) - await to prevent race condition
        try {
          await endSession(similarSession.sessionKey)
        } catch (error) {
          console.error('Failed to end previous session:', error)
        }
      }

      // Mark session as active to prevent duplicate inserts
      activeSessionsCache.set(sessionKey, {
        ipAddr,
        userAgent,
        fingerprint,
        firstSeen: time(),
        sessionKey,
      })

      // Log new session using the logging service (batched)
      try {
        loggingService.logSession({
          session_key: sessionKey,
          ip_addr: ipAddr,
          user_agent: userAgent,
          fingerprint: fingerprint
        })
      } catch (error) {
        console.error('Failed to queue session for logging:', error)
        // Continue processing - session logging failure shouldn't break the request
      }
    }

    // Attach session info to request for other middleware
    req.sessionInfo = {
      sessionKey,
      fingerprint,
      ipAddr,
      userAgent,
      isNewSession,
    }
  } catch (error) {
    console.error('Session tracking error:', error)

    // Provide fallback session info even on error
    req.sessionInfo = {
      sessionKey: null,
      fingerprint: null,
      ipAddr: 'unknown',
      userAgent: 'unknown',
      isNewSession: false,
      error: true,
    }
  }

  next()
}

/**
 * Find existing session that should be ended (improved renewal detection)
 * Only considers sessions older than 1 minute to avoid false positives
 */
function findSimilarActiveSession(ipAddr, userAgent) {
  const now = time()
  const minSessionAge = 60 // 1 minute in seconds

  for (const [sessionKey, data] of activeSessionsCache.entries()) {
    // Only consider ending sessions that are at least 1 minute old
    // This prevents legitimate users from ending each other's fresh sessions
    if (
      data.ipAddr === ipAddr &&
      data.userAgent === userAgent &&
      now - data.firstSeen > minSessionAge
    ) {
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
    const ips = xForwardedFor.split(',').map((ip) => ip.trim())
    if (ips.length > 0 && ips[0] !== '' && isValidIpAddress(ips[0])) {
      return ips[0]
    }
  }

  // Check other proxy headers with validation
  const xRealIp = req.headers['x-real-ip']
  if (xRealIp && xRealIp !== '' && isValidIpAddress(xRealIp)) {
    return xRealIp
  }

  const xClientIp = req.headers['x-client-ip']
  if (xClientIp && xClientIp !== '' && isValidIpAddress(xClientIp)) {
    return xClientIp
  }

  const cfConnectingIp = req.headers['cf-connecting-ip']
  if (
    cfConnectingIp &&
    cfConnectingIp !== '' &&
    isValidIpAddress(cfConnectingIp)
  ) {
    return cfConnectingIp
  }

  const xClusterClientIp = req.headers['x-cluster-client-ip']
  if (
    xClusterClientIp &&
    xClusterClientIp !== '' &&
    isValidIpAddress(xClusterClientIp)
  ) {
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
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  )
}

/**
 * Validate IP address format
 */
function isValidIpAddress(ip) {
  if (!ip || typeof ip !== 'string') return false

  // IPv4 regex
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

  // Check for private/localhost IPs that might be spoofed
  if (ipv4Regex.test(ip)) {
    const parts = ip.split('.').map(Number)
    // Block obviously invalid IPs
    if (parts[0] === 0 || parts[0] === 255) return false
    return true
  }

  // IPv6 validation - use Node.js built-in validation which handles all compression cases
  // This properly handles compressed notation like 2a09:bac1:7680:8e0::3f9:31
  return isIPv6(ip)
}

/**
 * Normalize IP address for database storage with improved handling
 */
function normalizeIpAddress(ipAddr) {
  if (!ipAddr) return 'unknown'

  // Validate IP format first
  if (!isValidIpAddress(ipAddr)) {
    console.warn('Invalid IP address format detected:', ipAddr)
    return 'invalid'
  }

  // Convert IPv4-mapped IPv6 addresses to IPv4 for consistency
  if (ipAddr.startsWith('::ffff:')) {
    const ipv4Part = ipAddr.substring(7)
    if (isValidIpAddress(ipv4Part)) {
      return ipv4Part
    }
  }

  // Return full IPv6 address (database now supports up to 45 chars)
  return ipAddr
}

// logNewSession function removed - now handled by logging service

/**
 * Log user login with session association
 * This enhances the existing login process to populate stats_login_log
 */
export async function logUserLogin(sessionKey, userId, req) {
  try {
    if (!sessionKey || !userId) {
      return
    }

    const realIpAddr = extractRealIpAddress(req)
    const normalizedIpAddr = normalizeIpAddress(realIpAddr)
    const userAgent = req.headers['user-agent'] || 'unknown'

    // Log user login using the logging service (batched)
    // This automatically handles retroactive analytics updates
    loggingService.logLogin({
      session_key: sessionKey,
      user_id: userId,
      ip_addr: normalizedIpAddr,
      user_agent: userAgent
    })

    // User login queued for logging
  } catch (error) {
    console.error('Failed to queue user login for logging:', error)
    // Don't throw - login logging failure shouldn't break authentication
  }
}

// updateSessionAnalytics function removed - now handled by logging service

/**
 * Log user logout
 */
export async function logUserLogout(sessionKey, userId) {
  try {
    if (!sessionKey || !userId) {
      return
    }

    // Log user logout using the logging service (batched)
    loggingService.logLogout({
      session_key: sessionKey,
      user_id: userId
    })

    // User logout queued for logging
  } catch (error) {
    console.error('Failed to queue user logout for logging:', error)
    // Don't throw - logout logging failure shouldn't break logout process
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

    // Log session end using the logging service (batched)
    loggingService.logSessionEnd({
      session_key: sessionKey
    })

    // Remove from active sessions cache immediately
    activeSessionsCache.delete(sessionKey)

    // Session end queued for logging
  } catch (error) {
    console.error('Failed to queue session end for logging:', error)
    // Still remove from cache even if logging failed to prevent memory leak
    activeSessionsCache.delete(sessionKey)
    // Don't throw - session end logging failure shouldn't break the process
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
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /headless/i,
      /phantom/i,
      /selenium/i,
      /puppeteer/i,
    ]

    if (botPatterns.some((pattern) => pattern.test(userAgent))) {
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
    if (timeDiff > 60000) {
      // More than 1 minute difference
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
    reasons,
  }
}

/**
 * Cleanup old sessions periodically (to be called by a scheduler)
 */
export async function cleanupOldSessions() {
  try {
    const cutoffTime = time() - 7 * 24 * 60 * 60 // 7 days ago

    // End sessions that haven't been seen in 7 days - with retry
    await retryOperation(async () => {
      await sequelizeConn.query(
        `UPDATE stats_session_log 
         SET datetime_ended = datetime_started + 86400
         WHERE datetime_ended IS NULL AND datetime_started < ?`,
        {
          replacements: [cutoffTime],
        }
      )
    })

    // Clean up memory cache for very old sessions
    let cleanedCount = 0
    for (const [sessionKey, data] of activeSessionsCache.entries()) {
      if (data.firstSeen < cutoffTime) {
        activeSessionsCache.delete(sessionKey)
        cleanedCount++
      }
    }

    // Old sessions cleaned up from memory cache
  } catch (error) {
    console.error('Failed to cleanup old sessions after retries:', error)
    // Don't throw - this is a background cleanup operation
  }
}
