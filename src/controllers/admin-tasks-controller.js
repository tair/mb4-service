import sequelizeConn from '../util/db.js'
import { QueryTypes } from 'sequelize'
import { models } from '../models/init-models.js'
import schedulerService from '../services/scheduler-service.js'
import { time } from '../util/util.js'

// Status constants matching TaskQueue model
const TaskStatus = {
  CREATED: 0,
  PROCESSING: 1,
  COMPLETED: 2,
  FAILED: 3,
}

const STATUS_LABELS = {
  0: 'Created',
  1: 'Processing',
  2: 'Completed',
  3: 'Failed',
}

/**
 * Get task queue summary with counts by status and handler
 * GET /admin/tasks/summary
 */
export async function getTaskSummary(req, res) {
  try {
    const now = Math.floor(Date.now() / 1000)
    const oneDayAgo = now - 86400
    const sevenDaysAgo = now - 86400 * 7
    const thirtyDaysAgo = now - 86400 * 30

    // Get overall status counts
    const statusCounts = await sequelizeConn.query(
      `SELECT status, COUNT(*) as count 
       FROM ca_task_queue 
       GROUP BY status`,
      { type: QueryTypes.SELECT }
    )

    // Get counts by handler and status (last 24 hours for completed/failed)
    const handlerStats = await sequelizeConn.query(
      `SELECT 
        handler,
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 2 AND completed_on >= ? THEN 1 ELSE 0 END) as completed_24h,
        SUM(CASE WHEN status = 3 AND completed_on >= ? THEN 1 ELSE 0 END) as failed_24h,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as completed_total,
        SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) as failed_total
       FROM ca_task_queue 
       GROUP BY handler
       ORDER BY handler`,
      { 
        replacements: [oneDayAgo, oneDayAgo],
        type: QueryTypes.SELECT 
      }
    )

    // Calculate failure rates for different time periods
    const failureRates = await sequelizeConn.query(
      `SELECT 
        'last_24h' as period,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) as failed
       FROM ca_task_queue 
       WHERE completed_on >= ?
       UNION ALL
       SELECT 
        'last_7d' as period,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) as failed
       FROM ca_task_queue 
       WHERE completed_on >= ?
       UNION ALL
       SELECT 
        'last_30d' as period,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) as failed
       FROM ca_task_queue 
       WHERE completed_on >= ?`,
      { 
        replacements: [oneDayAgo, sevenDaysAgo, thirtyDaysAgo],
        type: QueryTypes.SELECT 
      }
    )

    // Get stuck tasks (processing for more than 10 minutes)
    const stuckTasks = await sequelizeConn.query(
      `SELECT task_id, handler, created_on, user_id,
       UNIX_TIMESTAMP(NOW()) - created_on as seconds_stuck
       FROM ca_task_queue 
       WHERE status = 1 AND created_on < UNIX_TIMESTAMP(NOW() - INTERVAL 10 MINUTE)
       ORDER BY created_on ASC`,
      { type: QueryTypes.SELECT }
    )

    // Transform status counts into an object
    const statusSummary = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    }
    statusCounts.forEach((row) => {
      const label = STATUS_LABELS[row.status]?.toLowerCase()
      if (label) {
        statusSummary[label] = parseInt(row.count)
      }
    })

    // Calculate failure rate percentages
    const failureRateData = {}
    failureRates.forEach((row) => {
      const total = parseInt(row.completed || 0) + parseInt(row.failed || 0)
      const rate = total > 0 ? (parseInt(row.failed || 0) / total) * 100 : 0
      failureRateData[row.period] = {
        completed: parseInt(row.completed || 0),
        failed: parseInt(row.failed || 0),
        total,
        rate: parseFloat(rate.toFixed(2)),
      }
    })

    // Transform handler stats
    const handlerData = handlerStats.map((row) => {
      const completed = parseInt(row.completed_24h || 0)
      const failed = parseInt(row.failed_24h || 0)
      const total = completed + failed
      const failureRate = total > 0 ? (failed / total) * 100 : 0

      return {
        handler: row.handler,
        pending: parseInt(row.pending || 0),
        processing: parseInt(row.processing || 0),
        completed24h: completed,
        failed24h: failed,
        completedTotal: parseInt(row.completed_total || 0),
        failedTotal: parseInt(row.failed_total || 0),
        failureRate24h: parseFloat(failureRate.toFixed(2)),
      }
    })

    res.json({
      success: true,
      data: {
        statusSummary,
        handlerStats: handlerData,
        failureRates: failureRateData,
        stuckTasks: stuckTasks.map((t) => ({
          taskId: t.task_id,
          handler: t.handler,
          userId: t.user_id,
          createdOn: t.created_on,
          minutesStuck: Math.round(t.seconds_stuck / 60),
        })),
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error getting task summary:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get task summary',
      error: error.message,
    })
  }
}

/**
 * Get paginated task history with filtering
 * GET /admin/tasks/history
 */
export async function getTaskHistory(req, res) {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = Math.min(parseInt(req.query.limit) || 50, 100)
    const offset = (page - 1) * limit
    const status = req.query.status
    const handler = req.query.handler
    const search = req.query.search

    // Build WHERE clause
    const conditions = []
    const replacements = []

    if (status !== undefined && status !== '') {
      conditions.push('status = ?')
      replacements.push(parseInt(status))
    }

    if (handler) {
      conditions.push('handler = ?')
      replacements.push(handler)
    }

    if (search) {
      conditions.push('(notes LIKE ? OR task_id = ?)')
      replacements.push(`%${search}%`, parseInt(search) || 0)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const [countResult] = await sequelizeConn.query(
      `SELECT COUNT(*) as total FROM ca_task_queue ${whereClause}`,
      { replacements, type: QueryTypes.SELECT }
    )
    const total = parseInt(countResult.total)

    // Get tasks with user info
    const tasks = await sequelizeConn.query(
      `SELECT t.*, u.fname, u.lname, u.email
       FROM ca_task_queue t
       LEFT JOIN ca_users u ON t.user_id = u.user_id
       ${whereClause}
       ORDER BY t.created_on DESC
       LIMIT ? OFFSET ?`,
      { 
        replacements: [...replacements, limit, offset],
        type: QueryTypes.SELECT 
      }
    )

    res.json({
      success: true,
      data: {
        tasks: tasks.map((t) => ({
          taskId: t.task_id,
          userId: t.user_id,
          userName: t.fname && t.lname ? `${t.fname} ${t.lname}` : null,
          userEmail: t.email,
          handler: t.handler,
          status: t.status,
          statusLabel: STATUS_LABELS[t.status],
          priority: t.priority,
          parameters: t.parameters,
          notes: t.notes,
          errorCode: t.error_code,
          createdOn: t.created_on,
          completedOn: t.completed_on,
        })),
        pagination: {
          page,
          limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (error) {
    console.error('Error getting task history:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get task history',
      error: error.message,
    })
  }
}

/**
 * Get recent failures with details
 * GET /admin/tasks/failures
 */
export async function getRecentFailures(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100)

    const failures = await sequelizeConn.query(
      `SELECT t.*, u.fname, u.lname, u.email
       FROM ca_task_queue t
       LEFT JOIN ca_users u ON t.user_id = u.user_id
       WHERE t.status = 3
       ORDER BY t.completed_on DESC
       LIMIT ?`,
      { 
        replacements: [limit],
        type: QueryTypes.SELECT 
      }
    )

    res.json({
      success: true,
      data: {
        failures: failures.map((t) => ({
          taskId: t.task_id,
          userId: t.user_id,
          userName: t.fname && t.lname ? `${t.fname} ${t.lname}` : null,
          userEmail: t.email,
          handler: t.handler,
          priority: t.priority,
          parameters: t.parameters,
          notes: t.notes,
          errorCode: t.error_code,
          createdOn: t.created_on,
          completedOn: t.completed_on,
        })),
      },
    })
  } catch (error) {
    console.error('Error getting recent failures:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get recent failures',
      error: error.message,
    })
  }
}

/**
 * Get CIPRES request status summary
 * GET /admin/tasks/cipres
 */
export async function getCipresStatus(req, res) {
  try {
    // Get status summary
    const statusSummary = await sequelizeConn.query(
      `SELECT 
        cipres_last_status as status,
        COUNT(*) as count
       FROM cipres_requests 
       GROUP BY cipres_last_status
       ORDER BY count DESC`,
      { type: QueryTypes.SELECT }
    )

    // Get recent CIPRES requests
    const recentRequests = await sequelizeConn.query(
      `SELECT cr.*, u.fname, u.lname, u.email, m.title as matrix_title
       FROM cipres_requests cr
       LEFT JOIN ca_users u ON cr.user_id = u.user_id
       LEFT JOIN matrices m ON cr.matrix_id = m.matrix_id
       ORDER BY cr.created_on DESC
       LIMIT 20`,
      { type: QueryTypes.SELECT }
    )

    // Get active (non-completed) jobs for UI display.
    // Note: This filter differs from cipres-request-service.js syncCipresJobs() which
    // excludes ('COMPLETED', 'EXPIRED'). The difference is intentional:
    // - UI (here): excludes FAILED/CANCELLED since they are user-facing terminal states
    // - Sync service: excludes EXPIRED (CIPRES-specific status) but may sync FAILED/CANCELLED
    //   to verify final state from CIPRES API
    const activeJobs = await sequelizeConn.query(
      `SELECT cr.*, u.fname, u.lname, m.title as matrix_title
       FROM cipres_requests cr
       LEFT JOIN ca_users u ON cr.user_id = u.user_id
       LEFT JOIN matrices m ON cr.matrix_id = m.matrix_id
       WHERE cr.cipres_last_status NOT IN ('COMPLETED', 'FAILED', 'CANCELLED')
       ORDER BY cr.created_on DESC`,
      { type: QueryTypes.SELECT }
    )

    res.json({
      success: true,
      data: {
        statusSummary: statusSummary.map((s) => ({
          status: s.status || 'Unknown',
          count: parseInt(s.count),
        })),
        activeJobs: activeJobs.map((j) => ({
          requestId: j.request_id,
          matrixId: j.matrix_id,
          matrixTitle: j.matrix_title,
          userId: j.user_id,
          userName: j.fname && j.lname ? `${j.fname} ${j.lname}` : null,
          jobName: j.jobname,
          cipresJobId: j.cipres_job_id,
          cipresStatus: j.cipres_last_status,
          cipresTool: j.cipres_tool,
          createdOn: j.created_on,
          lastUpdatedOn: j.last_updated_on,
        })),
        recentRequests: recentRequests.map((j) => ({
          requestId: j.request_id,
          matrixId: j.matrix_id,
          matrixTitle: j.matrix_title,
          userId: j.user_id,
          userName: j.fname && j.lname ? `${j.fname} ${j.lname}` : null,
          userEmail: j.email,
          jobName: j.jobname,
          cipresJobId: j.cipres_job_id,
          cipresStatus: j.cipres_last_status,
          cipresTool: j.cipres_tool,
          createdOn: j.created_on,
          lastUpdatedOn: j.last_updated_on,
        })),
      },
    })
  } catch (error) {
    console.error('Error getting CIPRES status:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get CIPRES status',
      error: error.message,
    })
  }
}

/**
 * Get scheduler status with job health
 * GET /admin/tasks/scheduler
 */
export async function getSchedulerStatus(req, res) {
  try {
    const status = schedulerService.getStatus()

    res.json({
      success: true,
      data: {
        scheduler: status,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error getting scheduler status:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get scheduler status',
      error: error.message,
    })
  }
}

/**
 * Retry a failed task
 * POST /admin/tasks/retry/:taskId
 */
export async function retryTask(req, res) {
  try {
    const taskId = parseInt(req.params.taskId)

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID is required',
      })
    }

    // Get the task
    const [task] = await sequelizeConn.query(
      `SELECT * FROM ca_task_queue WHERE task_id = ?`,
      { replacements: [taskId], type: QueryTypes.SELECT }
    )

    if (!task) {
      return res.status(404).json({
        success: false,
        message: `Task ${taskId} not found`,
      })
    }

    if (task.status !== TaskStatus.FAILED) {
      return res.status(400).json({
        success: false,
        message: `Task ${taskId} is not in failed status (current status: ${STATUS_LABELS[task.status]})`,
      })
    }

    // Reset the task to Created status
    await sequelizeConn.query(
      `UPDATE ca_task_queue 
       SET status = 0, error_code = 0, completed_on = NULL, 
           notes = CONCAT('Retried by admin at ', NOW(), '. Previous error: ', COALESCE(notes, ''))
       WHERE task_id = ?`,
      { replacements: [taskId], type: QueryTypes.UPDATE }
    )

    res.json({
      success: true,
      message: `Task ${taskId} has been reset and will be retried`,
    })
  } catch (error) {
    console.error('Error retrying task:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to retry task',
      error: error.message,
    })
  }
}

/**
 * Trigger a scheduler job manually
 * POST /admin/tasks/trigger/:jobName
 */
export async function triggerSchedulerJob(req, res) {
  try {
    const { jobName } = req.params

    const validJobs = ['cipres-sync', 'task-queue', 'stats-cache']
    if (!validJobs.includes(jobName)) {
      return res.status(400).json({
        success: false,
        message: `Invalid job name. Valid jobs: ${validJobs.join(', ')}`,
      })
    }

    await schedulerService.triggerJob(jobName)

    res.json({
      success: true,
      message: `Job '${jobName}' triggered successfully`,
    })
  } catch (error) {
    console.error('Error triggering scheduler job:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to trigger job',
      error: error.message,
    })
  }
}

/**
 * Get available handlers list
 * GET /admin/tasks/handlers
 */
export async function getHandlers(req, res) {
  try {
    const handlers = await sequelizeConn.query(
      `SELECT DISTINCT handler FROM ca_task_queue ORDER BY handler`,
      { type: QueryTypes.SELECT }
    )

    res.json({
      success: true,
      data: {
        handlers: handlers.map((h) => h.handler),
      },
    })
  } catch (error) {
    console.error('Error getting handlers:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to get handlers',
      error: error.message,
    })
  }
}

