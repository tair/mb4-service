const matrixService = require('../services/matrix-service.js')
const partitionService = require('../services/partition-service')

async function getMatrices(req, res) {
  const projectId = req.params.id
  try {
    const matrices = await matrixService.getMatrices(projectId)
    const partitions = await partitionService.getPartitions(projectId)
    const matrixIds = matrices.map(matrix => matrix.matrix_id)
    const counts = await matrixService.getCounts(matrixIds)
    const data = {
      matrix: matrices,
      partition: partitions,
      count: counts,
    }
    res.status(200).json(data)
  } catch (e) {
    console.error('Error while getting matrix list.', e)
    res.status(500).json({ message: 'Error while fetching matrix list.' })
  }
}

module.exports = {
  getMatrices,
}