import * as mediaService from '../services/media-service.js';

async function getMediaFiles(req, res) {
  const projectId = req.params.id

  try {
    const media_files = await mediaService.getMediaFiles(projectId)
    res.status(200).json(media_files)
  } catch (err) {
    console.error(`Error: Cannot media files for ${projectId}`, err)
    res.status(500).json({ message: 'Error while fetching media files.' })
  }
}

export {getMediaFiles}