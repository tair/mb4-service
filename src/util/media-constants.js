/**
 * Media type constants for consistent usage across the application
 */
export const MEDIA_TYPES = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  MODEL_3D: '3d',
  STACKS: 'stacks'
}

// Supported file extensions by media type
export const MEDIA_EXTENSIONS = {
  [MEDIA_TYPES.VIDEO]: ['mp4', 'mov', 'avi', 'webm', 'mkv', 'wmv', 'flv', 'm4v'],
  [MEDIA_TYPES.MODEL_3D]: ['ply', 'stl', 'obj', 'gltf', 'glb', 'fbx'],
  [MEDIA_TYPES.AUDIO]: ['mp3', 'wav', 'aiff', 'ra'],
  [MEDIA_TYPES.IMAGE]: ['jpg', 'jpeg', 'png', 'gif', 'tif', 'tiff', 'dcm', 'dicom'],
  [MEDIA_TYPES.STACKS]: ['zip']
}

// MIME types by media type
export const MEDIA_MIME_TYPES = {
  [MEDIA_TYPES.VIDEO]: [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/avi',
    'video/webm',
    'video/x-matroska',
    'video/x-ms-wmv',
    'video/x-flv',
    'video/x-m4v'
  ],
  [MEDIA_TYPES.MODEL_3D]: [
    'application/ply',
    'application/stl',
    'model/ply',
    'model/stl',
    'model/obj',
    'model/gltf+json',
    'model/gltf-binary',
    'application/octet-stream'
  ],
  [MEDIA_TYPES.AUDIO]: [
    'audio/mpeg',
    'audio/x-aiff',
    'audio/x-wav',
    'audio/x-realaudio'
  ],
  [MEDIA_TYPES.IMAGE]: [
    'image/gif',
    'image/jpg',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/tif',
    'application/dicom',
    'image/dicom'
  ],
  [MEDIA_TYPES.STACKS]: [
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  ]
}