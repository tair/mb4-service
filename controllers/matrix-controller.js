import * as matrixService from '../services/matrix-service.js'
import * as partitionService from '../services/partition-service.js'

export async function getMatrices(req, res) {
  const projectId = req.params.projectId
  try {
    const matrices = await matrixService.getMatrices(projectId)
    const partitions = await partitionService.getPartitions(projectId)

    const matrixIds = matrices.map((matrix) => matrix.matrix_id)
    const counts = await matrixService.getCounts(matrixIds)
    for (const matrix of matrices) {
      matrix.counts = {}
      for (const key in counts) {
        const count = counts[key]
        if (matrix.matrix_id in count) {
          matrix.counts[key] = count[matrix.matrix_id]
        }
      }
    }

    const data = {
      matrices,
      partitions,
      canEditMatrix: true,
    }
    res.status(200).json(data)
  } catch (e) {
    console.error('Error while getting matrix list.', e)
    res.status(500).json({ message: 'Error while fetching matrix list.' })
  }
}

export async function download(req, res) {
  let fileExtension
  switch (req.query.format) {
    case 'tnt':
      fileExtension = 'tnt'
      break
    case 'nexml':
      fileExtension = 'xml'
      break
    case 'nexus':
    default:
      fileExtension = 'nex'
      break
  }

  const date = new Date()
  const matrixId = req.params.matrixId
  const filename = `mbank_X${matrixId}_${date.getFullYear()}-${
    date.getMonth() + 1
  }-${date.getDate()}-${('0' + date.getUTCHours()).slice(-2)}${(
    '0' + date.getUTCMinutes()
  ).slice(-2)}.${fileExtension}`
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': 'filename=' + filename,
    'Cache-Control': 'private',
    'Last-Modified': new Date(),
    Pragma: 'no-store',
  })
  res.status(200).send('Hello')
}
