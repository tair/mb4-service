import sequelizeConn from '../util/db.js'

export async function getDocuments(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT document_id, folder_id, title, description
      FROM project_documents 
      WHERE project_id = ?
      ORDER BY title`,
    { replacements: [projectId] }
  )
  return rows
}

export async function getDocumentFolders(projectId) {
  const [rows] = await sequelizeConn.query(
    `
      SELECT folder_id, title, description
      FROM project_documents
      WHERE project_id = ?
      ORDER BY title
    `,
    { replacements: [projectId] }
  )
  return rows
}
