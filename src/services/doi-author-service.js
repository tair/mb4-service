import { models } from '../models/init-models.js'

/**
 * Build a creators array from project members for DataCite DOI metadata.
 * Each member's name is included, and their ORCID is attached if they have one
 * and they haven't opted out of ORCID publishing.
 *
 * @param {Object} project - Project model instance
 * @returns {Array<{name: string, orcid?: string}>} Creators with optional ORCIDs
 */
export async function buildAuthorsWithOrcid(project) {
  const memberships = await models.ProjectsXUser.findAll({
    where: { project_id: project.project_id },
    attributes: ['user_id', 'orcid_publish_opt_out'],
    raw: true,
  })

  if (memberships.length === 0) {
    // Fallback to project owner
    const owner = await models.User.findByPk(project.user_id)
    if (owner) {
      const creator = buildCreator(owner)
      return creator.name ? [creator] : []
    }
    return []
  }

  const userIds = memberships.map((m) => m.user_id)
  const users = await models.User.findAll({
    where: { user_id: userIds },
    attributes: ['user_id', 'fname', 'lname', 'orcid', 'orcid_opt_out'],
    raw: true,
  })

  // Build a set of users who opted out at the project level
  const projectOptOuts = new Set(
    memberships.filter((m) => m.orcid_publish_opt_out).map((m) => m.user_id)
  )

  // Preserve membership order (important for academic author ordering)
  const userMap = new Map(users.map((u) => [u.user_id, u]))
  return userIds
    .map((id) => userMap.get(id))
    .filter(Boolean)
    .map((user) => buildCreator(user, projectOptOuts.has(user.user_id)))
    .filter((c) => c.name)
}

function buildCreator(user, optedOut = false) {
  const name = `${user.fname || ''} ${user.lname || ''}`.trim()
  if (user.orcid && !optedOut && !user.orcid_opt_out) {
    return { name, orcid: user.orcid }
  }
  return { name }
}
