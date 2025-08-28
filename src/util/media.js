import config from '../config.js'
import { normalizeJson } from './json.js'
import { MEDIA_TYPES, MEDIA_MIME_TYPES, MEDIA_EXTENSIONS } from './media-constants.js'

const MEDIA_PORT = config.media.port ? `:${config.media.port}` : ''
export const MEDIA_PATH = `${config.media.directory}/${config.app.name}`
export const MEDIA_URL_PATH = `${config.media.scheme}://${config.media.domain}${MEDIA_PORT}/media/${config.app.name}`
export const NEW_MEDIA_URL_PATH = `${config.media.newDomain}/public/media`

export function getMedia(media, version, projectId, mediaId) {
  const mediaVersion = getMediaVersion(media, version)
  if (mediaVersion == null) {
    return undefined
  }

  // For icon and tiny versions, we use the thumbnail endpoint
  if (version == 'icon' || version == 'tiny') {
    return {
      url: `${NEW_MEDIA_URL_PATH}/${projectId}/serve/${mediaId}/thumbnail`,
      width: mediaVersion['width'],
      height: mediaVersion['height'],
    }
  }

  return {
    url: `${NEW_MEDIA_URL_PATH}/${projectId}/serve/${mediaId}/${version}`,
    width: mediaVersion['width'],
    height: mediaVersion['height'],
  }
}

export function getMediaVersion(media, version) {
  if (media == null) {
    return undefined
  }

  media = normalizeJson(media)
  const mediaVersion = media[version]
  return mediaVersion
}

export function convertMediaTypeFromMimeType(mimeType) {
  if (!mimeType) return MEDIA_TYPES.IMAGE
  
  // Check each media type's MIME types
  for (const [mediaType, mimeTypes] of Object.entries(MEDIA_MIME_TYPES)) {
    if (mimeTypes.includes(mimeType)) {
      return mediaType
    }
  }
  
  // Default to image for unknown MIME types
  return MEDIA_TYPES.IMAGE
}

// Helper function to determine media type from file extension when MIME type is ambiguous
export function convertMediaTypeFromExtension(filename) {
  if (!filename) return MEDIA_TYPES.IMAGE
  
  const extension = filename.toLowerCase().split('.').pop()
  
  // Check each media type's extensions
  for (const [mediaType, extensions] of Object.entries(MEDIA_EXTENSIONS)) {
    if (extensions.includes(extension)) {
      return mediaType
    }
  }
  
  // Default to image for unknown extensions
  return MEDIA_TYPES.IMAGE
}
