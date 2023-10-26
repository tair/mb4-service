import express from 'express'
import * as controller from '../controllers/bibliography-controller.js'

const bibliographyRouter = express.Router({ mergeParams: true })

bibliographyRouter.get('/', controller.getBibliographies)
bibliographyRouter.post('/create', controller.createBibliographies)
bibliographyRouter.post('/delete', controller.deleteBibliographies)
bibliographyRouter.post('/edit', controller.editBibliographies)

bibliographyRouter.get('/:referenceId', controller.getBibliography)
bibliographyRouter.post('/:referenceId/edit', controller.editBibliography)

export default bibliographyRouter
