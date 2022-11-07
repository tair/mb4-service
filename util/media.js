import config from '../config.js'

const MEDIA_PORT = config.media.port ? `:${config.media.port}` : ''
const URL_PATH = `${config.media.scheme}://${config.media.domain}${MEDIA_PORT}/media/MorphoBank/images`

function getMedia(media, version) {
  return {
    url: `${URL_PATH}/${media[version]['HASH']}/${media[version]['MAGIC']}_${media[version]['FILENAME']}`,
    width: media[version]['WIDTH'],
    height: media[version]['HEIGHT'],
  }
}

export { getMedia }
