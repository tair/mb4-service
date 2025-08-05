import { normalizeJson } from './json.js'
import { MEDIA_PATH, MEDIA_URL_PATH } from './media.js'

export function getDocumentUrl(json) {
  json = normalizeJson(json)
  
  // Handle new S3-based structure
  if (json.s3_key || json.S3_KEY) {
    // For S3-based documents, we use the serving endpoint that constructs the S3 path
    // The serveDocumentFile function will handle the S3 retrieval
    // We can't return the direct S3 URL here since we don't have project_id/document_id context
    return null // Let the frontend use the download endpoint instead
  }
  
  // Handle legacy local file structure
  if (!json['filename']) {
    return null
  }
  return MEDIA_URL_PATH + getPartialPath(json)
}

export function getDocumentPath(json) {
  json = normalizeJson(json)
  
  // Handle new S3-based structure  
  if (json.s3_key || json.S3_KEY) {
    // For S3-based documents, return null since we don't have local paths
    return null
  }
  
  // Handle legacy local file structure
  if (!json['filename']) {
    return null
  }
  return MEDIA_PATH + getPartialPath(json)
}

function getPartialPath(json) {
  return `/${json['volume']}/${json['hash']}/${json['magic']}_${json['filename']}`
}
