export class Handler {
  /**
   * Processes a task.
   *
   * @param {Object} parameters An object defining the input for this handler.
   */
  async process() {
    throw 'Unimplemented method'
  }

  /**
   * A unique name given to the handlers so that they can be distinctly
   * identified when determining which hanlder to process a task.
   */
  getName() {
    throw 'Unimplemented method'
  }

  /**
   * Create an error object.
   *
   * @param {HandlerErrors} status The error status.
   * @param {string} message The error message.
   * @returns The Error object.
   */
  createError(status, message) {
    console.log(`Error processing ${this.constructor.name}:`, message)
    return {
      error: {
        status,
        message,
      },
    }
  }
}

export const HandlerErrors = {
  NO_ERROR: 0,
  ILLEGAL_PARAMETER: 1,
  HTTP_CLIENT_ERROR: 2,
  UNKNOWN_ERROR: 501,
}
