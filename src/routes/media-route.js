import express from 'express'
import * as controller from '../controllers/media-controller.js'
import mediaLabelsRouter from './media-labels-route.js'
import { upload } from './upload.js'

const mediaRouter = express.Router({ mergeParams: true })

mediaRouter.get('/', controller.getMediaFiles)
mediaRouter.get('/filter/ids', controller.getFilterMediaIds)
mediaRouter.get('/download/filenames', controller.downloadFilenames)

mediaRouter.post('/delete', controller.deleteMediaFiles)
mediaRouter.post('/edit', controller.editMediaFiles)

mediaRouter.post('/create', upload.single('file'), controller.createMediaFile)
mediaRouter.post(
  '/create/batch',
  upload.single('file'),
  controller.createMediaFiles
)
mediaRouter.post('/create/3d', upload.single('file'), controller.create3DMediaFile)
mediaRouter.post('/create/video', upload.single('file'), controller.createVideoMediaFile)
mediaRouter.post('/create/stacks', upload.single('file'), controller.createStacksMediaFile)

// Direct-to-S3 upload routes for large CT scan files (bypasses proxy timeouts)
mediaRouter.post('/stacks/initiate', controller.initiateStacksUpload)
// Complete accepts optional thumbnail file extracted in browser (avoids backend downloading entire ZIP)
mediaRouter.post('/stacks/:mediaId/complete', upload.single('thumbnail'), controller.completeStacksUpload)

mediaRouter.get('/:mediaId', controller.getMediaFile)
mediaRouter.get('/:mediaId/details', controller.getMediaFileDetails)
mediaRouter.post(
  '/:mediaId/edit',
  upload.single('file'),
  controller.editMediaFile
)

mediaRouter.get('/:mediaId/citations', controller.getCitations)
mediaRouter.post('/:mediaId/citations/create', controller.createCitation)
mediaRouter.post(
  '/:mediaId/citations/:citationId/edit',
  controller.editCitation
)
mediaRouter.post('/:mediaId/citations/delete', controller.deleteCitations)

// Document linking for copyright (media_files_x_documents)
mediaRouter.get('/:mediaId/document', controller.getMediaDocument)
mediaRouter.post('/:mediaId/document', controller.setMediaDocument)
mediaRouter.delete('/:mediaId/document', controller.removeMediaDocument)

// Bulk apply copyright - query related media
mediaRouter.get('/:mediaId/related/by-specimen', controller.getRelatedMediaBySpecimen)
mediaRouter.get('/:mediaId/related/by-citations', controller.getRelatedMediaByCitations)

// Bulk apply copyright settings
mediaRouter.post('/:mediaId/copyright/apply', controller.applyCopyrightToMedia)
mediaRouter.post('/:mediaId/copyright-holder/apply', controller.applyCopyrightHolderToMedia)

// This is a sub-route focused on /media/<media ID>/labels
mediaRouter.use('/:mediaId/labels', mediaLabelsRouter)

export default mediaRouter
