import { models } from '../models/init-models.js'
import { getRoles } from '../services/user-roles-service.js'

/**
 * Authorize that the user that exists and is active.
 */
export async function authorizeUser(req, res, next) {
  const logPrefix = `[USER-AUTH-DEBUG] ${req.method} ${req.path}`
  
  console.log(`${logPrefix} - Starting user authorization check`)
  console.log(`${logPrefix} - Credential present:`, !!req.credential)
  console.log(`${logPrefix} - Is anonymous:`, req.credential?.is_anonymous)
  
  // Skip user authorization if the credentials are not present or if the user
  // is anonymous.
  if (!req.credential || req.credential.is_anonymous == true) {
    console.log(`${logPrefix} - Skipping user authorization (no credential or anonymous)`)
    next()
    return
  }

  const userId = req.credential.user_id
  console.log(`${logPrefix} - Looking up user ID:`, userId)
  
  const user = await models.User.findByPk(userId)
  
  if (!user) {
    console.error(`${logPrefix} - ❌ FAILED: User ${userId} does not exist in database`)
    return res.status(404).json({ message: 'User does not exist' })
  }

  console.log(`${logPrefix} - User found:`, {
    user_id: user.user_id,
    email: user.email,
    userclass: user.userclass,
    active: user.active
  })

  if (user.userclass == 255 /* deleted */ || user.active == false) {
    console.error(`${logPrefix} - ❌ FAILED: User ${userId} is deleted or inactive`)
    return res.status(404).json({ message: 'User was deleted' })
  }

  req.user = user
  req.user.roles = await getRoles(userId)
  
  console.log(`${logPrefix} - ✅ SUCCESS: User authorized with roles:`, req.user.roles)
  next()
}
