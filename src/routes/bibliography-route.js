import express from 'express'
import * as controller from '../controllers/bibliography-controller.js'
import fileUpload from 'express-fileupload'

const bibliographyRouter = express.Router({ mergeParams: true })

// Add file upload middleware
bibliographyRouter.use(
  fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
    useTempFiles: true,
    tempFileDir: '/tmp/',
  })
)

bibliographyRouter.get('/', controller.getBibliographies)
bibliographyRouter.post('/create', controller.createBibliographies)
bibliographyRouter.post('/delete', controller.deleteBibliographies)
bibliographyRouter.post('/edit', controller.editBibliographies)
bibliographyRouter.post('/search', controller.search)
bibliographyRouter.post('/upload', controller.uploadEndNoteXML)

bibliographyRouter.get('/:referenceId', controller.getBibliography)
bibliographyRouter.post('/:referenceId/edit', controller.editBibliography)

export default bibliographyRouter
