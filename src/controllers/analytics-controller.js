import loggingService from '../services/logging-service.js'

// Log a project view using the unified logging service
export async function logProjectView(req, res) {
  try {
    const { project_id, hit_type = 'P', row_id = null } = req.body
    const user_id = req.user?.user_id || req.credential?.user_id
    const session_key = req.sessionInfo?.sessionKey || req.headers['x-session-key']

    if (!session_key || session_key.trim() === '') {
      return res.status(200).json({ message: 'Project view ignored (no session)' })
    }

    if (!project_id) {
      return res.status(400).json({ message: 'project_id is required' })
    }

    // Use logging service to buffer the hit
    loggingService.logHit({
      session_key,
      user_id,
      hit_type,
      project_id,
      row_id
    })

    res.status(200).json({ message: 'Project view logged' })
  } catch (e) {
    console.error('[Analytics] Error logging project view:', e)
    res.status(500).json({ message: 'Failed to log project view' })
  }
}

// Log a download using the unified logging service
export async function logDownload(req, res) {
  try {
    const { project_id, download_type, row_id = null } = req.body
    const user_id = req.user?.user_id || req.credential?.user_id
    const session_key = req.sessionInfo?.sessionKey || req.headers['x-session-key']

    if (!session_key || session_key.trim() === '') {
      return res.status(200).json({ message: 'Download ignored (no session)' })
    }

    if (!project_id || !download_type) {
      return res.status(400).json({ message: 'project_id and download_type are required' })
    }

    // Use logging service to buffer the download
    loggingService.logDownload({
      session_key,
      user_id,
      download_type,
      project_id,
      row_id
    })

    res.status(200).json({ message: 'Download logged' })
  } catch (e) {
    console.error('[Analytics] Error logging download:', e)
    res.status(500).json({ message: 'Failed to log download' })
  }
}

// Export service methods for monitoring and manual operations
export function getBufferStatus() {
  return loggingService.getHealthStatus()
}

export function getDetailedMetrics() {
  return loggingService.getDetailedMetrics()
}

export async function flushAnalyticsBuffer() {
  return loggingService.forceFlush()
}

export async function gracefulShutdown() {
  return loggingService.gracefulShutdown()
}
