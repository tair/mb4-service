import { models } from '../models/init-models.js'
import { getRoles } from '../services/user-roles-service.js'

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

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

      // Update last login timestamp
      const currentTimestamp = Math.floor(Date.now() / 1000)
      user.setVar('last_login', currentTimestamp)
      try {
        await user.save({ user: user })
      } catch (saveError) {
        console.error('Failed to update last_login timestamp:', saveError)
        // Continue with login even if timestamp update fails
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
