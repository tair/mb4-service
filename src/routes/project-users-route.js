import express from 'express'
import * as controller from '../controllers/project-users-controller.js'

const projectUsersRouter = express.Router({ mergeParams: true })

projectUsersRouter.get('/', controller.getProjectUsers)
projectUsersRouter.post('/create', controller.createUser)
projectUsersRouter.post('/delete', controller.deleteUser)
projectUsersRouter.post('/isEmailAvailable', controller.isEmailAvailable)
projectUsersRouter.post('/:linkId/edit', controller.editUser)

export default projectUsersRouter
