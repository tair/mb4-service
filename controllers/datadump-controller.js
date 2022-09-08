import * as projectsService from '../services/projects-service.js';
import * as mediaService from '../services/media-service.js';
import * as utilService from '../util/util.js';
import * as projectDetailService from '../services/project-detail-service.js';

const dir ='data';
const mediaDir = 'media_files';
const detailDir = 'prj_details';

async function dataDump(req, res) {
  try {
    const start = Date.now();
    console.log("Start dumping project data...")

    const projects = await projectsService.getProjects()
    utilService.writeToFile(
      `../${dir}/projects.json`,
      JSON.stringify(projects, null, 2)
    )
    console.log('Dumped project list data - DONE!')

    utilService.createDir(`${dir}/${mediaDir}`)
    utilService.createDir(`${dir}/${detailDir}`)

    console.log("Start dumping project details...")


    for (let i = 0; i < projects.length; i++) {
      const project = projects[i]
      const project_id = project.project_id
      const media_files = await mediaService.getMediaFiles(project_id)
      const project_details = await projectDetailService.getProjectDetails(
        project_id
      )

      await utilService.writeToFile(
        `../${dir}/${detailDir}/prj_${project_id}.json`,
        JSON.stringify(project_details, null, 2)
      )
      await utilService.writeToFile(
        `../${dir}/${mediaDir}/prj_${project_id}.json`,
        JSON.stringify(media_files, null, 2)
      )
    }
    console.log('Dumped project details data - DONE!')
    const end = Date.now();
    let timeElapsed = (end - start) / 1000;
    console.log(`Dump DONE in ${timeElapsed} seconds!`)

    res.status(200).json('done!')
  } catch (err) {
    console.error(`Error while dumping data. `, err.message)
    res.status(500).json({ message: 'Error while running dump process.' })
  }
}

export {dataDump}

