import express from 'express'
import * as controller from '../controllers/members-controller.js'
import { upload } from './upload.js'

const memberRouter = express.Router({ merge: true })

memberRouter.get('/', controller.getMembers)

export default memberRouter