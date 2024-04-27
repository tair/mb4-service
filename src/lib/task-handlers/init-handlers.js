import { DOICreationHandler } from './doi-creation-handler.js'
import { FileDeletionHandler } from './file-deletion-handler.js'
import { PartitionPublishHandler } from './partition-publish-handler.js'
import { ProjectDuplicationHandler } from './project-duplication-handler.js'
import { ProjectOverviewGenerationHandler } from './project-overview-generation-handler.js'

function registerTaskHandler(handler) {
  handlers.set(handler.getName(), handler)
}

export const handlers = new Map()
registerTaskHandler(new DOICreationHandler())
registerTaskHandler(new FileDeletionHandler())
registerTaskHandler(new PartitionPublishHandler())
registerTaskHandler(new ProjectDuplicationHandler())
registerTaskHandler(new ProjectOverviewGenerationHandler())
