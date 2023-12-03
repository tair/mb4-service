import {
  processTasks,
  resetAllFailedTasks,
} from '../services/task-queue-service.js'

import { ProjectRecencyStatisticsGenerator } from '../lib/project-recency-generator.js'
import { ProjectOverviewGenerator } from '../lib/project-overview-generator.js'

export async function process(req, res) {
  await processTasks()
  res.status(200).json({ message: 'Done!' })
}

export async function reset(req, res) {
  await resetAllFailedTasks()
  res.status(200).json({ message: 'Done!' })
}

export async function runCronJobs2(req, res) {
  const recencyGenerator = new ProjectRecencyStatisticsGenerator()
  const projects = await recencyGenerator.getOutdatedProjects()
  for (const project of projects) {
    console.time(`Generate P${project.project_id}`)
    await recencyGenerator.generateStats(project.project_id)
    console.timeEnd(`Generate P${project.project_id}`)
  }
  res.status(200).json({ message: 'Done!' })
}

export async function runCronJobs(req, res) {
  try {
    const overviewGenerator = new ProjectOverviewGenerator()
    const projects = await overviewGenerator.getOutdatedProjects()
    for (const project of projects) {
      console.time(`Generate P${project.project_id}`)
      const status = await overviewGenerator.generateStats(project)
      console.timeEnd(`Generate P${project.project_id}`)
    }

    res.status(200).json({ message: 'Done!' })
  } catch (e) {
    console.log(e)
    res.status(500).json({ message: e })
  }
}
