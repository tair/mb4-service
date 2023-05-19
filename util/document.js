import config from '../config.js'
import { normalizeJson } from './json.js'

const MEDIA_PATH = '/media/MorphoBank'
const MEDIA_PORT = config.media.port ? `:${config.media.port}` : ''
const URL_PATH = `${config.media.scheme}://${config.media.domain}${MEDIA_PORT}${MEDIA_PATH}`

export function getDocumentUrl(json) {
  if (!json['filename']) {
    return null
  }
  json = normalizeJson(json)
  return URL_PATH + getPartialPath(json)
}

export function getDocumentPath(json) {
  if (!json['filename']) {
    return null
  }
  return MEDIA_PATH + getPartialPath(json)
}

function getPartialPath(json) {
  return `/${json['volume']}/${json['hash']}/${json['magic']}_${json['filename']}`
}
