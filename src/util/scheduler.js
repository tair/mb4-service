import cron from 'node-cron'
import * as projectsService from '../services/published-projects-service.js'
import * as projectDetailService from '../services/project-detail-service.js'
import * as utilService from './util.js'

const dir = 'data'
const projectStatsDir = 'project_stats'

async function runProjectStatsDump() {
  try {
    console.log('Scheduled project stats dump started at:', new Date().toISOString())

    console.log('Step 1: Fetching projects list...')
    const projects = await projectsService.getProjects()
    console.log(`Step 1 complete: Found ${projects.length} projects`)

    console.log('Step 2: Creating project_stats directory...')
    utilService.createDir(`${dir}/${projectStatsDir}`)
    console.log('Step 2 complete: Directory created')

    console.log('Step 3: Fetching mapping data...')
    const matrixMap = await projectDetailService.getMatrixMap()
    console.log(`Step 3a complete: Matrix map loaded with ${Object.keys(matrixMap).length} entries`)
    
    const folioMap = await projectDetailService.getFolioMap()
    console.log(`Step 3b complete: Folio map loaded with ${Object.keys(folioMap).length} entries`)
    
    const documentMap = await projectDetailService.getDocumentMap()
    console.log(`Step 3c complete: Document map loaded with ${Object.keys(documentMap).length} entries`)

    console.log('Step 4: Processing projects...')
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i]
      const projectId = project.project_id
      
      console.log(`Step 4.${i + 1}: Processing project ${projectId} (${i + 1}/${projects.length})`)
      
      console.log(`  - Fetching project views for project ${projectId}...`)
      const project_views = await projectDetailService.getProjectViews(
        projectId,
        matrixMap,
        folioMap
      )
      console.log(`  - Project views fetched for project ${projectId}`)
      
      console.log(`  - Fetching project downloads for project ${projectId}...`)
      const project_downloads = await projectDetailService.getProjectDownloads(
        projectId,
        matrixMap,
        documentMap
      )
      console.log(`  - Project downloads fetched for project ${projectId}`)

      const projectStats = {
        project_id: projectId,
        project_views: project_views,
        project_downloads: project_downloads,
        generated_at: new Date().toISOString()
      }

      console.log(`  - Writing stats file for project ${projectId}...`)
      await utilService.writeToFile(
        `${dir}/${projectStatsDir}/prj_${projectId}.json`,
        JSON.stringify(projectStats, null, 2)
      )
      console.log(`  - Stats file written for project ${projectId}`)
    }

    console.log('Step 4 complete: All projects processed')
    console.log('Scheduled project stats dump completed at:', new Date().toISOString())
  } catch (err) {
    console.error(`Error during scheduled project stats dump:`, err.message)
    console.error('Error stack:', err.stack)
  }
}

export function startScheduler() {
  // Run every day at 10:01 PM
  cron.schedule('1 22 * * *', runProjectStatsDump, {
    scheduled: true,
    timezone: "America/Chicago"
  })
  
  console.log('Project stats dump scheduler is currently disabled')
}

export { runProjectStatsDump } 