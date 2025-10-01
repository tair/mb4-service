import express from 'express'
import * as controller from '../controllers/bibliography-controller.js'
import fileUpload from 'express-fileupload'
import { requireEntityEditPermission, EntityType } from '../lib/auth-middleware.js'

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
bibliographyRouter.post('/create', requireEntityEditPermission(EntityType.BIBLIOGRAPHY), controller.createBibliographies)
bibliographyRouter.post('/delete', requireEntityEditPermission(EntityType.BIBLIOGRAPHY), controller.deleteBibliographies)
bibliographyRouter.post('/edit', requireEntityEditPermission(EntityType.BIBLIOGRAPHY), controller.editBibliographies)
bibliographyRouter.post('/search', controller.search)
bibliographyRouter.post('/check-citations', controller.checkCitations)
bibliographyRouter.post('/upload', requireEntityEditPermission(EntityType.BIBLIOGRAPHY), controller.uploadEndNoteXML)
bibliographyRouter.get('/export', controller.exportEndNoteAsTabFile)

bibliographyRouter.get('/:referenceId', controller.getBibliography)
bibliographyRouter.post('/:referenceId/edit', requireEntityEditPermission(EntityType.BIBLIOGRAPHY), controller.editBibliography)

export default bibliographyRouter
