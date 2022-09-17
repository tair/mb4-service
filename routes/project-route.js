const express = require('express')
const router = express.Router()

const isAuth = require('../controllers/auth-controller.js').authenticateToken

const matrixRoute = require('./matrix-route.js')
router.use('/:projectId/matrix', matrixRoute)

module.exports = router