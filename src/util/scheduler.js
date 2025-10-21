import cron from 'node-cron'
import * as projectsService from '../services/published-projects-service.js'
import * as projectDetailService from '../services/project-detail-service.js'
import * as utilService from './util.js'
import s3Service from '../services/s3-service.js'

const dir = 'data'
const projectStatsDir = 'project_stats'

async function runProjectStatsDump() {
  try {
    console.log(
      'Scheduled project stats dump started at:',
      new Date().toISOString()
    )

    const projects = await projectsService.getProjects()
    console.log(`Found ${projects.length} projects to process`)

    utilService.createDir(`${dir}/${projectStatsDir}`)
    
    const matrixMap = await projectDetailService.getMatrixMap()
    const folioMap = await projectDetailService.getFolioMap()
    const documentMap = await projectDetailService.getDocumentMap()

    let s3SuccessCount = 0
    let s3FailureCount = 0

    for (let i = 0; i < projects.length; i++) {
      const project = projects[i]
      const projectId = project.project_id

      // Progress log every 25 projects
      if (i % 25 === 0 || i === projects.length - 1) {
        console.log(`Processing project ${i + 1}/${projects.length}`)
      }

      const project_views = await projectDetailService.getProjectViews(
        projectId,
        matrixMap,
        folioMap
      )
      
      const project_downloads = await projectDetailService.getProjectDownloads(
        projectId,
        matrixMap,
        documentMap
      )

      const projectStats = {
        project_id: projectId,
        project_views: project_views,
        project_downloads: project_downloads,
        generated_at: new Date().toISOString(),
      }

      const filePath = `${dir}/${projectStatsDir}/prj_${projectId}.json`
      const fileContent = JSON.stringify(projectStats, null, 2)
      await utilService.writeToFile(filePath, fileContent)

      // Upload to S3
      try {
        const s3Key = `prj_stats/prj_${projectId}.json`
        await s3Service.putObject(
          'mb4-data',
          s3Key,
          Buffer.from(fileContent, 'utf8'),
          'application/json'
        )
        s3SuccessCount++
      } catch (s3Error) {
        console.error(`Failed to upload S3 file for project ${projectId}:`, s3Error.message)
        s3FailureCount++
      }
    }

    console.log(`All ${projects.length} projects processed successfully`)
    console.log(`S3 uploads: ${s3SuccessCount} successful, ${s3FailureCount} failed`)
    console.log(
      'Scheduled project stats dump completed at:',
      new Date().toISOString()
    )
  } catch (err) {
    console.error(`Error during scheduled project stats dump:`, err.message)
    console.error('Error stack:', err.stack)
  }
}

export function startScheduler() {
  // Check if scheduler is enabled via environment variable
  const schedulerEnabled = process.env.SCHEDULER_ENABLED !== 'false'
  
  if (!schedulerEnabled) {
    console.log('Project stats dump scheduler is disabled via SCHEDULER_ENABLED environment variable')
    return
  }

  // Run every day at 10:01 PM (change to 10 for 10:01 AM if needed)
  cron.schedule('00 22 * * *', runProjectStatsDump, {
    scheduled: true,
    timezone: 'America/Chicago',
  })

  console.log('Project stats dump scheduler started - will run daily at `10:00` PM Chicago time')
  console.log('Generated files will be saved locally in data/project_stats/ and uploaded to s3://mb4-data/prj_stats/')
}

export { runProjectStatsDump }
