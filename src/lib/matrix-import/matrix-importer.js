import { FileUploader } from '../file-uploader.js'
import { TAXA_FIELD_NAMES } from '../../util/taxa.js'
import { getTaxonHash } from '../../models/taxon.js'
import { Table } from '../table.js'
import { models } from '../../models/init-models.js'
import { getCells, getCellNotes } from '../../services/matrix-service.js'
import { getMaxCharacterPositionForMatrix } from '../../services/matrix-character-order-service.js'
import { getMaxTaxonPositionForMatrix } from '../../services/matrix-taxa-order-service.js'
import sequelizeConn from '../../util/db.js'

/**
 * This creates a blank matrix in the database based on the parameters.
 * @param {string} title The title of the matrix.
 * @param {string} notes The notes for the matrix.
 * @param {string} otu The operational taxonomic unit for the matrix as defined by the user.
 * @param {integer} published A integer indicating whether this matrix should be published
 * @param {User} user The user who sent the request and will be associated with the creation.
 * @param {integer} projectId The project to create this matrix in.
 */
export async function createMatrix(
  title,
  notes,
  otu,
  published,
  user,
  projectId
) {
  const transaction = await sequelizeConn.transaction()
  const matrix = buildMatrix(title, notes, otu, published, user, projectId)
  await matrix.save({
    user: user,
    transaction: transaction,
  })
  await transaction.commit()
}

/**
 * This imports a matrix in the database based on the parameters. This method both supports importing
 * a new matrix as well as importing a matrix into an existing matrix.
 *
 * @param {string} title The title of the matrix.
 * @param {string} notes The notes for the matrix.
 * @param {string} itemNotes The notes for the items in the matrix.
 * @param {string} otu The operational taxonomic unit for the matrix as defined by the user.
 * @param {integer} published A integer indicating whether this matrix should be published
 * @param {User} user The user who sent the request and will be associated with the creation.
 * @param {integer} projectId The project to create this matrix in.
 * @param {Object} matrixObj The matrix object. This corresponds to the JSON that the user uploaded.
 * @param {File} file The original NEXUS or TNT file that was parsed.
 */
export async function importMatrix(
  title,
  notes,
  itemNotes,
  otu,
  published,
  user,
  projectId,
  matrixObj,
  file
) {
  const transaction = await sequelizeConn.transaction()
  const matrix = buildMatrix(title, notes, otu, published, user, projectId)
  if (matrixObj.format == 'TNT') {
    matrix.setOption('DEFAULT_NUMBERING_MODE', '1')
  }

  matrix.type = matrixObj.dataType
  await matrix.save({
    user: user,
    transaction: transaction,
  })

  await importIntoMatrix(
    matrix,
    notes,
    itemNotes,
    user,
    matrixObj,
    file,
    transaction
  )
  await transaction.commit()
}

/**
 * This merges a matrix in the database based on the parameters.
 *
 * @param {number} matrixId The id of the matrix.
 * @param {string} notes The notes for the matrix.
 * @param {string} itemNotes The notes for the items in the matrix.
 * @param {User} user The user who sent the request and will be associated with the creation.
 * @param {integer} projectId The project to create this matrix in.
 * @param {Object} matrixObj The matrix object. This corresponds to the JSON that the user uploaded.
 * @param {File} file The original NEXUS or TNT file that was parsed.
 */
export async function mergeMatrix(
  matrixId,
  notes,
  itemNotes,
  user,
  matrixObj,
  file
) {
  const matrix = await models.Matrix.findByPk(matrixId)
  if (!matrix) {
    throw new Error(`Matrix with ID ${matrixId} not found`)
  }

  const transaction = await sequelizeConn.transaction()
  await importIntoMatrix(
    matrix,
    notes,
    itemNotes,
    user,
    matrixObj,
    file,
    transaction
  )
  await transaction.commit()
}

/**
 * This imports a matrix in the database based on the parameters. This method both supports importing
 * a new matrix as well as importing a matrix into an existing matrix.
 *
 * @param {Matrix} matrix The matrix to insert into.
 * @param {string} notes The notes for the matrix.
 * @param {string} itemNotes The notes for the items in the matrix.
 * @param {User} user The user who sent the request and will be associated with the creation.
 * @param {Object} matrixObj The matrix object. This corresponds to the JSON that the user uploaded.
 * @param {File} file The original NEXUS or TNT file that was parsed.
 * @param {Transaction} transaction The transaction to insert into the database.
 */
async function importIntoMatrix(
  matrix,
  notes,
  itemNotes,
  user,
  matrixObj,
  file,
  transaction
) {
  const matrixId = matrix.matrix_id
  const projectId = matrix.project_id

  const projectTaxaMap = await getProjectTaxaMap(projectId)
  const matrixTaxaMap = await getMatrixTaxaMap(matrixId)
  let matrixTaxaPosition = await getMaxTaxonPositionForMatrix(matrixId)

  // Process all taxa at once
  const taxonHashes = []
  const taxonObjects = new Map()

  // First pass: prepare all taxon objects and hashes
  for (const taxaObj of matrixObj.taxa) {
    let taxonId = parseInt(taxaObj.taxonId)
    if (taxonId && projectTaxaMap.has(taxonId)) {
      const projectTaxon = projectTaxaMap.get(taxonId)
      projectTaxon.is_extinct = taxaObj.is_extinct
      projectTaxon.notes = taxaObj.notes

      await projectTaxon.save({
        user: user,
        transaction: transaction,
      })
    } else {
      const taxonNameParts = taxaObj.name.split(' ')
      if (taxonNameParts.length > 0) {
        const taxonObj = parseTaxonName(taxonNameParts, matrix.otu)
        const taxonHash = getTaxonHash(taxonObj)
        taxonHashes.push(taxonHash)
        taxonObjects.set(taxonHash, {
          taxonObj,
          taxaObj,
          taxonNameParts,
        })
      }
    }
  }

  // Bulk search for existing taxa
  if (taxonHashes.length > 0) {
    // Create placeholders for the IN clause
    const placeholders = taxonHashes.map(() => '?').join(',')
    const query = `
    SELECT t.*
    FROM taxa t
    WHERE t.project_id = ?
    AND t.taxon_hash IN (${placeholders})
    `
    const replacements = [projectId, ...taxonHashes]

    const foundTaxa = await sequelizeConn.query(query, {
      replacements,
      transaction: transaction,
      type: sequelizeConn.QueryTypes.SELECT,
    })

    // Create a map of existing taxa by their hash
    const existingTaxaMap = new Map()
    if (Array.isArray(foundTaxa)) {
      for (const taxon of foundTaxa) {
        if (taxon && taxon.taxon_hash) {
          existingTaxaMap.set(taxon.taxon_hash, taxon)
        }
      }
    }

    // Second pass: create or use existing taxa

    for (const [taxonHash, { taxonObj, taxaObj }] of taxonObjects) {
      const existingTaxon = existingTaxaMap.get(taxonHash)
      let taxonId

      if (existingTaxon) {
        // Use existing taxon
        taxonId = parseInt(existingTaxon.taxon_id)
        projectTaxaMap.set(taxonId, existingTaxon)
      } else {
        // Create new taxon
        const taxon = await models.Taxon.build({
          user_id: user.user_id,
          project_id: projectId,
          is_extinct: taxaObj.is_extinct,
          notes: taxaObj.note,
        })

        // Set taxon name fields using the already parsed object
        for (const [key, value] of Object.entries(taxonObj)) {
          taxon.set(key, value)
        }

        // Set additional fields if present
        for (const fieldName of TAXA_FIELD_NAMES) {
          if (taxaObj[fieldName]) {
            taxon.set(fieldName, taxaObj[fieldName])
          }
        }

        await taxon.save({
          user: user,
          transaction: transaction,
        })
        taxonId = parseInt(taxon.taxon_id)
        projectTaxaMap.set(taxonId, taxon)
      }

      taxaObj.taxonId = taxonId
      if (!matrixTaxaMap.has(taxonId)) {
        const taxaOrder = await models.MatrixTaxaOrder.create(
          {
            matrix_id: matrixId,
            taxon_id: taxonId,
            user_id: user.user_id,
            position: ++matrixTaxaPosition,
          },
          {
            user: user,
            transaction: transaction,
          }
        )
        matrixTaxaMap.set(taxonId, taxaOrder)
      }
    }
  }

  const projectCharactersMap = await getCharactersInProjectMap(projectId)
  const matrixCharactersMap = await getMatrixCharactersMap(matrixId)
  let maxCharacterPosition = await getMaxCharacterPositionForMatrix(matrixId)

  for (const characterObj of matrixObj.characters) {
    let characterId = parseInt(characterObj.character_id)

    let projectCharacter
    if (characterId && projectCharactersMap.has(characterId)) {
      projectCharacter = projectCharactersMap.get(characterId)
      projectCharacter.name = characterObj.name
      projectCharacter.description = characterObj.note || ''
      if (projectCharacter.type != characterObj.type) {
        const newType = getCharacterType(characterObj.type)
        const previousType = getCharacterType(projectCharacter.type)
        throw `The character '${projectCharacter.name}' is marked as ${newType} but previously marked as ${previousType}`
      }
      await projectCharacter.save({
        user: user,
        transaction: transaction,
      })
    } else {
      const character = await models.Character.create(
        {
          name: characterObj.name,
          description: characterObj.note,
          user_id: user.user_id,
          project_id: projectId,
          ordering: characterObj.ordering,
          type: characterObj.type,
        },
        {
          user: user,
          transaction: transaction,
        }
      )
      character.states = []
      characterId = parseInt(character.character_id)
      projectCharactersMap.set(characterId, character)
    }

    characterObj.characterId = characterId
    if (!matrixCharactersMap.has(characterId)) {
      const characterOrder = await models.MatrixCharacterOrder.create(
        {
          matrix_id: matrixId,
          character_id: characterId,
          user_id: user.user_id,
          position: ++maxCharacterPosition,
        },
        {
          user: user,
          transaction: transaction,
        }
      )
      matrixCharactersMap.set(characterId, characterOrder)
    }

    if (Array.isArray(characterObj.states)) {
      const stateNameMap = new Map()
      if (projectCharacter) {
        for (const projectState of projectCharacter.states) {
          stateNameMap.set(projectState.name, projectState)
        }
      }
      projectCharacter = projectCharactersMap.get(characterId)
      for (const stateObj of characterObj.states) {
        if (stateNameMap.has(stateObj.name)) {
          if (stateObj.notes) {
            const existingState = stateNameMap.get(stateObj.name)

            // TODO: Check with Tanya is it ever possible to have state descriptio
            await models.CharacterState.update(
              { description: stateObj.notes },
              {
                where: { state_id: existingState.state_id },
                transaction: transaction,
                individualHooks: true,
                user: user,
              }
            )
          }
        } else {
          // Find the maximum existing num value to ensure new states get sequential numbers
          const existingNums = projectCharacter.states.map((s) => s.num || 0)
          const maxNum =
            existingNums.length > 0 ? Math.max(...existingNums) : -1
          const newNum = maxNum + 1

          const state = await models.CharacterState.create(
            {
              name: stateObj.name,
              num: newNum,
              character_id: characterId,
              user_id: user.user_id,
            },
            {
              transaction: transaction,
              user: user,
            }
          )
          stateNameMap.set(state.name, state)
          projectCharacter.states.push(state)
        }
      }
    }
  }
  const cellsTable = await getCells(matrixId)
  const cellNotes = await getCellNotes(matrixId)
  const cellNotesTable = new Table()
  for (const cellNote of cellNotes) {
    const characterId = parseInt(cellNote.character_id)
    const taxonId = parseInt(cellNote.taxon_id)
    cellNotesTable.set(taxonId, characterId, cellNote)
  }

  const missingSymbol = matrixObj.parameters?.MISSING || '?'
  const gapSymbol = matrixObj.parameters?.GAP || '?'
  const symbols = parseSymbols(matrixObj.parameters?.SYMBOLS)

  for (let x = 0, l = matrixObj.cells.length; x < l; ++x) {
    const cellsInsertions = []
    const notesInsertions = []
    const cellRow = matrixObj.cells[x]
    const taxonId = matrixObj.taxa[x].taxonId
    for (let y = 0, l = cellRow.length; y < l; ++y) {
      const characterId = matrixObj.characters[y].characterId
      const character = projectCharactersMap.get(characterId)

      let note
      let isUncertain = 0
      let cell = cellRow[y]
      if (typeof cell === 'object' || cell instanceof Object) {
        isUncertain = !!cell.uncertain
        note = cell.note
        cell = cell.scores
      }

      if (note) {
        const existingNote = cellNotesTable.get(taxonId, characterId)
        if (existingNote && !contains(existingNote, note)) {
          note = existingNote + '\n' + note
        }
        notesInsertions.push({
          matrix_id: matrixId,
          taxon_id: taxonId,
          character_id: characterId,
          user_id: user.user_id,
          notes: note,
          source: 'IMPORT',
        })
      }

      const isContinuous = character.type > 0
      if (isContinuous) {
        const values = cell.split(/[,;\-–]/g)
        if (values.length == 0) {
          continue
        }
        if (values[0] == '?') {
          continue
        }
        for (let i = 0; i < values.length; ++i) {
          const trimmedValue = values[i].trim()
          // Handle empty strings, missing data markers, and invalid values
          if (trimmedValue === '' || trimmedValue === '?' || trimmedValue === '-') {
            values[i] = null
          } else {
            const parsedValue = parseFloat(trimmedValue)
            values[i] = isNaN(parsedValue) ? null : parsedValue
          }
        }

        if (values[0] == undefined || values[0] == null) {
          continue
        }

        // Check if continuous cell already exists with same values
        const existingCell = cellsTable.get(taxonId, characterId)
        const startValue = values[0]
        const endValue = values[1]

        if (
          existingCell &&
          existingCell.some(
            (cell) =>
              cell.start_value === startValue &&
              (cell.end_value === endValue ||
                (cell.end_value == null && endValue == null))
          )
        ) {
          continue
        }

        cellsInsertions.push({
          matrix_id: matrixId,
          taxon_id: taxonId,
          character_id: characterId,
          user_id: user.user_id,
          start_value: startValue,
          end_value: endValue,
        })
      } else {
        const existingCell = cellsTable.get(taxonId, characterId)
        const scores = cell.toUpperCase().split('')
        for (const score of scores) {
          if (score == missingSymbol) {
            continue
          }

          if (score == gapSymbol || score == '-' || score == '–') {
            if (
              !existingCell ||
              !existingCell.some((score) => score.state_id == null)
            ) {
              cellsInsertions.push({
                matrix_id: matrixId,
                taxon_id: taxonId,
                character_id: characterId,
                user_id: user.user_id,
              })
            }
            continue
          }

          let index
          if (symbols && Object.keys(symbols).length > 0) {
            index = symbols[score]
          } else if (score >= '0' && score <= '9') {
            index = parseInt(score)
          } else {
            index = score.toUpperCase().charCodeAt(0) - 65 // A
          }

          if (index == undefined || index < 0) {
            console.error(
              `ERROR: Could not parse cell value at position [${x}, ${y}]`
            )
            console.error(
              `  - Taxon: ${matrixObj.taxa[x].name} (ID: ${taxonId})`
            )
            console.error(
              `  - Character: ${
                character.name || 'unnamed'
              } (ID: ${characterId})`
            )
            console.error(`  - Cell value: "${score}" (type: ${typeof score})`)
            console.error(
              `  - Symbols available: ${
                Object.keys(symbols).length > 0
                  ? JSON.stringify(symbols)
                  : 'none (using numeric/alpha parsing)'
              }`
            )
            console.error(`  - Parsed index: ${index}`)
            throw `Undefined cell state ${score} at position [${x}, ${y}] for character ${
              character.name || characterId
            }`
          }

          const state = character.states[index]
          if (!state) {
            console.error(
              `ERROR: Undefined cell state at position [${x}, ${y}]`
            )
            console.error(
              `  - Taxon: ${matrixObj.taxa[x].name} (ID: ${taxonId})`
            )
            console.error(
              `  - Character: ${
                character.name || 'unnamed'
              } (ID: ${characterId})`
            )
            console.error(`  - Cell value: "${score}" -> index: ${index}`)
            console.error(
              `  - Available states: [${character.states
                .map((s, i) => `${i}:${s.name}`)
                .join(', ')}]`
            )
            console.error(`  - Character has ${character.states.length} states`)
            throw `Undefined cell state ${score} (index ${index}) for character ${
              character.name || characterId
            } at position [${x}, ${y}]`
          }

          const stateId = parseInt(state.state_id)
          if (
            existingCell &&
            existingCell.some(
              (existingScore) => existingScore.state_id == stateId
            )
          ) {
            continue
          }

          cellsInsertions.push({
            matrix_id: matrixId,
            taxon_id: taxonId,
            character_id: characterId,
            user_id: user.user_id,
            state_id: stateId,
            is_uncertain: isUncertain,
          })
        }
      }
    }

    if (cellsInsertions.length) {
      // We intentionally to not create to the log tables because this
      // operation is done as a single unit (e.g. upload) and therefore
      // this cannot be rolled back or have any importance to the user.
      await models.Cell.bulkCreate(cellsInsertions, { transaction })

      // Update the cellsTable cache with newly inserted cells to prevent duplicates
      // We need to format the objects to match the database structure for comparison
      for (const cell of cellsInsertions) {
        const taxonId = cell.taxon_id
        const characterId = cell.character_id

        let existingCells = cellsTable.get(taxonId, characterId)
        if (!existingCells) {
          existingCells = []
          cellsTable.set(taxonId, characterId, existingCells)
        }

        // Format the cell to match database structure for proper comparison
        const formattedCell = {
          cell_id: null, // Will be assigned by database
          taxon_id: cell.taxon_id,
          character_id: cell.character_id,
          state_id: cell.state_id || null,
          is_npa: cell.is_npa || false,
          is_uncertain: cell.is_uncertain || false,
          start_value: cell.start_value || null,
          end_value: cell.end_value || null,
        }

        existingCells.push(formattedCell)
      }
    }

    if (notesInsertions.length) {
      await models.CellNote.bulkCreate(notesInsertions, {
        transaction,
        updateOnDuplicate: true,
      })
    }
  }

  const matrixUpload = await models.MatrixFileUpload.create(
    {
      user_id: user.user_id,
      matrix_id: matrixId,
      format: matrixObj.format,
      otu: matrix.otu,
      matrix_note: notes,
      item_note: itemNotes,
    },
    {
      user: user,
      transaction: transaction,
    }
  )

  const fileUploader = new FileUploader(transaction, user)
  await fileUploader.setFile(matrixUpload, 'upload', file)

  const uploadId = parseInt(matrixUpload.upload_id)

  for (const block of matrixObj.blocks) {
    await models.MatrixAdditionalBlock.create(
      {
        matrix_id: matrixId,
        upload_id: uploadId,
        name: block.name,
        content: block.content,
      },
      {
        user: user,
        transaction: transaction,
      }
    )
  }
}

function buildMatrix(title, notes, otu, published, user, projectId) {
  return models.Matrix.build({
    title: title,
    notes: notes,
    otu: otu,
    published: published,
    user_id: user.user_id,
    project_id: projectId,
  })
}

async function getMatrixTaxaMap(matrixId) {
  const matrixTaxa = await models.MatrixTaxaOrder.findAll({
    where: { matrix_id: matrixId },
  })
  const matrixTaxaMap = new Map()
  for (const matrixTaxon of matrixTaxa) {
    const taxonId = parseInt(matrixTaxon.taxon_id)
    matrixTaxaMap.set(taxonId, matrixTaxon)
  }
  return matrixTaxaMap
}

async function getProjectTaxaMap(projectId) {
  const projectTaxa = await models.Taxon.findAll({
    where: { project_id: projectId },
  })
  const projectTaxaMap = new Map()
  for (const projectTaxon of projectTaxa) {
    const taxonId = parseInt(projectTaxon.taxonId)
    projectTaxaMap.set(taxonId, projectTaxon)
  }
  return projectTaxaMap
}

async function getMatrixCharactersMap(matrixId) {
  const matrixCharacters = await models.MatrixCharacterOrder.findAll({
    where: { matrix_id: matrixId },
  })
  const matrixCharactersMap = new Map()
  for (const matrixCharacter of matrixCharacters) {
    const characterId = parseInt(matrixCharacter.character_id)
    matrixCharactersMap.set(characterId, matrixCharacter)
  }
  return matrixCharactersMap
}

async function getCharactersInProjectMap(projectId) {
  const characters = await models.Character.findAll({
    where: { project_id: projectId },
  })
  const charactersMap = new Map()
  for (const character of characters) {
    const characterId = parseInt(character.character_id)
    character.states = []
    charactersMap.set(characterId, character)
  }

  const characterIds = Array.from(charactersMap.keys())
  const states = await models.CharacterState.findAll({
    where: { character_id: characterIds },
  })

  for (const state of states) {
    const characterId = parseInt(state.character_id)
    const character = charactersMap.get(characterId)
    character.states.push(state)
    character.states.sort((a, b) => b.num - a.num)
  }

  return charactersMap
}

function getCharacterType(type) {
  switch (type) {
    case 1:
      return 'continuous'
    case 2:
      return 'meristic'
    case 0:
    default:
      return 'discrete'
  }
}

function contains(text1, text2) {
  text1 = text1.toLowerCase()
  text2 = text2.toLowerCase()
  return text1.length < text2.length
    ? text2.includes(text1)
    : text1.includes(text2)
}

function parseSymbols(symbols) {
  const map = {}
  if (symbols) {
    const symbolArray = symbols.split('')
    for (let i = 0; i < symbolArray.length; i++) {
      const symbol = symbolArray[i]
      // Map each symbol to its numeric value, not its position in the string
      if (symbol >= '0' && symbol <= '9') {
        map[symbol] = parseInt(symbol)
      } else {
        // For non-numeric symbols, map to their position
        map[symbol] = i
      }
    }
  }
  return map
}

/**
 * Parse taxon name parts into a taxon object
 * @param {string[]} taxonNameParts Array of taxon name parts
 * @param {string} otuField The OTU field name for single-name taxa
 * @returns {Object} Taxon object with appropriate fields set
 */
function parseTaxonName(taxonNameParts, otuField) {
  if (!taxonNameParts.length) {
    throw 'Unable to parse taxon name'
  }

  const taxonObj = {
    [otuField]: taxonNameParts[0],
  }

  if (taxonNameParts.length >= 2) {
    taxonObj.genus = taxonNameParts[0]
    taxonObj.specific_epithet = taxonNameParts[1]
  }

  if (taxonNameParts.length > 2) {
    taxonObj.subspecific_epithet = taxonNameParts.slice(2).join(' ')
  }

  return taxonObj
}
