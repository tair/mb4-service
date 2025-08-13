import { normalizeJson } from './json.js'
import { MEDIA_PATH, MEDIA_URL_PATH } from './media.js'

export function getDocumentUrl(json, projectId = null, documentId = null) {
  json = normalizeJson(json)
  
  // Handle new S3-based structure
  if (json.s3_key || json.S3_KEY) {
    // For S3-based documents, we return a valid URL if we have the context
    if (projectId && documentId) {
      return `/public/documents/${projectId}/serve/${documentId}`
    }
    // If we don't have context, return a placeholder that indicates S3 storage
    return 'S3_DOCUMENT'
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
