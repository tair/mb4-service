import { runProjectStatsDump } from '../services/project-stats-dump-service.js'

// Track the status of the last/current stats dump run
let lastRunStatus = {
  running: false,
  startedAt: null,
  completedAt: null,
  summary: null,
  error: null
}

/**
 * HTTP endpoint to manually trigger project stats dump
 * Returns immediately and runs the dump process in the background
 * This is the same operation that runs on the scheduled cron job
 */
export async function triggerProjectStatsDump(req, res) {
  try {
    // Check if a dump is already running
    if (lastRunStatus.running) {
      return res.status(409).json({
        success: false,
        message: 'Project stats dump is already running',
        startedAt: lastRunStatus.startedAt,
        statusUrl: '/public/stats/project_stats_dump_s3/status'
      })
    }
    
    console.log('Manual project stats dump triggered via API')
    
    // Update status to running
    lastRunStatus = {
      running: true,
      startedAt: new Date().toISOString(),
      completedAt: null,
      summary: null,
      error: null
    }
    
    // Return immediate response
    res.status(202).json({
      success: true,
      message: 'Project stats dump started in background',
      note: 'This process typically takes ~45 minutes to complete. Check server logs for progress or use the status endpoint.',
      estimatedDuration: '~45 minutes',
      startedAt: lastRunStatus.startedAt,
      statusUrl: '/public/stats/project_stats_dump_s3/status'
    })
    
    // Run the stats dump in background (don't await)
    setImmediate(async () => {
      try {
        console.log('Background project stats dump process started')
        const summary = await runProjectStatsDump()
        
        // Update status on success
        lastRunStatus = {
          running: false,
          startedAt: lastRunStatus.startedAt,
          completedAt: new Date().toISOString(),
          summary: {
            totalProjects: summary.totalProjects,
            localWrites: {
              successful: summary.local.success,
              failed: summary.local.failure
            },
            s3Uploads: {
              successful: summary.s3.success,
              failed: summary.s3.failure
            }
          },
          error: null
        }
        
        console.log('Background project stats dump completed successfully:', lastRunStatus.summary)
      } catch (err) {
        // Update status on error
        lastRunStatus = {
          running: false,
          startedAt: lastRunStatus.startedAt,
          completedAt: new Date().toISOString(),
          summary: null,
          error: err.message
        }
        
        console.error('Background project stats dump failed:', err.message)
        console.error('Stack trace:', err.stack)
      }
    })
    
  } catch (err) {
    console.error('Error triggering project stats dump:', err.message)
    
    res.status(500).json({
      success: false,
      message: 'Failed to trigger project stats dump',
      error: err.message
    })
  }
}

/**
 * Get the status of the current or last project stats dump run
 */
export async function getProjectStatsDumpStatus(req, res) {
  try {
    const response = {
      running: lastRunStatus.running,
      startedAt: lastRunStatus.startedAt,
      completedAt: lastRunStatus.completedAt
    }
    
    if (lastRunStatus.running) {
      response.message = 'Project stats dump is currently running'
      response.estimatedTimeRemaining = 'Up to 45 minutes from start time'
    } else if (lastRunStatus.completedAt) {
      if (lastRunStatus.error) {
        response.success = false
        response.message = 'Last project stats dump failed'
        response.error = lastRunStatus.error
      } else if (lastRunStatus.summary) {
        response.success = true
        response.message = 'Last project stats dump completed successfully'
        response.summary = lastRunStatus.summary
      } else {
        response.message = 'No dump has been run yet'
      }
    } else {
      response.message = 'No dump has been run yet'
    }
    
    res.status(200).json(response)
  } catch (err) {
    console.error('Error getting project stats dump status:', err.message)
    res.status(500).json({
      success: false,
      message: 'Failed to get status',
      error: err.message
    })
  }
}

