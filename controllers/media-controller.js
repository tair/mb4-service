import * as mediaService from '../services/media-service.js';
import {readFile} from '../util/util.js';

async function getMediaFiles(req, res) {
  const projectId = req.params.id
  // ///////////////////////////////////////////////////
  // const data = await readFile(
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

export {getMediaFiles}
