import express from 'express'
import * as controller from '../controllers/tasks-controller.js'

const router = express.Router()

router.get('/process', controller.process)
router.get('/reset', controller.reset)
router.get('/reset-stuck', controller.resetStuck)
router.get('/debug-failures', controller.debugFailures)

export default router
