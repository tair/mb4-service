import MatrixEditorService from '../services/matrix-editor-service.js'
import { UserError } from '../lib/user-errors.js'

export async function getMatrixData(req, res) {
  await applyMatrix(req, res, (service) => service.getMatrixData())
}

export async function getCellData(req, res) {
  await applyMatrix(req, res, (service) => service.getCellData())
}

export async function getCellCounts(req, res) {
  const startCharacterNum = parseInt(req.body.start_character_num)
  const endCharacterNum = parseInt(req.body.end_character_num)
  const startTaxonNum = parseInt(req.body.start_taxon_num)
  const endTaxonNum = parseInt(req.body.end_taxon_num)
  await applyMatrix(req, res, (service) =>
    service.getCellCounts(
      startCharacterNum,
      endCharacterNum,
      startTaxonNum,
      endTaxonNum
    )
  )
}

export async function getAllCellNotes(req, res) {
  await applyMatrix(req, res, (service) => service.getAllCellNotes())
}

export async function getCellMedia(req, res) {
  await applyMatrix(req, res, (service) => service.getCellMedia())
}

export async function getAvailableTaxa(req, res) {
  await applyMatrix(req, res, (service) => service.getAvailableTaxa())
}

export async function addTaxaToMatrix(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const afterTaxonId = parseInt(req.body.after_taxon_id)
  await applyMatrix(req, res, (service) =>
    service.addTaxaToMatrix(taxaIds, afterTaxonId)
  )
}

export async function removeTaxaFromMatrix(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  await applyMatrix(req, res, (service) =>
    service.removeTaxaFromMatrix(taxaIds)
  )
}

export async function reorderTaxa(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const index = parseInt(req.body.index)
  await applyMatrix(req, res, (service) => service.reorderTaxa(taxaIds, index))
}

export async function setTaxaNotes(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const notes = req.body.notes
  await applyMatrix(req, res, (service) => service.setTaxaNotes(taxaIds, notes))
}

export async function setTaxaAccess(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const userId = parseInt(req.body.user_id) || null
  const groupId = parseInt(req.body.group_id) || null
  await applyMatrix(req, res, (service) =>
    service.setTaxaAccess(taxaIds, userId, groupId)
  )
}

export async function addTaxonMedia(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const mediaIds = parseIntArray(req.body.media_ids)
  await applyMatrix(req, res, (service) =>
    service.addTaxonMedia(taxaIds, mediaIds)
  )
}

export async function removeTaxonMedia(req, res) {
  const linkId = parseInt(req.body.link_id)
  await applyMatrix(req, res, (service) => service.removeTaxonMedia(linkId))
}

export async function loadTaxaMedia(req, res) {
  const taxonId = parseInt(req.body.taxon_id)
  const search = req.body.search
  await applyMatrix(req, res, (service) =>
    service.loadTaxaMedia(taxonId, search)
  )
}

export async function setCellStates(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const characterIds = parseIntArray(req.body.character_ids)
  const stateIds = parseIntArray(req.body.state_ids)
  const options = req.body.options
  await applyMatrix(req, res, (service) =>
    service.setCellStates(taxaIds, characterIds, stateIds, options)
  )
}

export async function setCellNotes(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const characterIds = parseIntArray(req.body.character_ids)
  const notes = req.body.notes
  const status = parseNullableInt(req.body.status)
  const options = req.body.options
  await applyMatrix(req, res, (service) =>
    service.setCellNotes(taxaIds, characterIds, notes, status, options)
  )
}

export async function addCellMedia(req, res) {
  const taxonId = parseInt(req.body.taxon_id)
  const characterIds = parseIntArray(req.body.character_ids)
  const mediaIds = parseIntArray(req.body.media_ids)
  const batchMode = parseInt(req.body.batchmode)
  await applyMatrix(req, res, (service) =>
    service.addCellMedia(taxonId, characterIds, mediaIds, batchMode)
  )
}

export async function removeCellMedia(req, res) {
  const taxonId = parseInt(req.body.taxon_id)
  const characterId = parseInt(req.body.character_id)
  const linkId = parseInt(req.body.link_id)
  const shouldTransferCitations = parseInt(req.body.should_transfer_citations)
  await applyMatrix(req, res, (service) =>
    service.removeCellMedia(
      taxonId,
      characterId,
      linkId,
      shouldTransferCitations
    )
  )
}

export async function logError(req) {
  console.log('JS error: ', req.body)
}

export async function applyMatrix(req, res, func) {
  const projectId = parseInt(req.params.projectId)
  const matrixId = parseInt(req.params.matrixId)
  const userId = 683 // (req.body.userId)
  const readonly = req.body.ro

  try {
    const service = await MatrixEditorService.create(
      projectId,
      matrixId,
      userId,
      readonly
    )
    const data = await func(service)
    data.ok = true
    res.status(200).json(data)
  } catch (e) {
    console.log('Error', e)
    if (e instanceof UserError) {
      res.status(e.getStatus()).json({ data: false, message: e.message })
    } else {
      res.status(500).json({ data: false, message: 'Unknown error' })
    }
  }
}

function parseIntArray(array) {
  if (Array.isArray(array)) {
    const ints = array.filter((i) => i != null).map((i) => parseInt(i))
    return Array.from(new Set(ints))
  }
  return []
}

function parseNullableInt(value) {
  return value == null ? null : parseInt(value)
}
