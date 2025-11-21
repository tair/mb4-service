import config from '../config.js'
import { normalizeJson } from './json.js'
import { MEDIA_TYPES, MEDIA_MIME_TYPES, MEDIA_EXTENSIONS } from './media-constants.js'

const MEDIA_PORT = config.media.port ? `:${config.media.port}` : ''
export const MEDIA_PATH = `${config.media.directory}/${config.app.name}`
export const MEDIA_URL_PATH = `${config.media.scheme}://${config.media.domain}${MEDIA_PORT}/media/${config.app.name}`
export const NEW_MEDIA_URL_PATH = `${config.media.newDomain}/public/media`

export function getMedia(media, version, projectId, mediaId) {
  // Try to obtain the requested version's metadata for width/height
  let mediaVersion = getMediaVersion(media, version)

  // For small variants, gracefully fall back to thumbnail metadata when missing
  if (mediaVersion == null && (version === 'icon' || version === 'tiny' || version === 'thumbnail')) {
    mediaVersion = getMediaVersion(media, 'thumbnail')
  }

  // As an additional fallback, try large for dimensions if thumbnail is also missing
  if (mediaVersion == null) {
    mediaVersion = getMediaVersion(media, 'large')
  }

  // If dimensions are still unavailable, provide safe defaults to avoid crashes
  const width = (mediaVersion && mediaVersion['width']) || 256
  const height = (mediaVersion && mediaVersion['height']) || 256

  // For icon and tiny versions, we use the thumbnail endpoint
  if (version == 'icon' || version == 'tiny') {
    return {
      url: `${NEW_MEDIA_URL_PATH}/${projectId}/serve/${mediaId}/thumbnail`,
      width,
      height,
    }
  }

  return {
    url: `${NEW_MEDIA_URL_PATH}/${projectId}/serve/${mediaId}/${version}`,
    width,
    height,
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
