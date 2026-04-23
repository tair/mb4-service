/**
 * Shared rules for "is this project member credited on the publication author line?"
 * Used by DOI metadata, ORCID works, and publishing UI — keep behavior aligned here.
 *
 * Matching is case-insensitive; a user qualifies if their first or last name appears
 * as a substring of article_authors (same idea as the legacy SQL LOCATE checks).
 */

/**
 * First or last name of `user` appears in the string (case-insensitive substring).
 * Pass the full `article_authors` line, or a single {@link parseArticleAuthorSegments}
 * segment, to test membership against that slice of the byline.
 *
 * @param {{ fname?: string|null, lname?: string|null }} user
 * @param {string|null|undefined} articleAuthorsOrSegment
 * @returns {boolean}
 */
export function isUserListedInArticleAuthors(user, articleAuthorsOrSegment) {
  const haystack = (articleAuthorsOrSegment || '').toLowerCase()
  const fname = (user.fname || '').toLowerCase()
  const lname = (user.lname || '').toLowerCase()
  return (
    (fname && haystack.includes(fname)) || (lname && haystack.includes(lname))
  )
}

/**
 * When true, the publication author line is present; DOI creators are derived from that
 * string (see `parseArticleAuthorSegments` / `doi-author-service.js`).
 *
 * @param {string|null|undefined} articleAuthorsRaw
 * @returns {boolean}
 */
export function hasArticleAuthorsFilter(articleAuthorsRaw) {
  return (articleAuthorsRaw || '').trim().length > 0
}

/**
 * Best-effort list of individual author name strings in publication order.
 * Splits on semicolons, newlines, and " and ".
 *
 * @param {string|null|undefined} articleAuthorsRaw
 * @returns {string[]}
 */
export function parseArticleAuthorSegments(articleAuthorsRaw) {
  const text = (articleAuthorsRaw || '').trim()
  if (!text) {
    return []
  }
  return text
    .split(/(?:\s*;\s*|\n+)/)
    .flatMap((part) => part.split(/\s+and\s+/i))
    .map((s) => s.trim())
    .filter(Boolean)
}
