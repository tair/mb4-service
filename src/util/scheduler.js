import cron from 'node-cron'
import { runProjectStatsDump } from '../services/project-stats-dump-service.js'
import config from '../config.js'

/**
 * Wrapper function for scheduled execution of project stats dump
 * Handles logging specific to scheduled runs
 */
async function scheduledProjectStatsDump() {
  try {
    console.log('Scheduled project stats dump triggered at:', new Date().toISOString())
    await runProjectStatsDump()
  } catch (err) {
    console.error('Scheduled project stats dump failed:', err.message)
  }
}

/**
 * Initialize and start the cron scheduler for project stats dumps
 */
export function startScheduler() {
  // Check if scheduler is enabled via environment variable
  const schedulerEnabled = process.env.SCHEDULER_ENABLED !== 'false'
  
  if (!schedulerEnabled) {
    console.log('Project stats dump scheduler is disabled via SCHEDULER_ENABLED environment variable')
    return
  }

  // Run every day at midnight (12:00 AM) Chicago time
  cron.schedule('00 0 * * *', scheduledProjectStatsDump, {
    scheduled: true,
    timezone: 'America/Chicago',
  })

  const bucket = config.aws.defaultBucket
  console.log('Project stats dump scheduler started - will run daily at 12:00 AM (midnight) Chicago time')
  console.log(`Generated files will be saved locally in data/project_stats/ and uploaded to s3://${bucket}/prj_stats/`)
  console.log('Note: This process typically takes ~45 minutes to complete')
}
