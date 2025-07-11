import CipresRequestService from '../services/cipres-request-service.js'
import schedulerService from '../services/scheduler-service.js'

/**
 * Sync CIPRES jobs status from the remote CIPRES service
 * This endpoint is typically called by scheduled tasks or cron jobs
 */
export async function syncCipresJobs(req, res) {
  try {
    await CipresRequestService.syncCipresJobs()
    res.json({
      status: 'ok',
      message: 'CIPRES jobs sync completed successfully',
    })
  } catch (error) {
    console.error('Error syncing CIPRES jobs:', error)
    res.status(500).json({
      status: 'error',
      message: 'Failed to sync CIPRES jobs',
      error: error.message,
    })
  }
}

/**
 * Get scheduler status and running jobs
 */
export async function getSchedulerStatus(req, res) {
  try {
    const status = schedulerService.getStatus()
    res.json({
      status: 'ok',
      scheduler: status,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error getting scheduler status:', error)
    res.status(500).json({
      status: 'error',
      message: 'Failed to get scheduler status',
      error: error.message,
    })
  }
}

/**
 * Start the scheduler service
 */
export async function startScheduler(req, res) {
  try {
    schedulerService.start()
    res.json({
      status: 'ok',
      message: 'Scheduler service started successfully',
    })
  } catch (error) {
    console.error('Error starting scheduler:', error)
    res.status(500).json({
      status: 'error',
      message: 'Failed to start scheduler',
      error: error.message,
    })
  }
}

/**
 * Stop the scheduler service
 */
export async function stopScheduler(req, res) {
  try {
    schedulerService.stop()
    res.json({
      status: 'ok',
      message: 'Scheduler service stopped successfully',
    })
  } catch (error) {
    console.error('Error stopping scheduler:', error)
    res.status(500).json({
      status: 'error',
      message: 'Failed to stop scheduler',
      error: error.message,
    })
  }
}

/**
 * Manually trigger a specific job
 */
export async function triggerJob(req, res) {
  try {
    const { jobName } = req.params

    if (!jobName) {
      return res.status(400).json({
        status: 'error',
        message: 'Job name is required',
      })
    }

    await schedulerService.triggerJob(jobName)
    res.json({
      status: 'ok',
      message: `Job '${jobName}' triggered successfully`,
    })
  } catch (error) {
    console.error('Error triggering job:', error)
    res.status(500).json({
      status: 'error',
      message: 'Failed to trigger job',
      error: error.message,
    })
  }
}

/**
 * Health check endpoint for scheduler tasks
 */
export async function healthCheck(req, res) {
  const schedulerStatus = schedulerService.getStatus()
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'scheduler',
    scheduler: schedulerStatus,
  })
}
