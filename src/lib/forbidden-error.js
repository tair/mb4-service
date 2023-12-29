import { UserError } from './user-errors.js'

/**
 * An error indicate that the client does not have access rights to the content.
 */
export class ForbiddenError extends UserError {
  getStatus() {
    return 403
  }
}
