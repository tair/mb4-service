import { getRoles } from '../services/user-roles-service.js'

/**
 * Get user roles for a given user ID
 * @param {number} userId - The user ID to get roles for
 * @returns {Promise<string[]>} Array of role names
 */
export async function getUserRoles(userId) {
  if (!userId) return []
  return (await getRoles(userId)) || []
}

/**
 * Check if a user has access to unpublished content
 * @param {number} userId - The user ID to check access for
 * @returns {Promise<boolean>} True if user has access to unpublished content
 */
export async function canAccessUnpublishedContent(userId) {
  const userRoles = await getUserRoles(userId)
  return userRoles.includes('curator') || userRoles.includes('admin')
}

/**
 * Get user access information including roles and permissions
 * @param {Object} user - The user object from the request
 * @returns {Promise<Object>} Object containing user roles and access permissions
 */
export async function getUserAccessInfo(user) {
  const userId = user?.user_id
  const userRoles = await getUserRoles(userId)

  return {
    userId,
    roles: userRoles,
    canAccessUnpublished:
      userRoles.includes('curator') || userRoles.includes('admin'),
  }
}
