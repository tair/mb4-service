import { DOICreationHandler } from './doi-creation-handler.js'
import { FileDeletionHandler } from './file-deletion-handler.js'
import { ProjectDuplicationHandler } from './project-duplication-handler.js'

function registerTaskHandler(hander) {
  handlers.set(hander.getName(), hander)
}

const handlers = new Map()
registerTaskHandler(new DOICreationHandler())
registerTaskHandler(new FileDeletionHandler())
registerTaskHandler(new ProjectDuplicationHandler())

export { handlers }
