import { CharacterRulesTextExporter } from '../lib/matrix-export/character-rules-text-exporter.js'
import { CharacterTextExporter } from '../lib/matrix-export/character-text-exporter.js'
import { ExportOptions } from '../lib/matrix-export/exporter.js'
import { NexusExporter } from '../lib/matrix-export/nexus-exporter.js'
import { NeXMLExporter } from '../lib/matrix-export/nexml-exporter.js'
import { TNTExporter } from '../lib/matrix-export/tnt-exporter.js'
import {
  importMatrix,
  mergeMatrix,
} from '../lib/matrix-import/matrix-importer.js'
import { models } from '../models/init-models.js'
import sequelizeConn from '../util/db.js'
import * as matrixService from '../services/matrix-service.js'
import * as partitionService from '../services/partition-service.js'

export async function getMatrices(req, res) {
  const projectId = req.params.projectId
  try {
    const [matrices, partitions] = await Promise.all([
      matrixService.getMatrices(projectId),
      partitionService.getPartitions(projectId),
    ])

    const matrixIds = matrices.map((matrix) => matrix.matrix_id)
    const counts = await matrixService.getCounts(matrixIds)

    const userId = req.user?.user_id || 0
    const projectUser =
      req.project?.user ??
      (await models.ProjectsXUser.findOne({
        where: {
          user_id: userId,
          project_id: projectId,
        },
      }))
    if (projectUser) {
      const matrixPreferences = projectUser.getPreferences('matrix')
      if (matrixPreferences) {
        for (const matrix of matrices) {
          if (matrix.matrix_id in matrixPreferences) {
            matrix.preferences = matrixPreferences[matrix.matrix_id]
          }
        }
      }
    }

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

export async function createMatrix(req, res) {
  const title = req.body.title
  if (!title) {
    res.status(400).json({ message: 'Title was not defined' })
    return
  }

  try {
    const projectId = req.params.projectId
    await createMatrix(
      title,
      req.body.notes,
      req.body.otu,
      req.body.published,
      req.user,
      projectId
    )
    res.status(200).json({ status: true })
  } catch (e) {
    console.log('Matrix not imported correctly', e)
    res.status(400).json({ message: 'Matrix not imported correctly' })
  }
}

export async function uploadMatrix(req, res) {
  const title = req.body.title
  if (!title) {
    res.status(400).json({ message: 'Title was not defined' })
    return
  }
  const file = req.file
  if (!file) {
    res.status(400).json({ message: 'File must be included' })
    return
  }
  const serializedMatrix = req.body.matrix
  if (!serializedMatrix) {
    res.status(400).json({ message: 'File was not properly parsed' })
    return
  }

  try {
    const matrixId = req.body.matrixId
    const projectId = req.params.projectId
    const matrix = JSON.parse(serializedMatrix)
    const results = matrixId
      ? await mergeMatrix(
          matrixId,
          req.body.notes,
          req.body.itemNotes,
          req.user,
          projectId,
          matrix,
          file
        )
      : await importMatrix(
          title,
          req.body.notes,
          req.body.itemNotes,
          req.body.otu,
          req.body.published,
          req.user,
          projectId,
          matrix,
          file
        )
    res.status(200).json({ status: true, results })
  } catch (e) {
    console.log('Matrix not imported correctly', e)
    res.status(400).json({ message: 'Matrix not imported correctly' })
  }
}

export async function setPreference(req, res) {
  const name = req.body.name
  const value = req.body.value
  if (!name) {
    res.status(400).json({ message: 'Name is not defined!' })
    return
  }

  const matrixId = parseInt(req.params.matrixId)
  if (!matrixId) {
    res.status(400).json({ message: 'Matrix id is not defined' })
    return
  }

  const projectId = req.params.projectId
  const userId = req.user?.user_id
  if (!userId) {
    res.status(400).json({ message: 'User id is not defined' })
    return
  }

  const projectUser = await models.ProjectsXUser.findOne({
    where: {
      user_id: userId,
      project_id: projectId,
    },
  })
  if (projectUser == null) {
    res.status(400).json({ message: 'User is not in Project' })
    return
  }

  let matrixPreferences = projectUser.getPreferences('matrix')
  if (value) {
    if (!matrixPreferences) {
      matrixPreferences = {}
    }
    if (!matrixPreferences[matrixId]) {
      matrixPreferences[matrixId] = {}
    }
    matrixPreferences[matrixId][name] = value
  } else if (matrixPreferences) {
    delete matrixPreferences[matrixId][name]
    if (Object.keys(matrixPreferences[matrixId]).length == 0) {
      delete matrixPreferences[matrixId]
    }
  }

  projectUser.setPreferences('matrix', matrixPreferences)
  const transaction = await sequelizeConn.transaction()
  await projectUser.save({ user: req.user, transaction: transaction })
  await transaction.commit()
  res.status(200).json({ status: true })
}

export async function download(req, res) {
  const matrixId = parseInt(req.params.matrixId)
  if (!matrixId) {
    res
      .status(400)
      .json({ message: 'The request must be contain a matrix ID.' })
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

  const filename = `mbank_X${matrixId}_${getFilenameDate()}.${fileExtension}`
  res.set({
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': 'attachment; filename=' + filename,
    'Cache-Control': 'private',
    'Last-Modified': new Date(),
    Pragma: 'no-store',
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

export async function downloadCharacters(req, res) {
  const matrixId = parseInt(req.params.matrixId)
  if (!matrixId) {
    res
      .status(400)
      .json({ message: 'The request must be contain a matrix ID.' })
    return
  }

  const filename = `mbank_X${matrixId}_${getFilenameDate()}_character_list.txt`
  res.set({
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': 'attachment; filename=' + filename,
    'Cache-Control': 'private',
    'Last-Modified': new Date(),
    Pragma: 'no-store',
  })
  res.status(200)

  const exporter = new CharacterTextExporter((txt) => res.write(txt))
  const options = new ExportOptions()
  options.includeNotes = !!req.query.notes
  options.matrix = await matrixService.getMatrix(matrixId)
  options.characters = await matrixService.getCharactersInMatrix(matrixId)

  exporter.export(options)
  res.end()
}

export async function downloadCharacterRules(req, res) {
  const matrixId = parseInt(req.params.matrixId)
  if (!matrixId) {
    res
      .status(400)
      .json({ message: 'The request must be contain a matrix ID.' })
    return
  }

  const filename = `mbank_X${matrixId}_${getFilenameDate()}_ontology.txt`
  res.set({
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': 'attachment; filename=' + filename,
    'Cache-Control': 'private',
    'Last-Modified': new Date(),
    Pragma: 'no-store',
  })
  res.status(200)

  const exporter = new CharacterRulesTextExporter((txt) => res.write(txt))
  const options = new ExportOptions()
  options.matrix = await matrixService.getMatrix(matrixId)
  options.characters = await matrixService.getCharactersInMatrix(matrixId)
  options.rules = await matrixService.getCharacterRulesInMatrix(matrixId)

  exporter.export(options)
  res.end()
}

function getFilenameDate() {
  const date = new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = ('0' + date.getUTCHours()).slice(-2)
  const minutes = ('0' + date.getUTCMinutes()).slice(-2)
  return `${year}-${month}-${day}-${hours}${minutes}`
}
