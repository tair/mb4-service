import { normalizeJson } from './json.js'
import { MEDIA_PATH, MEDIA_URL_PATH } from './media.js'

export function getDocumentUrl(json) {
  json = normalizeJson(json)
  if (!json['filename']) {
    return null
  }
  return MEDIA_URL_PATH + getPartialPath(json)
}

export function getDocumentPath(json) {
  json = normalizeJson(json)
  if (!json['filename']) {
    return null
  }
  return MEDIA_PATH + getPartialPath(json)
}

function getPartialPath(json) {
  return `/${json['volume']}/${json['hash']}/${json['magic']}_${json['filename']}`
}
