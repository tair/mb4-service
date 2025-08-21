import {
  processTasks,
  resetAllFailedTasks,
  resetStuckTasks,
  getFailedTaskDetails
} from '../services/task-queue-service.js'

export async function process(req, res) {
  await processTasks()
  res.status(200).json({ message: 'Done!' })
}

export async function reset(req, res) {
  await resetAllFailedTasks()
  res.status(200).json({ message: 'Done!' })
}

/**
 * Reset tasks stuck in Processing status
 * GET /tasks/reset-stuck
 */
export async function resetStuck(req, res) {
  try {
    const resetCount = await resetStuckTasks()
    res.status(200).json({ 
      message: `Reset ${resetCount} stuck tasks`,
      resetCount 
    })
  } catch (error) {
    console.error('Error resetting stuck tasks:', error)
    res.status(500).json({ 
      error: 'Failed to reset stuck tasks',
      message: error.message 
    })
  }
}

/**
 * Get details of recent failed tasks for debugging
 * GET /tasks/debug-failures
 */
export async function debugFailures(req, res) {
  try {
    const failedTasks = await getFailedTaskDetails()
    res.status(200).json({ 
      message: `Found ${failedTasks.length} recent failed tasks`,
      failedTasks 
    })
  } catch (error) {
    console.error('Error getting failed task details:', error)
    res.status(500).json({ 
      error: 'Failed to get task details',
      message: error.message 
    })
  }
}
