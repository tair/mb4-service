import sequelizeConn from '../util/db.js'

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

export async function getBibliographiesByMediaId(mediaIds) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT reference_id
      FROM media_files_x_bibliographic_references
      WHERE media_id IN (?)`,
    { replacements: [mediaIds] }
  )
  return rows
}

export async function getBibliographiesByIds(referenceIds) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT *
      FROM bibliographic_references
      WHERE reference_id IN (?) `,
    { replacements: [referenceIds] }
  )
  return rows
}
