import MatrixEditorService from '../services/matrix-editor-service.js'

export async function getMatrixData(req, res) {
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.getMatrixData()
  data.ok = true
  res.status(200).json(data)
}

export async function getCellData(req, res) {
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.getCellData()
  data.ok = true
  res.status(200).json(data)
}

export async function getCellCounts(req, res) {
  const startCharacterNum = parseInt(req.body.start_character_num)
  const endCharacterNum = parseInt(req.body.end_character_num)
  const startTaxonNum = parseInt(req.body.start_taxon_num)
  const endTaxonNum = parseInt(req.body.end_taxon_num)
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.getCellCounts(
    startCharacterNum,
    endCharacterNum,
    startTaxonNum,
    endTaxonNum
  )
  data.ok = true
  res.status(200).json(data)
}

export async function getAllCellNotes(req, res) {
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.getAllCellNotes()
  data.ok = true
  res.status(200).json(data)
}

export async function getCellMedia(req, res) {
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.getCellMedia()
  data.ok = true
  res.status(200).json(data)
}

export async function getAvailableTaxa(req, res) {
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.getAvailableTaxa()
  data.ok = true
  res.status(200).json(data)
}

export async function addTaxaToMatrix(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const afterTaxonId = parseInt(req.body.after_taxon_id)
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.addTaxaToMatrix(taxaIds, afterTaxonId)
  data.ok = true
  res.status(200).json(data)
}

export async function removeTaxaFromMatrix(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.removeTaxaFromMatrix(taxaIds)
  data.ok = true
  res.status(200).json(data)
}

export async function reorderTaxa(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const index = parseInt(req.body.index)
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.reorderTaxa(taxaIds, index)
  data.ok = true
  res.status(200).json(data)
}

export async function setTaxaNotes(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const notes = req.body.notes
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.setTaxaNotes(taxaIds, notes)
  data.ok = true
  res.status(200).json(data)
}

export async function setTaxaAccess(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const userId = parseInt(req.body.user_id) || null
  const groupId = parseInt(req.body.group_id) || null
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.setTaxaAccess(taxaIds, userId, groupId)
  data.ok = true
  res.status(200).json(data)
}

export async function addTaxonMedia(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const mediaIds = parseIntArray(req.body.media_ids)
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.addTaxonMedia(taxaIds, mediaIds)
  data.ok = true
  res.status(200).json(data)
}

export async function removeTaxonMedia(req, res) {
  const linkId = parseInt(req.body.link_id)
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.removeTaxonMedia(linkId)
  data.ok = true
  res.status(200).json(data)
}

export async function loadTaxaMedia(req, res) {
  const taxonId = parseInt(req.body.taxon_id)
  const search = req.body.search
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.loadTaxaMedia(taxonId, search)
  data.ok = true
  res.status(200).json(data)
}

export async function setCellStates(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const characterIds = parseIntArray(req.body.character_ids)
  const stateIds = parseIntArray(req.body.state_ids)
  const options = req.body.options
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.setCellStates(
    taxaIds,
    characterIds,
    stateIds,
    options
  )
  data.ok = true
  res.status(200).json(data)
}

export async function setCellNotes(req, res) {
  const taxaIds = parseIntArray(req.body.taxa_ids)
  const characterIds = parseIntArray(req.body.character_ids)
  const notes = req.body.notes
  const status = parseNullableInt(req.body.status)
  const options = req.body.options
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.setCellNotes(
    taxaIds,
    characterIds,
    notes,
    status,
    options
  )
  data.ok = true
  res.status(200).json(data)
}

export async function addCellMedia(req, res) {
  const taxonId = parseInt(req.body.taxon_id)
  const characterIds = parseIntArray(req.body.character_ids)
  const mediaIds = parseIntArray(req.body.media_ids)
  const batchMode = parseInt(req.body.batchmode)
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.addCellMedia(
    taxonId,
    characterIds,
    mediaIds,
    batchMode
  )
  data.ok = true
  res.status(200).json(data)
}

export async function removeCellMedia(req, res) {
  const taxonId = parseInt(req.body.taxon_id)
  const characterId = parseInt(req.body.character_id)
  const linkId = parseInt(req.body.link_id)
  const shouldTransferCitations = parseInt(req.body.should_transfer_citations)
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.removeCellMedia(
    taxonId,
    characterId,
    linkId,
    shouldTransferCitations
  )
  data.ok = true
  res.status(200).json(data)
}

export async function logError(req) {
  console.log('Error: ', req.body)
}

export async function getMatrix(req) {
  const projectId = parseInt(req.params.projectId)
  const matrixId = parseInt(req.params.matrixId)
  const userId = 683 // (req.body.userId)
  const readonly = req.body.ro

  return await MatrixEditorService.create(projectId, matrixId, userId, readonly)
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
