import express from 'express'
import * as statsController from '../../controllers/stats-controller.js'
import * as dataDumpController from '../../controllers/datadump-controller.js'
import * as projectStatsDumpController from '../../controllers/project-stats-dump-controller.js'

const statsRouter = express.Router()

statsRouter.get('/stats_dump', dataDumpController.statsDump)
// Legacy endpoint - local dump only (deprecated, kept for backwards compatibility)
statsRouter.get('/project_stats_dump', dataDumpController.projectStatsDump)
// New endpoint - local dump + S3 upload for project stats (runs in background)
statsRouter.get('/project_stats_dump_s3', projectStatsDumpController.triggerProjectStatsDump)
// Status endpoint - check progress of project stats dump
statsRouter.get('/project_stats_dump_s3/status', projectStatsDumpController.getProjectStatsDumpStatus)

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
