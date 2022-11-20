import sequelizeConn from '../util/db.js'
import { getCitationText } from '../util/citation.js'

async function getBibliography(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT reference_id, article_title, journal_title, authors, vol, pubyear,
          collation
      FROM bibliographic_references
      WHERE project_id = ? `,
    { replacements: [projectId] }
  )
  return rows
}

async function getBibliographicAuthorsForId(referenceId, typeCode) {
  const [rows] = await sequelizeConn.query(
    `SELECT * FROM bibliographic_authors WHERE reference_id = ? AND typecode IN (?)`,
    { replacements: [referenceId, typeCode] }
  )
  return rows
}

async function getTextForBibliographicReference(citation) {
  const authors = []
  const editors = []
  const people = await getBibliographicAuthorsForId(
    citation.reference_id,
    [0, 1, 2]
  )
  for (const author of people) {
    if (author.typecode == 0 || author.typecode == 1) {
      authors.push(author)
    } else if (author.typecode == 2) {
      editors.push(author)
    }
  }

  return getCitationText(citation, authors, editors)
}

export {
  getTextForBibliographicReference,
  getBibliographicAuthorsForId,
  getBibliography,
}
