import cron from 'node-cron'
import axios from 'axios'
import config from '../config.js'
import CipresRequestService from './cipres-request-service.js'

class SchedulerService {
  constructor() {
    this.jobs = new Map()
    this.isRunning = false
  }

  /**
   * Start the scheduler service
   */
  start() {
    if (this.isRunning) {
      console.log('Scheduler service is already running')
      return
    }

    console.log('Starting scheduler service...')
    this.isRunning = true

    // Schedule CIPRES sync every 5 minutes
    const cipresJob = cron.schedule(
      '*/5 * * * *',
      async () => {
        await this.syncCipresJobs()
      },
      {
        scheduled: true,
        timezone: 'UTC',
      }
    )

    this.jobs.set('cipres-sync', cipresJob)
    console.log('✓ CIPRES sync scheduled to run every 5 minutes')

    // Optional: Add more scheduled tasks here
    // Example: Daily cleanup task
    // const cleanupJob = cron.schedule('0 2 * * *', async () => {
    //   await this.dailyCleanup()
    // }, {
    //   scheduled: true,
    //   timezone: 'UTC'
    // })
    // this.jobs.set('daily-cleanup', cleanupJob)

    console.log('Scheduler service started successfully')
  }

  /**
   * Stop the scheduler service
   */
  stop() {
    if (!this.isRunning) {
      console.log('Scheduler service is not running')
      return
    }

    console.log('Stopping scheduler service...')

    // Stop all scheduled jobs
    for (const [name, job] of this.jobs) {
      job.stop()
      console.log(`✓ Stopped job: ${name}`)
    }

    this.jobs.clear()
    this.isRunning = false
    console.log('Scheduler service stopped')
  }

  /**
   * Get the status of all scheduled jobs
   */
  getStatus() {
    const status = {
      isRunning: this.isRunning,
      jobs: [],
      totalJobs: this.jobs.size,
    }

    for (const [name, job] of this.jobs) {
      status.jobs.push({
        name,
        running: job.running,
        destroyed: job.destroyed,
      })
    }

    return status
  }

  /**
   * Sync CIPRES jobs - called by the scheduler
   */
  async syncCipresJobs() {
    const startTime = Date.now()
    console.log(`[${new Date().toISOString()}] Starting CIPRES sync...`)

    try {
      await CipresRequestService.syncCipresJobs()
      const duration = Date.now() - startTime
      console.log(
        `[${new Date().toISOString()}] CIPRES sync completed successfully in ${duration}ms`
      )
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(
        `[${new Date().toISOString()}] CIPRES sync failed after ${duration}ms:`,
        error.message
      )
    }
  }

  /**
   * Example of another scheduled task
   */
  async dailyCleanup() {
    console.log(`[${new Date().toISOString()}] Running daily cleanup...`)
    // Add cleanup logic here
    console.log(`[${new Date().toISOString()}] Daily cleanup completed`)
  }

  /**
   * Manually trigger a job (useful for testing)
   */
  async triggerJob(jobName) {
    switch (jobName) {
      case 'cipres-sync':
        await this.syncCipresJobs()
        break
      case 'daily-cleanup':
        await this.dailyCleanup()
        break
      default:
        throw new Error(`Unknown job: ${jobName}`)
    }
  }
}

// Create singleton instance
const schedulerService = new SchedulerService()

export default schedulerService
