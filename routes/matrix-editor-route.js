import express from 'express'
import * as controller from '../controllers/matrix-editor-controller.js'

const router = express.Router({ mergeParams: true })

// Taxa endpoints
router.post('/getAvailableTaxa', controller.getAvailableTaxa)
router.post('/addTaxaToMatrix', controller.addTaxaToMatrix)
router.post('/addTaxonMedia', controller.addTaxonMedia)
router.post('/loadTaxaMedia', controller.loadTaxaMedia)
router.post('/removeTaxaFromMatrix', controller.removeTaxaFromMatrix)
router.post('/reorderTaxa', controller.reorderTaxa)
router.post('/setTaxaNotes', controller.setTaxaNotes)
router.post('/setTaxaAccess', controller.setTaxaAccess)

// Character endpoints
router.post('/addCharacter', controller.addCharacter)
router.post('/removeCharacters', controller.removeCharacters)
router.post('/reorderCharacters', controller.reorderCharacters)
router.post('/updateCharacter', controller.updateCharacter)
router.post('/updateCharactersOrdering', controller.updateCharactersOrdering)
// Character Citations
router.post('/getCharacterCitations', controller.getCharacterCitations)
router.post('/removeCharacterCitation', controller.removeCharacterCitation)
router.post('/upsertCharacterCitation', controller.upsertCharacterCitation)
// Character Media
router.post('/addCharacterMedia', controller.addCharacterMedia)
router.post('/findCharacterMedia', controller.findCharacterMedia)
router.post('/moveCharacterMedia', controller.moveCharacterMedia)
router.post('/removeCharacterMedia', controller.removeCharacterMedia)
// Character Comments
router.post('/addCharacterComment', controller.addCharacterComment)
router.post('/getCharacterComments', controller.getCharacterComments)
router.post(
  '/setCharacterCommentsAsUnread',
  controller.setCharacterCommentsAsUnread
)
// Character rule
router.post('/addCharacterRuleAction', controller.addCharacterRuleAction)
router.post('/removeCharacterRuleAction', controller.removeCharacterRuleAction)
// Character rule violation
router.post('/fixAllCharacterRuleViolations', controller.fixAllRuleViolations)
router.post('/fixSelectedCharacterRuleViolations', controller.fixRuleViolations)
router.post('/getCharacterRuleViolations', controller.getRuleViolations)
// Character Changes
router.post('/getCharacterChanges', controller.getCharacterChanges)

// Cell endpoints
router.post('/copyCellScores', controller.copyCellScores)
router.post('/fetchCellsData', controller.fetchCellsData)
router.post('/getCellCounts', controller.getCellCounts)
router.post('/getCellData', controller.getCellData)
router.post('/setCellContinuousValues', controller.setCellContinuousValues)
router.post('/setCellStates', controller.setCellStates)
// Cell Media
router.post('/addCellMedia', controller.addCellMedia)
router.post('/getCellMedia', controller.getCellMedia)
router.post('/getLabelCount', controller.getLabelCount)
router.post('/removeCellMedia', controller.removeCellMedia)
router.post('/removeCellsMedia', controller.removeCellsMedia)
// Cell Citation
router.post('/addCellCitations', controller.addCellCitations)
router.post('/findCitation', controller.findCitation)
router.post('/getCellCitations', controller.getCellCitations)
router.post('/removeCellCitation', controller.removeCellCitation)
router.post('/upsertCellCitation', controller.upsertCellCitation)
// Cell Notes
router.post('/getAllCellNotes', controller.getAllCellNotes)
router.post('/setCellNotes', controller.setCellNotes)
// Cell Comments
router.post('/addCellComment', controller.addCellComment)
router.post('/getCellComments', controller.getCellComments)
// Cell Changes
router.post('/getCellBatchLogs', controller.getCellBatchLogs)
router.post('/getCellChanges', controller.getCellChanges)
router.post('/logCellCheck', controller.logCellCheck)
router.post('/undoCellBatch', controller.undoCellBatch)

// Partitions endpoints
router.post('/addCharactersToPartition', controller.addCharactersToPartition)
router.post('/addPartition', controller.addPartition)
router.post('/addTaxaToPartition', controller.addTaxaToPartition)
router.post('/editPartition', controller.editPartition)
router.post('/copyPartition', controller.copyPartition)
router.post(
  '/removeCharactersFromPartition',
  controller.removeCharactersFromPartition
)
router.post('/removePartition', controller.removePartition)
router.post('/removeTaxaToPartition', controller.removeTaxaFromPartition)

// General endpoints
router.post('/getCharacterData', controller.getCharacterData)
router.post('/getMatrixData', controller.getMatrixData)
router.post('/logError', controller.logError)
router.post('/setPreferences', controller.setPreferences)

// Search endpoints
router.post('/searchCells', controller.searchCells)
router.post('/searchCharacters', controller.searchCharacters)
router.post('/searchTaxa', controller.searchTaxa)

router.get('/:userId/sync', controller.sync)
router.post('/sendEvent', controller.sendEvent)
router.post('/fetchChanges', controller.fetchChanges)

export default router
