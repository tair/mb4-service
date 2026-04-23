import { models } from '../models/init-models.js'
import {
  hasArticleAuthorsFilter,
  isUserListedInArticleAuthors,
  parseArticleAuthorSegments,
} from '../util/article-authors-eligibility.js'

/**
 * Placeholder DataCite `creator` when the project has no `article_authors` value.
 */
export const DOI_PLACEHOLDER_CREATOR_NAME = 'No authors available'

/**
 * Build the creators array for DataCite DOI metadata.
 *
 * When `article_authors` is empty or missing: a single creator
 * {@link DOI_PLACEHOLDER_CREATOR_NAME} (no project members).
 *
 * When `article_authors` is set: one creator per parsed segment in order; members
 * match by name on each segment and get ORCIDs when allowed; non-matching segments
 * are name-only (external authors).
 *
 * @param {Object} project - Project model instance
 * @returns {Promise<Array<{ name: string, orcid?: string }>>}
 */
export async function buildAuthorsWithOrcid(project) {
  const rawArticleAuthors = project.article_authors

  if (!hasArticleAuthorsFilter(rawArticleAuthors)) {
    return [{ name: DOI_PLACEHOLDER_CREATOR_NAME }]
  }

  const segments = parseArticleAuthorSegments(rawArticleAuthors)
  if (segments.length === 0) {
    return [{ name: DOI_PLACEHOLDER_CREATOR_NAME }]
  }

  return creatorsFromAuthorSegments(project, segments)
}

/**
 * @param {Object} project
 * @param {string[]} segments
 */
async function creatorsFromAuthorSegments(project, segments) {
  const memberships = await models.ProjectsXUser.findAll({
    where: { project_id: project.project_id },
    attributes: ['user_id', 'orcid_publish_opt_out'],
    raw: true,
  })

  let orderedUsers = []
  const projectOptOuts = new Set()

  if (memberships.length === 0) {
    const owner = await models.User.findByPk(project.user_id, {
      attributes: [
        'user_id',
        'fname',
        'lname',
        'orcid',
        'orcid_opt_out',
      ],
      raw: true,
    })
    if (owner) {
      const pxu = await models.ProjectsXUser.findOne({
        where: { project_id: project.project_id, user_id: owner.user_id },
        attributes: ['orcid_publish_opt_out'],
        raw: true,
      })
      if (pxu?.orcid_publish_opt_out) {
        projectOptOuts.add(owner.user_id)
      }
      orderedUsers = [owner]
    }
  } else {
    const userIds = memberships.map((m) => m.user_id)
    for (const m of memberships) {
      if (m.orcid_publish_opt_out) {
        projectOptOuts.add(m.user_id)
      }
    }
    const users = await models.User.findAll({
      where: { user_id: userIds },
      attributes: ['user_id', 'fname', 'lname', 'orcid', 'orcid_opt_out'],
      raw: true,
    })
    const userMap = new Map(users.map((u) => [u.user_id, u]))
    orderedUsers = userIds
      .map((id) => userMap.get(id))
      .filter(Boolean)
  }

  const out = []
  const usedUserIds = new Set()

  for (const segment of segments) {
    const s = (segment && String(segment).trim()) || ''
    if (!s) {
      continue
    }
    let matched = null
    for (const u of orderedUsers) {
      if (usedUserIds.has(u.user_id)) {
        continue
      }
      if (isUserListedInArticleAuthors(u, s)) {
        matched = u
        usedUserIds.add(u.user_id)
        break
      }
    }
    if (matched) {
      out.push(
        creatorForMemberAndCitationName(
          matched,
          s,
          projectOptOuts.has(matched.user_id)
        )
      )
    } else {
      out.push({ name: s })
    }
  }

  return out.filter((c) => c.name)
}

function creatorForMemberAndCitationName(
  user,
  citationName,
  orcidProjectOptOut
) {
  const name = (citationName && citationName.trim()) || displayNameForUser(user)
  if (!name) {
    return { name: '' }
  }
  if (user?.orcid && !orcidProjectOptOut && !user.orcid_opt_out) {
    return { name, orcid: user.orcid }
  }
  return { name }
}

function displayNameForUser(user) {
  return `${user.fname || ''} ${user.lname || ''}`.trim()
}
