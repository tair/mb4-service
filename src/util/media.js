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
