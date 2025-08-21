import sequelizeConn from '../util/db.js'
import { HandlerErrors } from '../lib/task-handlers/handler.js'
import { QueryTypes } from 'sequelize'
import { handlers } from '../lib/task-handlers/init-handlers.js'
import { models } from '../models/init-models.js'
import { time } from '../util/util.js'

export async function processTasks() {

  
  // FIRST: Reset any stuck tasks before processing
  const resetCount = await resetStuckTasks()
  
  // Then debug what tasks exist in the queue
  const allTasks = await sequelizeConn.query(
    'SELECT task_id, handler, status, priority, user_id, created_on FROM ca_task_queue ORDER BY created_on DESC LIMIT 10',
    { type: QueryTypes.SELECT }
  )
  
  
  allTasks.forEach(task => {
    const statusLabel = { 0: 'Created', 1: 'Processing', 2: 'Completed', 3: 'Failed' }[task.status] || task.status

  })
  
  // Show details of failed ProjectDuplication tasks
  const failedProjectDuplications = await sequelizeConn.query(
    'SELECT task_id, handler, status, error_code, notes, completed_on FROM ca_task_queue WHERE handler = "ProjectDuplication" AND status = 3 ORDER BY completed_on DESC LIMIT 5',
    { type: QueryTypes.SELECT }
  )
  
  if (failedProjectDuplications.length > 0) {
  
    failedProjectDuplications.forEach(task => {


    })
  }
  
  // Check for stuck Processing tasks
  const stuckTasks = await sequelizeConn.query(
    'SELECT task_id, handler, status, created_on FROM ca_task_queue WHERE status = 1 AND created_on < UNIX_TIMESTAMP(NOW() - INTERVAL 5 MINUTE)',
    { type: QueryTypes.SELECT }
  )
  
  if (stuckTasks.length > 0) {

    stuckTasks.forEach(task => {
      const createdDate = new Date(task.created_on * 1000).toISOString()

    })
  }
  
  let rows
  do {
    rows = await sequelizeConn.query(
      'SELECT * FROM ca_task_queue WHERE status = 0 ORDER BY priority, task_id',
      { type: QueryTypes.SELECT }
    )
    

    
    // If no tasks found, let's double-check what happened to recent tasks
    if (rows.length === 0) {
      const recentCreatedTasks = await sequelizeConn.query(
        'SELECT task_id, handler, status, created_on, completed_on, error_code, notes FROM ca_task_queue WHERE created_on > UNIX_TIMESTAMP(NOW() - INTERVAL 2 MINUTE) ORDER BY created_on DESC',
        { type: QueryTypes.SELECT }
      )
      
      if (recentCreatedTasks.length > 0) {
  
        recentCreatedTasks.forEach(task => {
          const statusLabel = { 0: 'Created', 1: 'Processing', 2: 'Completed', 3: 'Failed' }[task.status] || task.status
          const created = new Date(task.created_on * 1000).toISOString()
          const completed = task.completed_on ? new Date(task.completed_on * 1000).toISOString() : 'null'

          
          if (task.status === 3 && task.notes) {

          }
        })
      }
    }
    
    if (rows.length > 0) {

      // Log all pending tasks for visibility
      rows.forEach(row => {

        if (row.handler === 'ProjectDuplication') {

        }
      })
    }
    
    for (const row of rows) {
      const taskId = parseInt(row.task_id)


      // Update the status to PROCESSING from CREATED in an atomic way so that
      // other tasks will not process it while it's being processed.
      const [, updated] = await sequelizeConn.query(
        'UPDATE ca_task_queue SET status = 1 WHERE status = 0 AND task_id = ?',
        { replacements: [taskId], type: QueryTypes.UPDATE }
      )

      if (updated != 1) {

        continue
      }
      


      const handler = handlers.get(row.handler)
      if (handler == null) {
        console.error(`[TASK_QUEUE] ERROR: No handler found for '${row.handler}' in task ${taskId}`)
        console.error(`[TASK_QUEUE] Available handlers:`, Array.from(handlers.keys()))
        await sequelizeConn.query(
          `
          UPDATE ca_task_queue 
          SET status = 3, error_code = 500, completed_on = ?
          WHERE task_id = ?`,
          { replacements: [time(), taskId], type: QueryTypes.UPDATE }
        )

        continue
      }
      


      const startTime = Date.now()  // Move startTime outside try block for scope access
      try {

        
        const { result, error } = await handler.process(row.parameters)
        const processingTime = (Date.now() - startTime) / 1000.0 // Convert to seconds
        
        if (result) {

          result.processing_time = processingTime.toFixed(3)
          await sequelizeConn.query(
            `
            UPDATE ca_task_queue
            SET completed_on = ?, status = 2, notes = ?
            WHERE task_id = ?`,
            {
              replacements: [time(), JSON.stringify(result), taskId],
              type: QueryTypes.UPDATE,
            }
          )

        } else {
          console.error(`[TASK_QUEUE] Task ${taskId} failed after ${processingTime.toFixed(3)}s with error:`, {
            status: error?.status,
            message: error?.message,
            handler: row.handler
          })
          await sequelizeConn.query(
            `
            UPDATE ca_task_queue
            SET completed_on = ?, status = 3, error_code = ?, notes = ?
            WHERE task_id = ?`,
            {
              replacements: [time(), error.status, error.message, taskId],
              type: QueryTypes.UPDATE,
            }
          )

        }
      } catch (e) {
        const processingTime = (Date.now() - startTime) / 1000.0
        console.error(`[TASK_QUEUE] EXCEPTION in task ${taskId} after ${processingTime.toFixed(3)}s:`, {
          error: e.message,
          stack: e.stack,
          handler: row.handler,
          taskId,
          parameters: row.parameters
        })
        await sequelizeConn.query(
          `
          UPDATE ca_task_queue
          SET completed_on = ?, status = 3, error_code = ?, notes = ?
          WHERE task_id = ?`,
          {
            replacements: [
              time(),
              HandlerErrors.UNKNOWN_ERROR,
              e.message,
              taskId,
            ],
            type: QueryTypes.UPDATE,
          }
        )

      }
    }
  } while (rows.length > 0)
  

}

/**
 * Resets error status of failed task so it can be run again on the next queue
 * run.
 */
export function retryFailedTask(taskId, transaction) {
  const task = models.TaskQueue.findByPk(taskId)
  if (task == null) {
    return false
  }

  // An error code of zero indicates that it didn't error out, so we don't have
  // to retry it.
  if (task.error_code == 0) {
    return false
  }

  task.status = 0
  task.error_code = 0
  task.completed_on = null
  task.update({ transaction: transaction })

  return true
}

export async function resetAllFailedTasks() {
  await sequelizeConn.query(`
    UPDATE ca_task_queue
    SET completed_on = NULL, status = 0, error_code = 0, notes = ''
    WHERE status = 3`)
}

/**
 * Reset tasks that are stuck in Processing status for too long
 * This handles deadlocks and zombie processes
 */
export async function resetStuckTasks() {

  
  // Find tasks stuck in Processing for more than 10 minutes
  const stuckTasks = await sequelizeConn.query(
    `SELECT task_id, handler, created_on, 
     UNIX_TIMESTAMP(NOW()) - created_on as seconds_stuck 
     FROM ca_task_queue 
     WHERE status = 1 AND created_on < UNIX_TIMESTAMP(NOW() - INTERVAL 10 MINUTE)`,
    { type: QueryTypes.SELECT }
  )
  
  if (stuckTasks.length > 0) {

    
    for (const task of stuckTasks) {
      const minutesStuck = Math.round(task.seconds_stuck / 60)

    }
    
    // Reset stuck tasks back to Created status
    const [, updated] = await sequelizeConn.query(
      `UPDATE ca_task_queue 
       SET status = 0, notes = CONCAT('Reset from stuck Processing status at ', NOW()), error_code = 0
       WHERE status = 1 AND created_on < UNIX_TIMESTAMP(NOW() - INTERVAL 10 MINUTE)`,
      { type: QueryTypes.UPDATE }
    )
    

    return updated
  } else {

    return 0
  }
}

/**
 * Get detailed information about failed tasks for debugging
 */
export async function getFailedTaskDetails() {

  
  const failedTasks = await sequelizeConn.query(
    `SELECT task_id, handler, status, error_code, notes, created_on, completed_on 
     FROM ca_task_queue 
     WHERE status = 3 AND handler = 'ProjectDuplication'
     ORDER BY completed_on DESC LIMIT 5`,
    { type: QueryTypes.SELECT }
  )
  

  
  failedTasks.forEach(task => {
    const created = new Date(task.created_on * 1000).toISOString()
    const completed = task.completed_on ? new Date(task.completed_on * 1000).toISOString() : 'null'
    


 



  })
  
  return failedTasks
}
