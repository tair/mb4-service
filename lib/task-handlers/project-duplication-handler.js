import { models } from '../../models/init-models.js'
import sequelizeConn from '../../util/db.js'
import { Handler, HandlerErrors } from './handler.js'

/** A handler to duplicating projects. */
export class ProjectDuplicationHandler extends Handler {
  async process(parameters) {
    const transaction = await sequelizeConn.transaction()

    const requestId = parseInt(parameters.request_id)
    const projectDuplicationRequest =
      await models.ProjectDuplicationRequest.findByPk(requestId)
    if (projectDuplicationRequest == null) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Duplication request ${requestId} not found'
      )
    }

    if (projectDuplicationRequest.status != 50) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Duplication request ${requestId} not approved'
      )
    }

    const userId = projectDuplicationRequest.user_id
    const projectId = projectDuplicationRequest.project_id

    const user = await models.User.findByPk(userId)
    if (user == null) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'User with ID ${userId} does not exist'
      )
    }

    const project = await models.Project.findByPk(projectId)
    if (project == null) {
      return this.createError(
        HandlerErrors.ILLEGAL_PARAMETER,
        'Project with ID ${projectId} doest not exist'
      )
    }

    /* This is where we will instantiate the BaseModelDuplicator class and call the functions to
    duplicate the project. */

    return {
      result: {
        vn_cloned_project_id: parameters.request_id,
      },
    }
  }

  getName() {
    return 'ProjectDuplication'
  }
}
