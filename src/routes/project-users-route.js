import express from 'express'
import * as controller from '../controllers/project-users-controller.js'

const projectUsersRouter = express.Router({ mergeParams: true })

projectUsersRouter.get('/', controller.getProjectUsers)

export default projectUsersRouter
