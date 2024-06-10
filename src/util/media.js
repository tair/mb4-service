import config from '../config.js'
import { normalizeJson } from './json.js'

const MEDIA_PORT = config.media.port ? `:${config.media.port}` : ''
export const MEDIA_PATH = `${config.media.directory}/${config.app.name}`
export const MEDIA_URL_PATH = `${config.media.scheme}://${config.media.domain}${MEDIA_PORT}/media/${config.app.name}`

export function getMedia(media, version) {
  if (media == null) {
    return undefined
  }

  media = normalizeJson(media)
  const mediaVersion = media[version]
  if (mediaVersion == null) {
    return undefined
  }

  return {
    url: `${MEDIA_URL_PATH}/${mediaVersion['volume']}/${mediaVersion['hash']}/${mediaVersion['magic']}_${mediaVersion['filename']}`,
    width: mediaVersion['width'],
    height: mediaVersion['height'],
  }
}

export function convertMediaTypeFromMimeType(mimeType) {
  switch (mimeType) {
    case 'audio/mpeg':
    case 'audio/x-aiff':
    case 'audio/x-wav':
    case 'audio/x-realaudio':
      return 'audio'
    case 'video/mp4':
    case 'video/quicktime':
    case 'video/x-ms-asf':
    case 'video/x-ms-wmv':
    case 'video/x-flv':
      return 'video'
    case 'application/ply':
    case 'application/stl':
    case 'application/surf':
      return '3d'
    case 'image/gif':
    case 'image/jpg':
    case 'image/jpeg':
    case 'image/png':
    default:
      return 'image'
  }
}
