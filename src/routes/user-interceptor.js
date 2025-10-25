import { models } from '../models/init-models.js'
import { getRoles } from '../services/user-roles-service.js'

/**
 * Authorize that the user that exists and is active.
 */
export async function authorizeUser(req, res, next) {
  // Skip user authorization if the credentials are not present or if the user
  // is anonymous.
  if (!req.credential || req.credential.is_anonymous == true) {
    next()
    return
  }

  const userId = req.credential.user_id
  const user = await models.User.findByPk(userId)
  if (!user) {
    return res.status(404).json({ message: 'User does not exist' })
  }

  if (user.userclass == 255 /* deleted */ || user.active == false) {
    return res.status(404).json({ message: 'User was deleted' })
  }

  req.user = user
  req.user.roles = await getRoles(userId)
  next()
}
