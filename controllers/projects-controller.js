const projectsService = require('../services/projects-service.js')
const utilService = require('../util/util.js')
const projectDetailService = require('../services/project-detail-service.js')

exports.getProjects = async function (req, res, next) {
  ///////////////////////////////////////////////////
  // const data = await utilService.readFile(
  //   '/Users/trilok/software/code/morphobank/mb4-service/data/projects.json'
  // )
  // res.status(200).json(data)
  // return
  // ///////////////////////////////////////////////////

  try {
    const projects = await projectsService.getProjects()
    res.status(200).json(projects)
  } catch (err) {
    console.error(`Error while getting projects list.`, err.message)
    res.status(500).json({ message: 'Error while fetching project list.' })
  }
}

exports.getProjectsById = async function (req, res) {
  const projectId = req.params.id
  ///////////////////////////////////////////////////
  // const data = await utilService.readFile(
  //   `/Users/trilok/software/code/morphobank/mb4-service/data/prj_details/prj_${projectId}.json`
  // )
  // res.status(200).json(data)
  // return
  // ///////////////////////////////////////////////////

  try {
    const result = await projectDetailService.getProjectDetails(projectId)
    res.status(200).json(result)
  } catch (err) {
    console.error(
      `Error while getting project details (controller). `,
      err.message
    )
    res.status(500).json({ message: 'Error while fetching project details.' })
  }
}
