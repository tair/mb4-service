const projectsService = require('../services/project-service.js')
const mediaService = require('../services/media-service.js')
const utilService = require('../util/util.js')
const projectDetailService = require('../services/project-detail-service.js')

async function dataDump(req, res) {
  try {
    const projects = await projectsService.getProjects()
    utilService.writeToFile(
      '/Users/trilok/software/code/morphobank/mb4-service/data/projects.json',
      JSON.stringify(projects, null, 2)
    )
    console.log('Dumped project list data - DONE!')

    for (let i = 0; i < projects.length; i++) {
      const project = projects[i]
      console.log(`Dumping data for ${project.project_id}`)
      const project_id = project.project_id
      const media_files = await mediaService.getMediaFiles(project_id)
      const project_details = await projectDetailService.getProjectDetails(project_id)

      await utilService.writeToFile(
        `/Users/trilok/software/code/morphobank/mb4-service/data/prj_details/prj_${project_id}.json`,
        JSON.stringify(project_details, null, 2)
      )
      await utilService.writeToFile(
        `/Users/trilok/software/code/morphobank/mb4-service/data/media_files/prj_${project_id}.json`,
        JSON.stringify(media_files, null, 2)
      )
    }
    console.log('Dump DONE!')

    res.status(200).json('done!')
  } catch (err) {
    console.error(`Error while dumping data. `, err.message)
    res.status(500).json({ message: 'Error while running dump process.' })
  }
}

module.exports = {
  dataDump,
}