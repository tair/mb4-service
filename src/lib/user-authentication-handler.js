import { models } from '../models/init-models.js'
import { getRoles } from '../services/user-roles-service.js'

const EMAIL_PATTERN = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/

/**
 * A class that handles authentication for regular users within the site.
 */
export default class UserAuthenticationHandler {
  canHandle(email) {
    return EMAIL_PATTERN.test(email)
  }

  async handle(email, password) {
    try {
      const user = await models.User.findOne({
        where: { email: email },
      })

      if (!user) {
        const error = new Error('A user with this email could not be found.')
        error.statusCode = 401
        error.response = { message: error.message }
        throw error
      }

      const passwordMatch = await user.validatePassword(password)
      if (!passwordMatch) {
        const error = new Error('Wrong password!')
        error.statusCode = 401
        error.response = { message: error.message }
        throw error
      }

      // Get user access roles using the service
      const access = await getRoles(user.user_id)

      return {
        name: user.getName(),
        email: user.email,
        user_id: user.user_id,
        access: access,
      }
    } catch (error) {
      // Ensure error has proper response format
      if (!error.response) {
        error.response = { message: error.message }
      }
      throw error
    }
  }
}
