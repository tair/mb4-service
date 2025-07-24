import sequelizeConn from '../util/db.js'
import { time } from '../util/util.js'

/**
 * Unified Logging Service
 * Handles batched logging for analytics, sessions, and user events
 * Designed for high-throughput with graceful degradation
 * 
 * TRAFFIC ANALYSIS (2M hits/month):
 * - Sessions: ~140-500 events/minute (HIGHEST VOLUME - every browser session)
 * - Analytics: ~46 events/minute (hits + downloads)
 * - User Events: ~10-30 events/minute (logins/logouts)
 * 
 * Total: ~200-580 database writes/minute without batching
 * With batching: ~3-8 bulk operations/minute (95%+ reduction)
 */
class LoggingService {
  constructor() {
    // Buffer configuration optimized for different event types
    // CORRECTED: Sessions have much higher volume than analytics!
    this.config = {
      // Session events (HIGHEST volume - every browser session)
      sessions: {
        maxSize: 200,           // Larger buffer for high-volume session events
        flushInterval: 10000,   // Flush every 10 seconds (highest priority)
      },
      // User events (medium volume, critical for retroactive updates)
      userEvents: {
        maxSize: 100,
        flushInterval: 15000,   // 15 seconds
      },
      // Analytics events (lower volume than sessions, can tolerate delay)
      analytics: {
        maxSize: 300,
        flushInterval: 30000,   // 30 seconds (lowest priority)
      }
    }

    // Event buffers organized by type
    this.buffers = {
      // Analytics events
      hits: [],
      downloads: [],
      
      // Session lifecycle events
      sessions: [],
      sessionEnds: [],
      
      // User authentication events
      logins: [],
      logouts: [],
      
      // Retroactive user association updates
      analyticsUpdates: [],
      
      // Metadata
      lastFlush: Date.now(),
      isShuttingDown: false
    }

    // Service state management
    this.state = {
      isStarted: false,
      flushTimer: null,
      consecutiveFailures: 0,
      circuitBreakerOpen: false,
      circuitBreakerOpenTime: null,
      totalEventsProcessed: 0,
      totalFlushes: 0,
      lastHealthCheck: Date.now()
    }

    // Circuit breaker configuration
    this.circuitBreaker = {
      failureThreshold: 5,           // Open circuit after 5 consecutive failures
      recoveryTimeoutMs: 60000,      // 1 minute recovery timeout
      healthCheckIntervalMs: 30000   // Health check every 30 seconds when open
    }

    // Performance metrics for monitoring
    this.metrics = {
      eventsBuffered: 0,
      eventsFlushSuccesses: 0,
      eventsFlushFailures: 0,
      avgFlushTimeMs: 0,
      maxBufferSize: 0,
      circuitBreakerTrips: 0,
      
      // Event type breakdown (to monitor volume differences)
      eventCounts: {
        hits: 0,
        downloads: 0,
        sessions: 0,
        sessionEnds: 0,
        logins: 0,
        logouts: 0,
        analyticsUpdates: 0
      }
    }
  }

  /**
   * Start the logging service with health monitoring
   */
    start() {
    if (this.state.isStarted) {
      return
    }

    this.state.isStarted = true
    this.state.lastHealthCheck = Date.now()

    // Set up intelligent flush timer based on highest volume event type (sessions)
    const primaryInterval = this.config.sessions.flushInterval

    this.state.flushTimer = setInterval(() => {
      this._periodicFlush().catch(error => {
        console.error('[Logging] Periodic flush failed:', error)
      })
    }, primaryInterval)
  }

  /**
   * Stop the logging service gracefully
   */
  stop() {
    if (!this.state.isStarted) {
      return
    }

    if (this.state.flushTimer) {
      clearInterval(this.state.flushTimer)
      this.state.flushTimer = null
    }

    this.state.isStarted = false
  }

  /**
   * Analytics Events
   */
  logHit(hitData) {
    if (!this._canAcceptEvents()) return

    this.buffers.hits.push({
      session_key: hitData.session_key,
      user_id: hitData.user_id || null,
      hit_datetime: time(),
      hit_type: hitData.hit_type,
      project_id: hitData.project_id,
      row_id: hitData.row_id || null
    })

    this._updateMetrics('hits')
    this._checkFlushConditions('analytics')
  }

  logDownload(downloadData) {
    if (!this._canAcceptEvents()) return

    this.buffers.downloads.push({
      session_key: downloadData.session_key,
      user_id: downloadData.user_id || null,
      download_datetime: time(),
      download_type: downloadData.download_type,
      project_id: downloadData.project_id,
      row_id: downloadData.row_id || null
    })

    this._updateMetrics('downloads')
    this._checkFlushConditions('analytics')
  }

  /**
   * Session Events
   */
  logSession(sessionData) {
    if (!this._canAcceptEvents()) return

    this.buffers.sessions.push({
      session_key: sessionData.session_key,
      datetime_started: time(),
      ip_addr: sessionData.ip_addr,
      user_agent: sessionData.user_agent
    })

    this._updateMetrics('sessions')
    this._checkFlushConditions('sessions')
  }

  logSessionEnd(sessionEndData) {
    if (!this._canAcceptEvents()) return

    this.buffers.sessionEnds.push({
      session_key: sessionEndData.session_key,
      datetime_ended: time()
    })

    this._updateMetrics('sessionEnds')
    this._checkFlushConditions('sessions')
  }

  /**
   * User Authentication Events
   */
  logLogin(loginData) {
    if (!this._canAcceptEvents()) return

    this.buffers.logins.push({
      session_key: loginData.session_key,
      user_id: loginData.user_id,
      datetime_started: time(),
      ip_addr: loginData.ip_addr,
      user_agent: loginData.user_agent
    })

    // Also queue retroactive analytics update
    this.buffers.analyticsUpdates.push({
      session_key: loginData.session_key,
      user_id: loginData.user_id,
      type: 'login'
    })
    this._updateMetrics('analyticsUpdates')

    this._updateMetrics('logins')
    this._checkFlushConditions('userEvents')
  }

  logLogout(logoutData) {
    if (!this._canAcceptEvents()) return

    this.buffers.logouts.push({
      session_key: logoutData.session_key,
      user_id: logoutData.user_id,
      datetime_ended: time()
    })

    this._updateMetrics('logouts')
    this._checkFlushConditions('userEvents')
  }

  /**
   * Intelligent flush based on event type and urgency
   */
  async _periodicFlush() {
    try {
      await this._flushAllBuffers()
    } catch (error) {
      this._handleFlushError(error)
    }
  }

  /**
   * Check if specific buffer type should be flushed
   */
  _checkFlushConditions(eventType) {
    const config = this.config[eventType]
    if (!config) return

    let shouldFlush = false
    let bufferSize = 0

    // Calculate total buffer size for event type
    switch (eventType) {
      case 'analytics':
        bufferSize = this.buffers.hits.length + this.buffers.downloads.length
        break
      case 'sessions':
        bufferSize = this.buffers.sessions.length + this.buffers.sessionEnds.length
        break
      case 'userEvents':
        bufferSize = this.buffers.logins.length + this.buffers.logouts.length + this.buffers.analyticsUpdates.length
        break
    }

    const timeSinceLastFlush = Date.now() - this.buffers.lastFlush

    // Flush conditions: buffer size OR time threshold
    if (bufferSize >= config.maxSize || timeSinceLastFlush >= config.flushInterval) {
      shouldFlush = true
    }

    if (shouldFlush) {
      // Non-blocking flush
      setImmediate(async () => {
        try {
          await this._flushAllBuffers()
        } catch (error) {
          console.error('[Logging] Background flush failed:', error)
        }
      })
    }
  }

  /**
   * Comprehensive buffer flush with optimized bulk operations
   */
  async _flushAllBuffers() {
    if (this.state.circuitBreakerOpen) {
      return this._handleCircuitBreakerState()
    }

    const startTime = Date.now()
    let totalFlushed = 0
    let hasErrors = false

    // Take snapshots and clear buffers immediately
    const snapshots = this._takeBufferSnapshots()
    if (snapshots.isEmpty) {
      return { flushed: 0, errors: 0 }
    }

    let transaction
    try {
      transaction = await sequelizeConn.transaction()

      // Flush in optimal order: sessions first (foreign key dependencies)
      totalFlushed += await this._flushSessions(snapshots.sessions, transaction)
      totalFlushed += await this._flushAnalytics(snapshots.hits, snapshots.downloads, transaction)
      totalFlushed += await this._flushUserEvents(snapshots.logins, snapshots.logouts, transaction)
      totalFlushed += await this._flushSessionEnds(snapshots.sessionEnds, transaction)
      totalFlushed += await this._flushAnalyticsUpdates(snapshots.analyticsUpdates, transaction)

      await transaction.commit()

      // Update success metrics
      this._recordFlushSuccess(startTime, totalFlushed)
      
      return { flushed: totalFlushed, errors: 0 }

    } catch (error) {
      hasErrors = true
      
      if (transaction) {
        try {
          await transaction.rollback()
        } catch (rollbackError) {
          console.error('[Logging] Transaction rollback failed:', rollbackError)
        }
      }

      // Implement retry logic for failed events
      this._handleFlushFailure(snapshots, error)
      
      return { flushed: 0, errors: totalFlushed }
    }
  }

  /**
   * Take atomic snapshots of all buffers
   */
  _takeBufferSnapshots() {
    const snapshots = {
      hits: [...this.buffers.hits],
      downloads: [...this.buffers.downloads],
      sessions: [...this.buffers.sessions],
      sessionEnds: [...this.buffers.sessionEnds],
      logins: [...this.buffers.logins],
      logouts: [...this.buffers.logouts],
      analyticsUpdates: [...this.buffers.analyticsUpdates]
    }

    // Clear all buffers
    this.buffers.hits = []
    this.buffers.downloads = []
    this.buffers.sessions = []
    this.buffers.sessionEnds = []
    this.buffers.logins = []
    this.buffers.logouts = []
    this.buffers.analyticsUpdates = []
    this.buffers.lastFlush = Date.now()

    // Check if we have any data to flush
    snapshots.isEmpty = Object.values(snapshots)
      .filter(arr => Array.isArray(arr))
      .every(arr => arr.length === 0)

    return snapshots
  }

  /**
   * Optimized bulk insert operations
   */
  async _flushSessions(sessions, transaction) {
    if (sessions.length === 0) return 0

    const values = sessions.map(session => {
      const sessionKey = sequelizeConn.escape(session.session_key)
      const ipAddr = sequelizeConn.escape(session.ip_addr)
      const userAgent = sequelizeConn.escape(session.user_agent)
      return `(${sessionKey}, ${session.datetime_started}, NULL, ${ipAddr}, ${userAgent})`
    }).join(',')

    await sequelizeConn.query(
      `INSERT IGNORE INTO stats_session_log (session_key, datetime_started, datetime_ended, ip_addr, user_agent) 
       VALUES ${values}`,
      { transaction }
    )

    return sessions.length
  }

  async _flushAnalytics(hits, downloads, transaction) {
    let flushed = 0

    if (hits.length > 0) {
      const hitValues = hits.map(hit => {
        const sessionKey = sequelizeConn.escape(hit.session_key)
        const userId = hit.user_id || 'NULL'
        const hitType = sequelizeConn.escape(hit.hit_type)
        return `(${sessionKey}, ${userId}, ${hit.hit_datetime}, ${hitType}, ${hit.project_id}, ${hit.row_id || 'NULL'})`
      }).join(',')

      await sequelizeConn.query(
        `INSERT INTO stats_pub_hit_log (session_key, user_id, hit_datetime, hit_type, project_id, row_id) 
         VALUES ${hitValues}`,
        { transaction }
      )
      flushed += hits.length
    }

    if (downloads.length > 0) {
      const downloadValues = downloads.map(download => {
        const sessionKey = sequelizeConn.escape(download.session_key)
        const userId = download.user_id || 'NULL'
        const downloadType = sequelizeConn.escape(download.download_type)
        return `(${sessionKey}, ${userId}, ${download.download_datetime}, ${downloadType}, ${download.project_id}, ${download.row_id || 'NULL'})`
      }).join(',')

      await sequelizeConn.query(
        `INSERT INTO stats_pub_download_log (session_key, user_id, download_datetime, download_type, project_id, row_id) 
         VALUES ${downloadValues}`,
        { transaction }
      )
      flushed += downloads.length
    }

    return flushed
  }

  async _flushUserEvents(logins, logouts, transaction) {
    let flushed = 0

    if (logins.length > 0) {
      const loginValues = logins.map(login => {
        const sessionKey = sequelizeConn.escape(login.session_key)
        const ipAddr = sequelizeConn.escape(login.ip_addr)
        const userAgent = sequelizeConn.escape(login.user_agent)
        return `(${sessionKey}, ${login.user_id}, ${login.datetime_started}, NULL, ${ipAddr}, ${userAgent})`
      }).join(',')

      await sequelizeConn.query(
        `INSERT INTO stats_login_log (session_key, user_id, datetime_started, datetime_ended, ip_addr, user_agent) 
         VALUES ${loginValues}`,
        { transaction }
      )
      flushed += logins.length
    }

    if (logouts.length > 0) {
      // Batch logout updates
      for (const logout of logouts) {
        await sequelizeConn.query(
          `UPDATE stats_login_log 
           SET datetime_ended = ?
           WHERE session_key = ? AND user_id = ? AND datetime_ended IS NULL
           ORDER BY datetime_started DESC LIMIT 1`,
          {
            replacements: [logout.datetime_ended, logout.session_key, logout.user_id],
            transaction
          }
        )
      }
      flushed += logouts.length
    }

    return flushed
  }

  async _flushSessionEnds(sessionEnds, transaction) {
    if (sessionEnds.length === 0) return 0

    // Batch session end updates
    for (const sessionEnd of sessionEnds) {
      await sequelizeConn.query(
        `UPDATE stats_session_log 
         SET datetime_ended = ?
         WHERE session_key = ? AND datetime_ended IS NULL`,
        {
          replacements: [sessionEnd.datetime_ended, sessionEnd.session_key],
          transaction
        }
      )
    }

    return sessionEnds.length
  }

  async _flushAnalyticsUpdates(updates, transaction) {
    if (updates.length === 0) return 0

    // Group updates by user_id for efficiency
    const updateGroups = updates.reduce((groups, update) => {
      if (!groups[update.user_id]) {
        groups[update.user_id] = []
      }
      groups[update.user_id].push(update.session_key)
      return groups
    }, {})

    let flushed = 0
    for (const [userId, sessionKeys] of Object.entries(updateGroups)) {
      const sessionKeysList = sessionKeys.map(key => sequelizeConn.escape(key)).join(',')

      // Bulk update hits
      await sequelizeConn.query(
        `UPDATE stats_pub_hit_log 
         SET user_id = ? 
         WHERE session_key IN (${sessionKeysList}) AND user_id IS NULL`,
        { replacements: [userId], transaction }
      )

      // Bulk update downloads
      await sequelizeConn.query(
        `UPDATE stats_pub_download_log 
         SET user_id = ? 
         WHERE session_key IN (${sessionKeysList}) AND user_id IS NULL`,
        { replacements: [userId], transaction }
      )

      flushed += sessionKeys.length
    }

    return flushed
  }

  /**
   * Circuit breaker and error handling
   */
  _canAcceptEvents() {
    if (this.buffers.isShuttingDown) {
      console.warn('[Logging] Ignoring event during shutdown')
      return false
    }

    if (this.state.circuitBreakerOpen) {
      // Reject events when circuit breaker is open
      return false
    }

    return true
  }

  _handleFlushError(error) {
    this.state.consecutiveFailures++
    this.metrics.eventsFlushFailures++

    console.error(`[Logging] Flush failure #${this.state.consecutiveFailures}:`, error)

    // Open circuit breaker if threshold reached
    if (this.state.consecutiveFailures >= this.circuitBreaker.failureThreshold) {
      this._openCircuitBreaker()
    }
  }

  _handleFlushFailure(snapshots, error) {
    console.error('[Logging] Failed to flush buffers:', error)

    // Put failed events back into buffers (with limits to prevent memory issues)
    const maxRetryItems = 1000
    if (!this.buffers.isShuttingDown && this.state.isStarted) {
      this.buffers.hits.unshift(...snapshots.hits.slice(0, maxRetryItems))
      this.buffers.downloads.unshift(...snapshots.downloads.slice(0, maxRetryItems))
      this.buffers.sessions.unshift(...snapshots.sessions.slice(0, maxRetryItems))
      this.buffers.logins.unshift(...snapshots.logins.slice(0, maxRetryItems))
      this.buffers.logouts.unshift(...snapshots.logouts.slice(0, maxRetryItems))
      this.buffers.sessionEnds.unshift(...snapshots.sessionEnds.slice(0, maxRetryItems))
      this.buffers.analyticsUpdates.unshift(...snapshots.analyticsUpdates.slice(0, maxRetryItems))
    }

    this._handleFlushError(error)
  }

  _openCircuitBreaker() {
    this.state.circuitBreakerOpen = true
    this.state.circuitBreakerOpenTime = Date.now()
    this.metrics.circuitBreakerTrips++

    console.error('[Logging] ⚠️  Circuit breaker OPEN - rejecting events for', 
                  this.circuitBreaker.recoveryTimeoutMs, 'ms')

    // Set recovery timer
    setTimeout(() => {
      this._attemptCircuitBreakerRecovery()
    }, this.circuitBreaker.recoveryTimeoutMs)
  }

  async _attemptCircuitBreakerRecovery() {
    try {
      // Health check: try a simple database query
      await sequelizeConn.query('SELECT 1', { type: sequelizeConn.QueryTypes.SELECT })
      
      // Success - close circuit breaker
      this.state.circuitBreakerOpen = false
      this.state.circuitBreakerOpenTime = null
      this.state.consecutiveFailures = 0
    } catch (error) {
      console.error('[Logging] Circuit breaker recovery failed:', error)
      // Try again later
      setTimeout(() => {
        this._attemptCircuitBreakerRecovery()
      }, this.circuitBreaker.recoveryTimeoutMs)
    }
  }

  _handleCircuitBreakerState() {
    // When circuit breaker is open, we drop events but don't crash
    console.warn('[Logging] Circuit breaker open - dropping events')
    return { flushed: 0, errors: 0, circuitBreakerOpen: true }
  }

  /**
   * Metrics and monitoring
   */
  _updateMetrics(eventType) {
    this.metrics.eventsBuffered++
    this.state.totalEventsProcessed++
    
    // Track event type counts for volume analysis
    if (this.metrics.eventCounts[eventType] !== undefined) {
      this.metrics.eventCounts[eventType]++
    }

    // Track max buffer size
    const totalBuffered = Object.values(this.buffers)
      .filter(arr => Array.isArray(arr))
      .reduce((sum, arr) => sum + arr.length, 0)
    
    this.metrics.maxBufferSize = Math.max(this.metrics.maxBufferSize, totalBuffered)
  }

  _recordFlushSuccess(startTime, eventsFlushed) {
    const flushTime = Date.now() - startTime
    this.metrics.eventsFlushSuccesses++
    this.state.totalFlushes++
    this.state.consecutiveFailures = 0 // Reset failure count on success

    // Update average flush time (rolling average)
    this.metrics.avgFlushTimeMs = (this.metrics.avgFlushTimeMs + flushTime) / 2
  }

  /**
   * Service monitoring and health checks
   */
  getHealthStatus() {
    const totalBuffered = Object.values(this.buffers)
      .filter(arr => Array.isArray(arr))
      .reduce((sum, arr) => sum + arr.length, 0)

    return {
      status: this.state.circuitBreakerOpen ? 'degraded' : 'healthy',
      isStarted: this.state.isStarted,
      circuitBreaker: {
        isOpen: this.state.circuitBreakerOpen,
        consecutiveFailures: this.state.consecutiveFailures,
        openSince: this.state.circuitBreakerOpenTime,
        trips: this.metrics.circuitBreakerTrips
      },
      buffers: {
        hits: this.buffers.hits.length,
        downloads: this.buffers.downloads.length,
        sessions: this.buffers.sessions.length,
        sessionEnds: this.buffers.sessionEnds.length,
        logins: this.buffers.logins.length,
        logouts: this.buffers.logouts.length,
        analyticsUpdates: this.buffers.analyticsUpdates.length,
        total: totalBuffered,
        lastFlush: new Date(this.buffers.lastFlush).toISOString(),
        timeSinceLastFlush: Date.now() - this.buffers.lastFlush
      },
      metrics: {
        ...this.metrics,
        totalEventsProcessed: this.state.totalEventsProcessed,
        totalFlushes: this.state.totalFlushes,
        uptime: this.state.isStarted ? Date.now() - this.state.lastHealthCheck : 0,
        eventVolumeBreakdown: this.metrics.eventCounts
      }
    }
  }

  /**
   * Manual operations for debugging and monitoring
   */
  async forceFlush() {
    return this._flushAllBuffers()
  }

  getDetailedMetrics() {
    return {
      service: this.getHealthStatus(),
      config: this.config,
      circuitBreakerConfig: this.circuitBreaker
    }
  }

  /**
   * Graceful shutdown with data preservation
   */
  async gracefulShutdown() {
    this.buffers.isShuttingDown = true

    // Stop accepting new events
    this.stop()

    try {
      // Final flush of all remaining events
      const result = await this._flushAllBuffers()
      return result
    } catch (error) {
      console.error('[Logging] Error during graceful shutdown:', error)
      return { flushed: 0, errors: -1 }
    }
  }
}

// Create singleton instance
const loggingService = new LoggingService()

export default loggingService 