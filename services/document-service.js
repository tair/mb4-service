const sequelize = require('../util/db.js')

async function getDocumentFolders(projectId) {
  const [rows] = await sequelize.query(`
      SELECT folder_id, title 
      FROM project_document_folders 
      WHERE project_id = ?
      ORDER BY title`,
    { replacements: [projectId] }
  )
  return rows
}

async function getDocuments(projectId) {
  const [rows] = await sequelize.query(`
      SELECT document_id, folder_id, title
      FROM project_documents 
      WHERE project_id = ?
      ORDER BY title`,
    { replacements: [projectId] }
  )
  return rows
}

async function getDocumentByFolderId(projectId, folderId) {
  const [rows] = await sequelize.query(`
      SELECT document_id, title
      FROM project_documents
      WHERE project_id = ? and folder_id = ?`,
    { replacements: [projectId, folderId] }
  )
  return rows
}

async function getDocuments(project_id) {
  const folders = await getDocumentFolders(project_id)

  let result = []
  for (let n = 0; n < folders.length; n++) {
    let fld = folders[n]
    fld.docs = await getDocumentByFolderId(project_id, fld.folder_id)
    result.push(fld)
  }
  return result
}

module.exports = {
  getDocuments,
}
