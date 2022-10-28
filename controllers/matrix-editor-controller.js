import MatrixEditorService from '../services/matrix-editor-service.js'

async function getMatrixData(req, res) {
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.getMatrixData()
  data.ok = true
  res.status(200).json(data)
}

async function getCellData(req, res) {
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.getCellData()
  data.ok = true
  res.status(200).json(data)
}

async function getCellCounts(req, res) {
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.getCellCounts()
  data.ok = true
  res.status(200).json(data)
}

async function getAllCellNotes(req, res) {
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.getAllCellNotes()
  data.ok = true
  res.status(200).json(data)
}

async function getCellMedia(req, res) {
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.getCellMedia()
  data.ok = true
  res.status(200).json(data)
}

async function addTaxaToMatrix(req, res) {
  const taxaIds = parseIntArray(req.body.taxaIds)
  const afterTaxonId = parseInt(req.body.afterTaxonId)
  const matrixEditorService = await getMatrix(req)
  const data = await matrixEditorService.addTaxaToMatrix(taxaIds, afterTaxonId)
  data.ok = true
  res.status(200).json(data)
}

async function logError(req) {
  console.log('Error: ', req.body)
}

async function getMatrix(req) {
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
}

export {
  addTaxaToMatrix,
  getAllCellNotes,
  getCellCounts,
  getCellData,
  getCellMedia,
  getMatrixData,
  logError,
}