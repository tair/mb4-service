import { DOICreationHandler } from './doi-creation-handler.js'
import { EmailHandler } from './email-handler.js'
import { FileDeletionHandler } from './file-deletion-handler.js'
import { S3FileDeletionHandler } from './s3-file-deletion-handler.js'
import { PartitionPublishHandler } from './partition-publish-handler.js'
import { ProjectDuplicationHandler } from './project-duplication-handler.js'
import { ProjectOverviewGenerationHandler } from './project-overview-generation-handler.js'
import { SDDExportHandler } from './sdd-export-handler.js'
import { MatrixImportHandler } from './matrix-import-handler.js'
import { ORCIDWorksHandler } from './orcid-works-handler.js'

/**
 * Registers a TaskHandler to be processed when the /task endpoint is invoked.
 */
function registerTaskHandler(handler) {
  handlers.set(handler.getName(), handler)
}

export const handlers = new Map()
registerTaskHandler(new DOICreationHandler())
registerTaskHandler(new EmailHandler())
registerTaskHandler(new FileDeletionHandler())
registerTaskHandler(new S3FileDeletionHandler())
registerTaskHandler(new PartitionPublishHandler())
registerTaskHandler(new ProjectDuplicationHandler())
registerTaskHandler(new ProjectOverviewGenerationHandler())
registerTaskHandler(new SDDExportHandler())
registerTaskHandler(new MatrixImportHandler())
registerTaskHandler(new ORCIDWorksHandler())
