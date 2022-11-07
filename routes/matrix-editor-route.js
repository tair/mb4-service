import express from 'express'
import * as controller from '../controllers/matrix-editor-controller.js'

const router = express.Router({ mergeParams: true })

router.post('/getAvailableTaxa', controller.getAvailableTaxa)
router.post('/addTaxaToMatrix', controller.addTaxaToMatrix)
router.post('/loadTaxaMedia', controller.loadTaxaMedia)
router.post('/removeTaxaFromMatrix', controller.removeTaxaFromMatrix)
router.post('/reorderTaxa', controller.reorderTaxa)
router.post('/setTaxaNotes', controller.setTaxaNotes)
router.post('/setTaxaAccess', controller.setTaxaAccess)

router.post('/getAllCellNotes', controller.getAllCellNotes)
router.post('/getCellCounts', controller.getCellCounts)
router.post('/getCellData', controller.getCellData)
router.post('/getCellMedia', controller.getCellMedia)
router.post('/setCellNotes', controller.setCellNotes)
router.post('/setCellStates', controller.setCellStates)

// General endpoints
router.post('/getMatrixData', controller.getMatrixData)
router.post('/logError', controller.logError)

export default router
