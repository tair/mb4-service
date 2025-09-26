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
import { getTaxonName } from '../util/taxa.js'
import sequelizeConn from '../util/db.js'
import * as matrixService from '../services/matrix-service.js'
import CipresRequestService from '../services/cipres-request-service.js'
import * as partitionService from '../services/partition-service.js'
import * as utilService from '../util/util.js'
import fs from 'fs'
import axios from 'axios'
import FormData from 'form-data'
import { getRoles } from '../services/user-roles-service.js'

export async function getMatrices(req, res) {
  const projectId = parseInt(req.params.projectId)

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
      const taxaByMatrix = await matrixService.getTaxaInMatrix(matrix.matrix_id)
      const taxaNames = []
      for (const taxon of taxaByMatrix) {
        taxaNames.push(
          getTaxonName(taxon, null, false, false)
            .replace(/<\/?[^>]+(>|$)/g, '')
            .replace(/[']+/g, "''")
            .replace(/[\r\n\t]+/g, ' ')
            .trim()
        )
      }
      matrix.taxonNames = taxaNames
    }

    let jobs =
      userId > 0
        ? await CipresRequestService.getCipresJobs(matrixIds, userId)
        : null
    const data = {
      matrices,
      partitions,
      canEditMatrix: true,
      jobs,
    }
    res.status(200).json(data)
  } catch (e) {
    console.error('Error while getting matrix list.', e)
    res.status(500).json({ message: 'Error while fetching matrix list.' })
  }
}

export async function getMatrix(req, res) {
  const projectId = parseInt(req.params.projectId)
  const matrixId = parseInt(req.params.matrixId)

  if (!matrixId) {
    res.status(400).json({ message: 'Matrix ID is required' })
    return
  }

  try {
    const matrix = await matrixService.getMatrix(matrixId)

    if (!matrix) {
      res.status(404).json({ message: 'Matrix not found' })
      return
    }

    // Verify the matrix belongs to the project
    if (matrix.project_id !== projectId) {
      res.status(404).json({ message: 'Matrix not found in this project' })
      return
    }

    res.status(200).json(matrix)
  } catch (e) {
    console.error('Error while getting matrix.', e)
    res.status(500).json({ message: 'Error while fetching matrix.' })
  }
}

export async function updateMatrix(req, res) {
  const projectId = parseInt(req.params.projectId)
  const matrixId = parseInt(req.params.matrixId)

  if (!matrixId) {
    res.status(400).json({ message: 'Matrix ID is required' })
    return
  }

  try {
    // First verify the matrix exists and belongs to the project
    const existingMatrix = await matrixService.getMatrix(matrixId)

    if (!existingMatrix) {
      res.status(404).json({ message: 'Matrix not found' })
      return
    }

    if (existingMatrix.project_id !== projectId) {
      res.status(404).json({ message: 'Matrix not found in this project' })
      return
    }

    // Prepare updates object
    const updates = {}
    if (req.body.title !== undefined) {
      updates.title = req.body.title
    }
    if (req.body.notes !== undefined) {
      updates.notes = req.body.notes
    }
    if (req.body.published !== undefined) {
      updates.published = req.body.published
    }
    if (req.body.otu !== undefined) {
      updates.otu = req.body.otu
    }
    if (req.body.other_options !== undefined) {
      updates.other_options = req.body.other_options
    }

    // Update the matrix
    const updatedMatrix = await matrixService.updateMatrix(
      matrixId,
      updates,
      req.user
    )

    res.status(200).json({
      status: true,
      matrix: updatedMatrix,
    })
  } catch (e) {
    console.error('Error while updating matrix.', e)
    res.status(500).json({ message: 'Error while updating matrix.' })
  }
}

async function checkMatrixDeletePermission(req, matrix) {
  // Check if user is logged in
  if (!req.user) {
    return {
      canDelete: false,
      error: {
        status: 401,
        message: 'You must be logged in to delete a matrix',
      },
    }
  }

  // Get user roles
  const userRoles = await getRoles(req.user.user_id)
  const isAdmin = userRoles.includes('admin')
  const isCurator = userRoles.includes('curator')
  const isProjectOwner = req.project.user_id === req.user.user_id
  const isMatrixOwner = matrix.user_id === req.user.user_id

  // Check if user has permission to delete
  const canDelete = isProjectOwner || isMatrixOwner || isCurator || isAdmin

  if (!canDelete) {
    return {
      canDelete: false,
      error: {
        status: 403,
        message: 'You do not have access to delete the matrix!',
      },
    }
  }

  return { canDelete: true }
}

export async function deleteMatrix(req, res) {
  const projectId = parseInt(req.params.projectId)
  const matrixId = parseInt(req.params.matrixId)

  if (!matrixId) {
    res.status(400).json({ message: 'Matrix ID is required' })
    return
  }

  try {
    // First verify the matrix exists and belongs to the project
    const existingMatrix = await matrixService.getMatrix(matrixId)

    if (!existingMatrix) {
      res.status(404).json({ message: 'Matrix not found' })
      return
    }

    if (existingMatrix.project_id !== projectId) {
      res.status(404).json({ message: 'Matrix not found in this project' })
      return
    }

    // Check delete permission
    const { canDelete, error } = await checkMatrixDeletePermission(
      req,
      existingMatrix
    )
    if (!canDelete) {
      res.status(error.status).json({ message: error.message })
      return
    }

    // Check if cleanup_matrix parameter is provided (equivalent to cleanup_matrix in PHP)
    const cleanupMatrix = req.query.deleteTaxaAndCharacters === 'true'

    // Delete the matrix with or without cleanup
    if (cleanupMatrix) {
      // Delete matrix and clean up affiliated characters/taxa
      await matrixService.deleteMatrixWithCleanup(matrixId, req.user)
    } else {
      // Just delete the matrix
      await matrixService.deleteMatrix(matrixId, req.user)
    }

    res.status(200).json({
      status: true,
      message: 'Deleted matrix',
    })
  } catch (e) {
    console.error('Error while deleting matrix.', e)
    res.status(500).json({
      message: e.message || 'Error while deleting matrix.',
    })
  }
}

export async function createMatrix(req, res) {
  const title = req.body.title
  if (!title) {
    res.status(400).json({ message: 'Title was not defined' })
    return
  }

  const projectId = req.params.projectId
  let transaction

  try {
    // Check if project has any taxa
    const projectTaxa = await models.Taxon.findAll({
      where: { project_id: projectId },
      order: [
        ['genus', 'ASC'],
        ['specific_epithet', 'ASC'],
      ],
    })

    if (projectTaxa.length === 0) {
      res.status(400).json({
        message:
          'Cannot create matrix: Project has no taxa associated with it. Please add taxa to the project first.',
      })
      return
    }

    // Get the first taxon (alphabetically by genus, then specific epithet)
    const firstTaxon = projectTaxa[0]

    // Create the matrix manually without file upload
    transaction = await sequelizeConn.transaction()

    const matrix = models.Matrix.build({
      title: title,
      notes: req.body.notes || '',
      otu: req.body.otu || 'genus',
      published: req.body.published || 0,
      user_id: req.user.user_id,
      project_id: projectId,
      type: 0, // Default to categorical
    })

    await matrix.save({
      user: req.user,
      transaction: transaction,
    })

    // Automatically link to the first taxon of the project
    await models.MatrixTaxaOrder.create(
      {
        matrix_id: matrix.matrix_id,
        taxon_id: firstTaxon.taxon_id,
        user_id: req.user.user_id,
        position: 1,
      },
      {
        user: req.user,
        transaction: transaction,
      }
    )

    await transaction.commit()

    res.status(200).json({
      status: true,
      matrix_id: matrix.matrix_id,
      message: `Matrix created successfully and linked to first taxon (alphabetically): ${
        firstTaxon.genus || 'Unknown'
      }`,
    })
  } catch (e) {
    // Rollback transaction if it exists
    if (transaction) {
      await transaction.rollback()
    }
    console.log('Matrix not created correctly', e)
    res.status(400).json({ message: 'Matrix not created correctly' })
  }
}

export async function uploadMatrix(req, res) {
  const title = req.body.title
  const matrixId = req.body.matrixId
  if (!matrixId && !title) {
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
    const projectId = req.params.projectId
    const matrix = JSON.parse(serializedMatrix)
    const results = matrixId
      ? await mergeMatrix(
          matrixId,
          req.body.notes || '',
          req.body.itemNotes || '',
          req.user,
          matrix,
          file
        )
      : await importMatrix(
          title,
          req.body.notes || '',
          req.body.itemNotes || '',
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

export async function uploadCsvMatrix(req, res) {
  try {
    const file = req.file
    if (!file) {
      res.status(400).json({ message: 'No file uploaded' })
      return
    }

    const ext = (file.originalname || '').toLowerCase()
    if (
      !ext.endsWith('.csv') &&
      !ext.endsWith('.xlsx') &&
      !ext.endsWith('.xls')
    ) {
      res.status(400).json({
        message: 'Unsupported file type. Only .csv, .xlsx, .xls are allowed',
      })
      return
    }

    const projectId = req.params.projectId
    const title = req.body.title
    if (!title) {
      res.status(400).json({ message: 'Title was not defined' })
      return
    }

    // Optional fields to mirror existing uploadMatrix
    const notes = req.body.notes || ''
    const itemNotes = req.body.itemNotes || ''
    const otu = req.body.otu || 'genus'
    const published = req.body.published

    // Use client-provided parsed matrix if present; otherwise parse on server
    let matrixObj
    if (req.body.matrix) {
      try {
        matrixObj = JSON.parse(req.body.matrix)
      } catch (e) {
        res.status(400).json({ message: 'Invalid matrix payload' })
        return
      }
    } else {
      const { parseCsvXlsxToMatrix } = await import(
        '../lib/matrix-import/csv-xlsx-parser.js'
      )
      const parsed = parseCsvXlsxToMatrix(file)
      matrixObj = parsed.matrixObj
    }

    // Reuse existing importer and persistence logic
    const { importMatrix } = await import(
      '../lib/matrix-import/matrix-importer.js'
    )
    const actingUser = req.user || {
      user_id: 0,
      fname: 'CSV',
      lname: 'Import',
    }
    const results = await importMatrix(
      title,
      notes,
      itemNotes,
      otu,
      published,
      actingUser,
      projectId,
      matrixObj,
      file
    )

    res.status(200).json({ status: true, results })
  } catch (e) {
    console.log('CSV/XLSX Matrix not imported correctly', e)
    res.status(400).json({ message: 'Matrix not imported correctly' })
  }
}

export async function parseCsvMatrix(req, res) {
  try {
    const file = req.file
    if (!file) {
      res.status(400).json({ message: 'No file uploaded' })
      return
    }

    const ext = (file.originalname || '').toLowerCase()
    if (
      !ext.endsWith('.csv') &&
      !ext.endsWith('.xlsx') &&
      !ext.endsWith('.xls')
    ) {
      res.status(400).json({
        message: 'Unsupported file type. Only .csv, .xlsx, .xls are allowed',
      })
      return
    }

    const { parseCsvXlsxToMatrix } = await import(
      '../lib/matrix-import/csv-xlsx-parser.js'
    )
    const mode = req.body.mode
    const { matrixObj, warnings } = parseCsvXlsxToMatrix(file, {
      mode: mode === 'discrete' || mode === 'continuous' ? mode : undefined,
    })

    res
      .status(200)
      .json({ status: true, matrix: matrixObj, warnings: warnings || [] })
  } catch (e) {
    console.log('CSV/XLSX Matrix not parsed correctly', e)
    res
      .status(400)
      .json({ message: e.message || 'Matrix not parsed correctly' })
  }
}

export async function mergeMatrixFile(req, res) {
  const matrixId = req.params.matrixId
  if (!matrixId) {
    res.status(400).json({ message: 'Matrix ID was not defined' })
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
    const projectId = req.params.projectId
    const matrix = JSON.parse(serializedMatrix)
    const results = await mergeMatrix(
      matrixId,
      req.body.notes,
      req.body.itemNotes,
      req.user,
      projectId,
      matrix,
      file
    )
    res.status(200).json({ status: true, results })
  } catch (e) {
    console.log('Matrix not merged correctly', e)
    res.status(400).json({ message: 'Matrix not merged correctly' })
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

export async function run(req, res) {
  const matrixId = parseInt(req.params.matrixId)
  if (!matrixId) {
    res.status(400).json({ message: 'The request must contain a matrix ID.' })
    return
  }
  const userId = req.user?.user_id || 0

  const fileExtension = 'nex'
  const options = new ExportOptions()
  options.blocks = await matrixService.getMatrixBlocks(matrixId)
  options.matrix = await matrixService.getMatrix(matrixId)
  options.includeNotes = false
  options.taxa = await matrixService.getTaxaInMatrix(matrixId)
  options.characters = await matrixService.getCharactersInMatrix(matrixId)
  options.cellsTable = await matrixService.getCells(matrixId)
  options.cellNotes = null

  const filename = `mbank_X${matrixId}_${userId}_${req.query.jobName}.zip`
  let fileContent = ''
  let exporter = new NexusExporter((txt) => (fileContent = fileContent + txt))

  exporter.export(options)
  /*
  let jobCTP = req.query.jobCharsToPermute
  let jobChar = 'vparam.specify_mod_'
  if (
    req.query.jobCharsToPermute &&
    req.query.jobCharsToPermute.indexOf('%') != -1
  ) {
    jobCTP = req.query.jobCharsToPermute.replace('%', '')
    jobChar = 'vparam.specify_pct_'
  }*/

  console.info('Received tool = ' + req.query.tool + ' in the request')
  /* const formData1 = {
    tool: req.query.tool,
    'input.infile_': fileContent,
  } */
  let formData2 = null
  if (req.query.tool == 'PAUPRAT') {
    if (
      req.query.jobCharsToPermute &&
      req.query.jobCharsToPermute.indexOf('%') != -1
    ) {
      formData2 = {
        'vparam.specify_nchar_': options.characters.length,
        'vparam.specify_nreps_': req.query.jobNumIterations,
        'vparam.specify_pct_': req.query.jobCharsToPermute.replace('%', ''),
        'vparam.paup_branchalg_': req.query.jobBranchSwappingAlgorithm,
        'vparam.runtime_': 1,
      }
    } else {
      formData2 = {
        'vparam.specify_nchar_': options.characters.length,
        'vparam.specify_nreps_': req.query.jobNumIterations,
        'vparam.specify_mod_': req.query.jobCharsToPermute,
        'vparam.paup_branchalg_': req.query.jobBranchSwappingAlgorithm,
        'vparam.runtime_': 1,
      }
    }
  }
  if (req.query.tool == 'MRBAYES_XSEDE') {
    if (req.query.mrbayesblockquery == '1') {
      if (req.query.mrbayesblock != null) {
        if (req.query.set_outgroup == null)
          formData2 = {
            'vparam.mrbayesblockquery_': req.query.mrbayesblockquery,
            'vparam.nruns_specified_': req.query.nruns_specified,
            'vparam.nchains_specified_': req.query.nchains_specified,
            'vparam.runtime_': 1,
          }
        else
          formData2 = {
            'vparam.mrbayesblockquery_': req.query.mrbayesblockquery,
            'vparam.set_outgroup_': req.query.set_outgroup,
            'vparam.nruns_specified_': req.query.nruns_specified,
            'vparam.nchains_specified_': req.query.nchains_specified,
            'vparam.runtime_': 1,
          }
        fileContent += '\n' + req.query.mrbayesblock
        console.info(fileContent)
      } else
        formData2 = {
          'vparam.mrbayesblockquery_': req.query.mrbayesblockquery,
          'vparam.nruns_specified_': req.query.nruns_specified,
          'vparam.nchains_specified_': req.query.nchains_specified,
          'vparam.runtime_': req.query.runtime,
        }
    }
    if (req.query.mrbayesblockquery == '0') {
      if (req.query.set_outgroup != null)
        formData2 = {
          'vparam.mrbayesblockquery_': req.query.mrbayesblockquery,
          'vparam.set_outgroup_': req.query.set_outgroup,
          'vparam.ngenval_': req.query.ngenval,
          'vparam.nrunsval_': req.query.nrunsval,
          'vparam.nchainsval_': req.query.nchainsval,
          'vparam.samplefreqval_': req.query.samplefreqval,
          'vparam.specify_diagnfreqval_': req.query.specify_diagnfreqval,
          'vparam.burninfracval_': req.query.burninfracval,
          'vparam.runtime_': 4,
        }
      else
        formData2 = {
          'vparam.mrbayesblockquery_': req.query.mrbayesblockquery,
          'vparam.ngenval_': req.query.ngenval,
          'vparam.nrunsval_': req.query.nrunsval,
          'vparam.nchainsval_': req.query.nchainsval,
          'vparam.samplefreqval_': req.query.samplefreqval,
          'vparam.specify_diagnfreqval_': req.query.specify_diagnfreqval,
          'vparam.burninfracval_': req.query.burninfracval,
          'vparam.runtime_': 4,
        }
    }
  }
  const formData1 = {
    tool: req.query.tool,
    'input.infile_': fileContent,
  }
  const formData3 = {
    'vparam.zipfilename_': filename,
  }

  const formDataForSubmission = { ...formData1, ...formData2, ...formData3 }
  const msg = await CipresRequestService.createCipresRequest(
    matrixId,
    req.user,
    req.query.jobNote ? req.query.jobNote : ' ',
    req.query.jobName,
    formData2,
    formDataForSubmission
  )

  res.status(200).json({ message: msg.message })
}

export async function deleteJob(req, res) {
  const matrixId = parseInt(req.params.matrixId)
  if (!matrixId) {
    res.status(400).json({ message: 'The request must contain a matrix ID.' })
    return
  }
  const jobCID = req.query.cipresJobId
  if (!jobCID) {
    res
      .status(400)
      .json({ message: 'The request must contain a Cipres Job ID.' })
    return
  }
  const msg = await CipresRequestService.deleteCipresRequest(
    matrixId,
    req.user,
    req.query.jobName,
    jobCID
  )

  res.status(200).json({ message: msg.message })
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

  options.includeNotes = !!req.query.notes
  let filename = ''
  if (!options.includeNotes) {
    filename = `mbank_X${matrixId}_${getFilenameDate()}_no_notes.${fileExtension}`
  } else {
    filename = `mbank_X${matrixId}_${getFilenameDate()}.${fileExtension}`
  }
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

  const options = new ExportOptions()
  options.includeNotes = !!req.query.notes
  let filename = ''
  if (!options.includeNotes) {
    filename = `mbank_X${matrixId}_${getFilenameDate()}_character_list_no_notes.txt`
  } else {
    filename = `mbank_X${matrixId}_${getFilenameDate()}_character_list.txt`
  }

  res.set({
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Disposition': 'attachment; filename=' + filename,
    'Cache-Control': 'private',
    'Last-Modified': new Date(),
    Pragma: 'no-store',
  })
  res.status(200)

  const exporter = new CharacterTextExporter((txt) => res.write(txt))
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

export async function checkDeletePermission(req, res) {
  const projectId = parseInt(req.params.projectId)
  const matrixId = parseInt(req.params.matrixId)

  if (!matrixId) {
    res.status(400).json({ message: 'Matrix ID is required' })
    return
  }

  try {
    // First verify the matrix exists and belongs to the project
    const existingMatrix = await matrixService.getMatrix(matrixId)

    if (!existingMatrix) {
      res.status(404).json({ message: 'Matrix not found' })
      return
    }

    if (existingMatrix.project_id !== projectId) {
      res.status(404).json({ message: 'Matrix not found in this project' })
      return
    }

    // Check delete permission
    const { canDelete } = await checkMatrixDeletePermission(req, existingMatrix)
    res.status(200).json({ canDelete })
  } catch (e) {
    console.error('Error while checking delete permission.', e)
    res.status(500).json({
      message: e.message || 'Error while checking delete permission.',
    })
  }
}
