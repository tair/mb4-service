/**
 * This class defines errors that result from user mistakes. HTTP responses from
 * Error should return a 400 to indicate to the client that the server cannot or
 * will not process the request due to something that is perceived to be a
 * client error.
 */
export class UserError extends Error {
  constructor(message) {
    super(message)
  }

  /**
   * @returns a number to be used as a HTTP status.
   */
  getStatus() {
    return 400
  }
}
