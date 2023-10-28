import sequelizeConn from '../util/db.js'
import { HandlerErrors } from '../lib/task-handlers/handler.js'
import { QueryTypes } from 'sequelize'
import { handlers } from '../lib/task-handlers/init-handlers.js'
import { models } from '../models/init-models.js'
import { time } from '../util/util.js'

export async function processTasks() {
  let rows
  do {
    rows = await sequelizeConn.query(
      'SELECT * FROM ca_task_queue WHERE status = 0 ORDER BY priority, task_id',
      { type: QueryTypes.SELECT }
    )
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
        await sequelizeConn.query(
          `
          UPDATE ca_task_queue 
          SET status = 3, error_code = 500, completed_on = ?
          WHERE task_id = ?`,
          { replacements: [time(), taskId], type: QueryTypes.UPDATE }
        )
        console.log('Unable to get hander', row.handler, ' for task', taskId)
        continue
      }

      try {
        const startTime = Date.now()
        const { result, error } = await handler.process(row.parameters)
        if (result) {
          const processingTime = (Date.now() - startTime) / 60.0
          result.processing_time = Math.round(processingTime).toFixed(3)
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
        console.log('Error processing handler', e)
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
