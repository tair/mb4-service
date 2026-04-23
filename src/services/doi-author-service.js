import { models } from '../models/init-models.js'
import {
  hasArticleAuthorsFilter,
  isUserListedInArticleAuthors,
  parseArticleAuthorSegments,
} from '../util/article-authors-eligibility.js'

/**
 * Build a creators array for DataCite DOI metadata.
 *
 * When `article_authors` is set: one creator per parsed author in publication order
 * (including non–MorphoBank authors as name-only). Project members are only used when
 * their first or last name matches that author segment; then ORCID is added when
 * allowed (same as before).
 *
 * When `article_authors` is empty: all project members in membership order; if there
 * are no membership rows, the project owner.
 *
 * @param {Object} project - Project model instance
 * @returns {Array<{name: string, orcid?: string}>} Creators with optional ORCIDs
 */
export async function buildAuthorsWithOrcid(project) {
  const rawArticleAuthors = project.article_authors

  if (!hasArticleAuthorsFilter(rawArticleAuthors)) {
    return buildFromMembersUnfiltered(project)
  }

  const segments = parseArticleAuthorSegments(rawArticleAuthors)
  if (segments.length === 0) {
    return buildFromMembersUnfiltered(project)
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

/** @param {Object} project */
async function buildFromMembersUnfiltered(project) {
  const memberships = await models.ProjectsXUser.findAll({
    where: { project_id: project.project_id },
    attributes: ['user_id', 'orcid_publish_opt_out'],
    raw: true,
  })

  if (memberships.length === 0) {
    const owner = await models.User.findByPk(project.user_id)
    if (!owner) {
      return []
    }
    const c = creatorForMemberAndCitationName(
      owner,
      displayNameForUser(owner),
      false
    )
    return c.name ? [c] : []
  }

  const userIds = memberships.map((m) => m.user_id)
  const users = await models.User.findAll({
    where: { user_id: userIds },
    attributes: ['user_id', 'fname', 'lname', 'orcid', 'orcid_opt_out'],
    raw: true,
  })
  const projectOptOuts = new Set(
    memberships.filter((m) => m.orcid_publish_opt_out).map((m) => m.user_id)
  )
  const userMap = new Map(users.map((u) => [u.user_id, u]))
  return userIds
    .map((id) => userMap.get(id))
    .filter(Boolean)
    .map((u) =>
      creatorForMemberAndCitationName(
        u,
        displayNameForUser(u),
        projectOptOuts.has(u.user_id)
      )
    )
    .filter((c) => c.name)
}

/**
 * Citation / display name in DOI: use the publication segment when the author is also a member;
 * unfiltered path still uses the account "First Last" name.
 * @param {Object} user
 * @param {string} citationName
 * @param {boolean} orcidProjectOptOut
 * @returns {{ name: string, orcid?: string }}
 */
function creatorForMemberAndCitationName(
  user,
  citationName,
  orcidProjectOptOut
) {
  const name = (citationName && citationName.trim()) || displayNameForUser(user)
  if (!name) {
    return { name: '' }
  }
  if (
    user?.orcid &&
    !orcidProjectOptOut &&
    !user.orcid_opt_out
  ) {
    return { name, orcid: user.orcid }
  }
  return { name }
}

/**
 * @param {Object} user
 * @returns {string}
 */
function displayNameForUser(user) {
  return `${user.fname || ''} ${user.lname || ''}`.trim()
}
