const express = require('express')
const userController = require('../controllers/user-controller.js')
const isAuth = require('../controllers/auth-controller.js').authenticateToken
const router = express.Router()

router.get('/', isAuth, userController.getUsers)

module.exports = router
