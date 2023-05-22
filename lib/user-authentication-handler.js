import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { models } from '../models/init-models.js'

const EMAIL_PATTERN = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/

/**
 * A class that handles authentication for regular users within the site.
 */
export default class UserAuthenticationHandler {
  canHandle(email) {
    return EMAIL_PATTERN.test(email)
  }

  async handle(email, password) {
    const user = await models.User.findOne({
      where: { email: email },
    })

    if (!user) {
      const error = new Error('A user with this email could not be found.')
      error.statusCode = 401
      throw error
    }

    const passwordHash = crypto.createHash('md5').update(password).digest('hex')

    // The password stored in the MorphoBank database uses the password_hash
    // and password_verify methods which use the Crypt algorithm instead. To
    // make this compatible with the Bcrypt algorithm, we replace the algorithm
    // part of the string, as suggested by:
    // https://stackoverflow.com/questions/23015043
    const storedPassword = user.password_hash.replace('$2y$', '$2a$')

    const passwordMatch = await bcrypt.compare(passwordHash, storedPassword)
    if (!passwordMatch) {
      const error = new Error('Wrong password!')
      error.statusCode = 401
      throw error
    }

    return {
      name: user.getName(),
      email: user.email,
      user_id: user.user_id,
    }
  }
}
