import { Handler, HandlerErrors } from './handler.js'
import { dumpSingleProject } from '../../services/publishing-service.js'

/**
 * Handler that regenerates the public S3 JSON dumps (details, media, stats)
 * for a published project.
 */
export class ProjectDumpHandler extends Handler {
  async process(parameters) {
    const projectId = parseInt(parameters.project_id)
    if (!projectId) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Project ID is not defined'
      )
    }

    const dumpResult = await dumpSingleProject(projectId)
    if (!dumpResult.success) {
      return this.createError(HandlerErrors.UNKNOWN_ERROR, dumpResult.message)
    }

    return {
      result: {
        project_id: projectId,
        s3_paths: dumpResult.s3Paths,
        time_elapsed: dumpResult.timeElapsed,
      },
    }
  }

  getName() {
    return 'ProjectDump'
  }
}
