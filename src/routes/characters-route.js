import express from 'express'
import * as controller from '../controllers/characters-controller.js'

const characterRouter = express.Router({ mergeParams: true })

characterRouter.get('/', controller.getCharacters)

export default characterRouter
