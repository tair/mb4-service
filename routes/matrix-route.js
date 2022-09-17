const express = require('express')
const router = express.Router()

const matrixController = require('../controllers/matrix-controller.js')

router.get('/project/:id/matrix', matrixController.getMatrices)

module.exports = router