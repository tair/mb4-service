import config from '../config.js'

const MEDIA_PORT = config.media.port ? `:${config.media.port}` : ''
const URL_PATH = `${config.media.scheme}://${config.media.domain}${MEDIA_PORT}/media/MorphoBank/images`

function getMedia(media, version) {
  if (media == null) {
    return undefined
  }

  const mediaVersion = media[version]
  if (mediaVersion == null) {
    return undefined
  }

  return {
    url: `${URL_PATH}/${mediaVersion['HASH']}/${mediaVersion['MAGIC']}_${mediaVersion['FILENAME']}`,
    width: mediaVersion['WIDTH'],
    height: mediaVersion['HEIGHT'],
  }
}

export { getMedia }
