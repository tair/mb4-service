import express from 'express'
import * as statsController from '../../controllers/stats-controller.js'
import * as dataDumpController from '../../controllers/datadump-controller.js'

const statsRouter = express.Router()

statsRouter.get('/stats_dump', dataDumpController.statsDump)

statsRouter.get(
  '/project_views_last_30d',
  statsController.getProjectViewsForLast30Days
)

statsRouter.get(
  '/media_views_last_30d',
  statsController.getMediaViewsForLast30Days
)

statsRouter.get(
  '/matrix_downloads_last_30d',
  statsController.getMatrixDownloadsForLast30Days
)

statsRouter.get(
  '/doc_downloads_last_30d',
  statsController.getDocDownloadsForLast30Days
)

export default statsRouter
