import express from 'express'
import * as controller from '../controllers/tasks-controller.js'

const router = express.Router()

router.get('/process', controller.process)
router.get('/reset', controller.reset)

export default router
