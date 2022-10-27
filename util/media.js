const URL_PATH = 'https://morphobank.org/media'

function getMedia(media, version) {
  return {
    url: `${URL_PATH}/${media[version]["HASH"]}/${media[version]["MAGIC"]}_${media[version]["FILENAME"]}`,
    width: media[version]['WIDTH'],
    height: media[version]['HEIGHT'],
  }
}

export {
  getMedia,
}