const mediaService = require('../services/media-service.js')
const utilService = require('../util/util.js')

exports.getMediaFiles = async function (req, res) {
  const projectId = req.params.id
  // ///////////////////////////////////////////////////
  // const data = await utilService.readFile(
  //   `/Users/trilok/software/code/morphobank/mb4-service/data/media_files/prj_${projectId}.json`
  // )
  // res.json(data)
  // return
  // ///////////////////////////////////////////////////

  try {
    const media_files = await mediaService.getMediaFiles(projectId)
    res.status(200).json(media_files)
  } catch (err) {
    console.error(
      `Error while getting media files for ${projectId} `,
      err.message
    )
    res.status(500).json({ message: 'Error while fetching media files.' })
  }
}
