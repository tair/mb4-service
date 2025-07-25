import sequelizeConn from '../util/db.js'
import BibliographicReference from '../models/bibliographic-reference.js'

// for project detail dump
export async function getBibliographiesDetails(projectId) {
  const rows = await getBibliographiesByProjectId(projectId)
  return rows.map((row) => {
    return {
      title: BibliographicReference.getCitationText(row, null),
    }
  })
}

export async function getBibliographiesByProjectId(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT *
      FROM bibliographic_references
      WHERE project_id = ? `,
    { replacements: [projectId] }
  )
  return rows
}

export async function getBibliographiesByGroupId(groupId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT br.*
      FROM bibliographic_references AS br
      INNER JOIN projects AS p ON p.project_id = br.project_id
      WHERE p.group_id = ?`,
    { replacements: [groupId] }
  )
  return rows
}

export async function getBibliographiesByIds(referenceIds) {
  // If no reference IDs provided, return empty array to avoid SQL syntax error
  if (!referenceIds || referenceIds.length === 0) {
    return []
  }

  const [rows] = await sequelizeConn.query(
    `
      SELECT *
      FROM bibliographic_references
      WHERE reference_id IN (?) `,
    { replacements: [referenceIds] }
  )
  return rows
}

export async function getBibliography(projectId, referenceId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT *
      FROM bibliographic_references
      WHERE project_id = ? AND reference_id = ?`,
    { replacements: [projectId, referenceId] }
  )
  return rows
}

export async function getMediaIds(referenceId, mediaIds) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT media_id
      FROM media_files_x_bibliographic_references
      WHERE reference_id = ? AND media_id IN (?)`,
    { replacements: [referenceId, mediaIds] }
  )
  return rows
}

export async function getTaxaIds(referenceId, taxaIds) {
  // If no taxa IDs provided, return empty array to avoid SQL syntax error
  if (!taxaIds || taxaIds.length === 0) {
    return []
  }

  const [rows] = await sequelizeConn.query(
    `
      SELECT taxon_id
      FROM taxa_x_bibliographic_references
      WHERE reference_id = ? AND taxon_id IN (?)`,
    { replacements: [referenceId, taxaIds] }
  )
  return rows
}
