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

// Cell specific endpoints
router.post('/addCellCitations', controller.addCellCitations)
router.post('/addCellMedia', controller.addCellMedia)
router.post('/fetchCellsData', controller.fetchCellsData)
router.post('/findCitation', controller.findCitation)
router.post('/getAllCellNotes', controller.getAllCellNotes)
router.post('/getCellCitations', controller.getCellCitations)
router.post('/getCellCounts', controller.getCellCounts)
router.post('/getCellData', controller.getCellData)
router.post('/getCellMedia', controller.getCellMedia)
router.post('/removeCellCitation', controller.removeCellCitation)
router.post('/removeCellMedia', controller.removeCellMedia)
router.post('/setCellNotes', controller.setCellNotes)
router.post('/setCellStates', controller.setCellStates)
router.post('/upsertCellCitation', controller.upsertCellCitation)

// General endpoints
router.post('/getMatrixData', controller.getMatrixData)
router.post('/logError', controller.logError)

// Search endpoints
router.post('/searchCells', controller.searchCells)
router.post('/searchCharacters', controller.searchCharacters)
router.post('/searchTaxa', controller.searchTaxa)

export default router
