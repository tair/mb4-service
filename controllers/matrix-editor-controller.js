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
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.getCellCounts()
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
    return Array.from(new Set(array.map(i => parseInt(i))))
  }
  return []
}
