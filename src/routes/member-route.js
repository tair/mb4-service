import express from 'express'
import * as controller from '../controllers/members-controller.js'

const memberRouter = express.Router({ mergeParams: true })

memberRouter.get('/', controller.getMembers)

export default memberRouter
