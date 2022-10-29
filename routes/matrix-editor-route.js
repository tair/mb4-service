import express from 'express';
import * as matrixEditorController from '../controllers/matrix-editor-controller.js';

const matrixEditorRouter = express.Router({ mergeParams: true })

// Taxa related endpoints.
matrixEditorRouter.post('/addTaxonMedia', matrixEditorController.addTaxonMedia)
matrixEditorRouter.post('/addTaxaToMatrix', matrixEditorController.addTaxaToMatrix)
matrixEditorRouter.post('/getAvailableTaxa', matrixEditorController.getAvailableTaxa)
matrixEditorRouter.post('/loadTaxaMedia', matrixEditorController.loadTaxaMedia)
matrixEditorRouter.post('/removeTaxaFromMatrix', matrixEditorController.removeTaxaFromMatrix)
matrixEditorRouter.post('/reorderTaxa', matrixEditorController.reorderTaxa)
matrixEditorRouter.post('/setTaxaNotes', matrixEditorController.setTaxaNotes)
matrixEditorRouter.post('/setTaxaAccess', matrixEditorController.setTaxaAccess)

// Cell related endpoints
matrixEditorRouter.post('/getAllCellNotes', matrixEditorController.getAllCellNotes)
matrixEditorRouter.post('/getCellCounts', matrixEditorController.getCellCounts)
matrixEditorRouter.post('/getCellData', matrixEditorController.getCellData)
matrixEditorRouter.post('/getCellMedia', matrixEditorController.getCellMedia)

// General endpoints
matrixEditorRouter.post('/getMatrixData', matrixEditorController.getMatrixData)
matrixEditorRouter.post('/logError', matrixEditorController.logError)

export default matrixEditorRouter;