import {
  processTasks,
  resetAllFailedTasks,
} from '../services/task-queue-service.js'

export async function process(req, res) {
  await processTasks()
  res.status(200).json({ message: 'Done!' })
}

export async function reset(req, res) {
  await resetAllFailedTasks()
  res.status(200).json({ message: 'Done!' })
}
