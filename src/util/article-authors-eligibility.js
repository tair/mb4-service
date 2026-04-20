/**
 * Shared rules for "is this project member credited on the publication author line?"
 * Used by DOI metadata, ORCID works, and publishing UI — keep behavior aligned here.
 *
 * Matching is case-insensitive; a user qualifies if their first or last name appears
 * as a substring of article_authors (same idea as the legacy SQL LOCATE checks).
 */

/**
 * @param {{ fname?: string|null, lname?: string|null }} user
 * @param {string|null|undefined} articleAuthorsRaw
 * @returns {boolean}
 */
export function isUserListedInArticleAuthors(user, articleAuthorsRaw) {
  const articleAuthors = (articleAuthorsRaw || '').toLowerCase()
  const fname = (user.fname || '').toLowerCase()
  const lname = (user.lname || '').toLowerCase()
  return (
    (fname && articleAuthors.includes(fname)) ||
    (lname && articleAuthors.includes(lname))
  )
}

/**
 * When false, DOI treats all members as creators (legacy / requires at least one creator).
 * When true, only users passing {@link isUserListedInArticleAuthors} are included.
 *
 * @param {string|null|undefined} articleAuthorsRaw
 * @returns {boolean}
 */
export function hasArticleAuthorsFilter(articleAuthorsRaw) {
  return (articleAuthorsRaw || '').trim().length > 0
}
