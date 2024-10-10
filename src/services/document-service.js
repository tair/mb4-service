import sequelizeConn from '../util/db.js'
import { getDocumentUrl } from '../util/document.js'
import { normalizeJson } from '../util/json.js'

// for project detail dump
export async function getDocuments(projectId) {
  const [documentRows] = await sequelizeConn.query(
    `
      SELECT document_id, folder_id, title, description, upload
      FROM project_documents
      WHERE project_id = ?
      ORDER BY title
    `,
    { replacements: [projectId] }
  )

  const [folderRows] = await sequelizeConn.query(
    `
      SELECT folder_id, title, description
      FROM project_document_folders
      WHERE project_id = ?
      ORDER BY title
    `,
    { replacements: [projectId] }
  )

  const downloadMap = await getDocumentsDownloadMap(projectId)

  let documentFolders = {}

  // First, map all folders
  folderRows.forEach((folder) => {
    documentFolders[folder.folder_id] = {
      title: folder.title,
      description: folder.description,
      documents: [], // Array to hold documents under this folder
    }
  })

  // Separate documents with folders and without folders
  let documentsWithoutFolder = []

  // Map documents to their corresponding folders
  documentRows.forEach((document) => {
    const json = normalizeJson(document.upload) ?? {}
    let doc = {
      document_id: document.document_id,
      title: document.title,
      description: document.description,
      file_name: json['original_filename'],
      url: getDocumentUrl(json),
    }

    if (downloadMap[document.document_id]) {
      doc.download = downloadMap[document.document_id]
    }
    if (document.folder_id) {
      // If document has a folder, add it to the corresponding folder
      if (documentFolders[document.folder_id]) {
        documentFolders[document.folder_id].documents.push(doc)
      }
    } else {
      // If no folder, push to documentsWithoutFolder
      documentsWithoutFolder.push(doc)
    }
  })

  // Return the documentFolders and documentsWithoutFolder
  return {
    // Sort folders alphabetically by title
    folders: Object.values(documentFolders).sort((a, b) =>
      a.title.localeCompare(b.title)
    ),
    documents: documentsWithoutFolder,
  }
}

async function getDocumentsDownloadMap(projectId) {
  const [downloads] = await sequelizeConn.query(
    `
      SELECT row_id, count(*) as count
      FROM stats_pub_download_log d
      WHERE d.project_id = ?
      AND d.download_type = 'D'
      GROUP BY d.project_id, d.row_id
    `,
    { replacements: [projectId] }
  )

  // Convert the result to a map where row_id is the key and count is the value
  const downloadMap = downloads.reduce((map, download) => {
    map[download.row_id] = download.count
    return map
  }, {})

  return downloadMap
}
