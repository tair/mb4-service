import { Handler, HandlerErrors } from './handler.js'
import { models } from '../../models/init-models.js'
import { PartitionProjectPublisher } from '../PartitionProjectPublisher.js'

export class PartitionPublishHandler extends Handler {
    constructor() {
        super();
    }

    async process(parameters) {

        const projectId = parseInt(parameters.project_id)
        if (!projectId) {
            return this.createError(
                HandlerErrors.ILLEGAL_PARAMETER,
                'Project ID is not defined'
            )
        }
        
        const project = await models.Project.findByPk(projectId)
        if (project === null) {
            return this.createError(
                HandlerErrors.ILLEGAL_PARAMETER,
                'Project ${projectId} does not exist'
            )
        }

        const userId = parseInt(parameters.user_id)
        if (!userId) {
            return this.createError(
                HandlerErrors.ILLEGAL_PARAMETER,
                'User ID is not defined'
            )
        }

        const user = await models.User.findByPk(userId)
        if (user === null) {
            return this.createError(
                HandlerErrors.ILLEGAL_PARAMETER,
                'User ${userId} does not exist'
            )
        }

        const partitionId = parseInt(parameters.parition_id)
        if (!partitionId) {
            return this.createError(
                HandlerErrors.ILLEGAL_PARAMETER,
                'Partition ID is not defined'
            )
        }

        const partition = await models.Partition.find(partitionId)
        if (partition === null) {
            return this.createError(
                HandlerErrors.ILLEGAL_PARAMETER,
                'Partition ${partitionId} does not exist'
            )
        }

        const newProject = PartitionProjectPublisher.clonePartitionAsNewProject(parameters);
        if (!newProject) {
            return this.createError(
                HandlerErrors.UNKNOWN_ERROR,
                'Could not publish partition ${partitionId} as new project'
            )
        }

        console.log("Parition Publish complete.")
        return {project: newProject}
    }

    getName() {
        return 'Partition Publish'
    }
}

