import { ExportOptions } from '../lib/matrix-export/exporter.js'
import { NexusExporter } from '../lib/matrix-export/nexus-exporter.js'
import { NeXMLExporter } from '../lib/matrix-export/nexml-exporter.js'
import { TNTExporter } from '../lib/matrix-export/tnt-exporter.js'
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
  const matrixId = parseInt(req.params.matrixId)
  if (!matrixId) {
    res.status(400).json({ message: 'The request must be contain a matrix ID.' })
    return
  }

  let fileExtension
  let exporter
  const options = new ExportOptions()
  switch (req.query.format) {
    case 'tnt':
      fileExtension = 'tnt'
      exporter = new TNTExporter((txt) => res.write(txt))
      break
    case 'nexml':
      fileExtension = 'xml'
      exporter = new NeXMLExporter((txt) => res.write(txt))
      break
    case 'nexus':
    default:
      fileExtension = 'nex'
      options.blocks = await matrixService.getMatrixBlocks(matrixId)
      exporter = new NexusExporter((txt) => res.write(txt))
      break
  }

  const date = new Date()
  const filename = `mbank_X${matrixId}_${date.getFullYear()}-${
    date.getMonth() + 1
  }-${date.getDate()}-${('0' + date.getUTCHours()).slice(-2)}${(
    '0' + date.getUTCMinutes()
  ).slice(-2)}.${fileExtension}`
  res.set({
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': 'attachment; filename=' + filename,
    'Cache-Control': 'private',
    'Last-Modified': new Date(),
    'Pragma': 'no-store',
  })
  res.status(200)

  options.matrix = await matrixService.getMatrix(matrixId)
  options.taxa = await matrixService.getTaxaInMatrix(matrixId)
  options.characters = await matrixService.getCharactersInMatrix(matrixId)
  options.cellsTable = await matrixService.getCells(matrixId)
  options.includeNotes = !!req.query.notes
  options.cellNotes = options.includeNotes
    ? await matrixService.getCellNotes(matrixId)
    : null
  exporter.export(options)
  res.end()
}
