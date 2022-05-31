const sequelize = require('../util/db.js')

async function getDocumentFolders(project_id) {
  const [rows, metadata] = await sequelize.query(
    `select folder_id, title 
      from project_document_folders 
      where project_id=${project_id} order by title`
  )
  return rows
}

async function getDocumentByFolderId(project_id, folder_id) {
  const [rows, metadata] = await sequelize.query(
    `select document_id, title from project_documents
      where project_id=${project_id} and folder_id=${folder_id}`
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
