import { EmailManager } from '../email-manager.js'
import { Handler } from './handler.js'

/**
 * A handler that will send emails when an action has occurred. This class is
 * useful when transactionality should be perseved. Namely, you want to send an
 * email after a database transaction is completed. This ensures that we
 * guarantee emails are sent and we can retry if there is an error from AWS.
 */
export class EmailHandler extends Handler {
  constructor() {
    super()
    this.emailManager = new EmailManager()
  }

  async process(parameters) {
    try {
      const template = parameters.template
      const { messageId } = await this.emailManager.email(template, parameters)
      return {
        result: {
          sent: true,
          messageId: messageId,
        },
      }
    } catch (e) {
      console.log('Failed to send email', parameters, e)
      return {
        error: {
          message: e.message,
        },
      }
    }
  }

  getName() {
    return 'Email'
  }
}
