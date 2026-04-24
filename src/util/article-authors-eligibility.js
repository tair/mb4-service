/**
 * Shared rules for "is this project member credited on the publication author line?"
 * Used by ORCID works, DOI metadata (when `article_authors` is set), and publishing UI.
 * When `article_authors` is empty, `doi-author-service` uses a placeholder instead.
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
 * When true, the publication `article_authors` line is non-empty; used e.g. to filter
 * ORCID work pushes and (with {@link parseArticleAuthorSegments}) DOI creator building.
 *
 * @param {string|null|undefined} articleAuthorsRaw
 * @returns {boolean}
 */
export function hasArticleAuthorsFilter(articleAuthorsRaw) {
  return (articleAuthorsRaw || '').trim().length > 0
}

/**
 * Best-effort list of individual author name strings in publication order.
 * Splits on: semicolons, newlines, the word " and " (e.g. "A and B"), and commas
 * (e.g. "Y. Mao, W. I. Ausich" → two authors). A single "Surname, Given" with no
 * other commas is still split; use a semicolon to keep one byline that contains commas.
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
    .flatMap((part) => part.split(/,\s+/))
    .map((s) => s.trim())
    .filter(Boolean)
}
