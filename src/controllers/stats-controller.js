import * as statsService from '../services/published-stats-service.js'

export async function getProjectViewsForLast30Days(req, res) {
  try {
    const result = await statsService.getProjectViewsForLast30Days()
    res.status(200).json(result)
  } catch (e) {
    console.error(
      'Error while getting Project Views For Last 30 Days (controller).',
      e
    )
    res.status(500).json({
      message: 'Error while fetching Project Views For Last 30 Days.',
    })
  }
}

export async function getMediaViewsForLast30Days(req, res) {
  try {
    const result = await statsService.getMediaViewsForLast30Days()
    res.status(200).json(result)
  } catch (e) {
    console.error(
      'Error while getting Media Views For Last 30 Days (controller).',
      e
    )
    res.status(500).json({
      message: 'Error while fetching Media Views For Last 30 Days.',
    })
  }
}

export async function getMatrixDownloadsForLast30Days(req, res) {
  try {
    const result = await statsService.getMatrixDownloadsForLast30Days()
    res.status(200).json(result)
  } catch (e) {
    console.error(
      'Error while getting Matrix downloads For Last 30 Days (controller).',
      e
    )
    res.status(500).json({
      message: 'Error while fetching Matrix downloads For Last 30 Days.',
    })
  }
}

export async function getDocDownloadsForLast30Days(req, res) {
  try {
    const result = await statsService.getDocDownloadsForLast30Days()
    res.status(200).json(result)
  } catch (e) {
    console.error(
      'Error while getting Doc downloads For Last 30 Days (controller).',
      e
    )
    res.status(500).json({
      message: 'Error while fetching Doc downloads For Last 30 Days.',
    })
  }
}
