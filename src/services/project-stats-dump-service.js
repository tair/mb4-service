import * as projectsService from './published-projects-service.js'
import * as projectDetailService from './project-detail-service.js'
import * as utilService from '../util/util.js'
import s3Service from './s3-service.js'
import config from '../config.js'

const dir = 'data'
const projectStatsDir = 'project_stats'

/**
 * Generate and dump project statistics to local filesystem and S3
 * This can be invoked by the scheduler, API endpoints, or manually
 * 
 * @returns {Promise<Object>} Summary of the dump operation
 */
export async function runProjectStatsDump() {
  try {
    console.log(
      'Project stats dump started at:',
      new Date().toISOString()
    )

    const projects = await projectsService.getPublishedProjectIds()
    console.log(`Found ${projects.length} projects to process`)

    utilService.createDir(`${dir}/${projectStatsDir}`)
    
    const matrixMap = await projectDetailService.getMatrixMap()
    const folioMap = await projectDetailService.getFolioMap()
    const documentMap = await projectDetailService.getDocumentMap()

    let s3SuccessCount = 0
    let s3FailureCount = 0
    let localSuccessCount = 0
    let localFailureCount = 0

    for (let i = 0; i < projects.length; i++) {
      const project = projects[i]
      const projectId = project.project_id

      // Progress log every 25 projects
      if (i % 25 === 0 || i === projects.length - 1) {
        console.log(`Processing project ${i + 1}/${projects.length}`)
      }

      try {
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
        
        // Write to local filesystem
        try {
          await utilService.writeToFile(filePath, fileContent)
          localSuccessCount++
        } catch (localError) {
          console.error(`Failed to write local file for project ${projectId}:`, localError.message)
          localFailureCount++
        }

        // Upload to S3
        try {
          const s3Key = `prj_stats/prj_${projectId}.json`
          const bucket = config.aws.defaultBucket
          await s3Service.putObject(
            bucket,
            s3Key,
            Buffer.from(fileContent, 'utf8'),
            'application/json'
          )
          s3SuccessCount++
        } catch (s3Error) {
          console.error(`Failed to upload S3 file for project ${projectId}:`, s3Error.message)
          s3FailureCount++
        }
      } catch (projectError) {
        console.error(`Failed to process project ${projectId}:`, projectError.message)
        localFailureCount++
        s3FailureCount++
      }
    }

    const summary = {
      totalProjects: projects.length,
      local: {
        success: localSuccessCount,
        failure: localFailureCount
      },
      s3: {
        success: s3SuccessCount,
        failure: s3FailureCount
      },
      completedAt: new Date().toISOString()
    }

    console.log(`All ${projects.length} projects processed`)
    console.log(`Local writes: ${localSuccessCount} successful, ${localFailureCount} failed`)
    console.log(`S3 uploads: ${s3SuccessCount} successful, ${s3FailureCount} failed`)
    console.log(
      'Project stats dump completed at:',
      new Date().toISOString()
    )

    return summary
  } catch (err) {
    console.error(`Error during project stats dump:`, err.message)
    console.error('Error stack:', err.stack)
    throw err
  }
}

