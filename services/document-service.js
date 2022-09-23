import sequelizeConn from '../util/db.js';

async function getDocuments(projectId) {
  const [rows] = await sequelizeConn.query(`
      SELECT document_id, folder_id, title
      FROM project_documents 
      WHERE project_id = ?
      ORDER BY title`,
    { replacements: [projectId] }
  )
  return rows
}

export {getDocuments}