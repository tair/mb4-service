const express = require('express')
const router = express.Router({ mergeParams: true })

const matrixController = require('../controllers/matrix-controller.js')
const matrixEditorController = require('../controllers/matrix-editor-controller.js')

router.get('/', matrixController.getMatrices)

router.get('/:matrixId/getMatrixData', matrixEditorController.getMatrixData)

module.exports = router