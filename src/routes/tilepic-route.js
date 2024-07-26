import express from 'express'
import * as controller from '../controllers/tilepic-controller.js'

const tilepicRouter = express.Router({ mergeParams: true })

tilepicRouter.get('/', controller.getTilePic)

export default tilepicRouter