import * as matrixService from '../services/matrix-service.js'
import * as partitionService from '../services/partition-service.js'

async function getMatrices(req, res) {
  const projectId = req.params.projectId
  try {
    const matrices = await matrixService.getMatrices(projectId)
    const partitions = await partitionService.getPartitions(projectId)
    const matrixIds = matrices.map((matrix) => matrix.matrix_id)
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

export { getMatrices }
