import { Exporter } from './exporter.js'
import { getTaxonName } from '../../util/taxa.js'

const SYMBOLS = '123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export class NexusExporter extends Exporter {
  constructor(writeFunction) {
    super(writeFunction)
  }

  export({
    matrix,
    taxa,
    characters,
    cellsTable,
    includeNotes,
    cellNotes,
    blocks,
  }) {
    this.writeLine('#NEXUS')
    this.writeLine(`[ ${this.getOutputMessage()} ]`)

    this.writeLine('BEGIN TAXA;')
    this.writeLine(`\tDIMENSIONS NTAX=${taxa.length};`)
    let maxTaxonNameLength = 0
    const taxaNameMap = new Map()
    this.writeLine('\tTAXLABELS')

    const taxaIndicesMap = new Map()
    let currentTaxaIndex = 0
    for (const taxon of taxa) {
      const taxonId = parseInt(taxon.taxon_id)
      const name = this.cleanName(getTaxonName(taxon, null, false, false))
      taxaIndicesMap.set(taxonId, ++currentTaxaIndex)
      taxaNameMap.set(taxonId, name)

      this.writeLine(`\t\t'${name}'`)
      if (maxTaxonNameLength < name.length) {
        maxTaxonNameLength = name.length
      }
    }
    this.writeLine('\t;')
    this.writeLine('ENDBLOCK;')

    const isMeristic = matrix.type == 1
    const maxStateLength = characters
      .map((c) => c.states?.length || 0)
      .reduce((a, b) => Math.max(a, b))
    const symbols = SYMBOLS.slice(0, maxStateLength)
    const useCharacterStateLabels = isMeristic
    const dataType = isMeristic ? 'MERISTIC' : 'STANDARD'
    this.writeLine('BEGIN CHARACTERS;')
    this.writeLine(`\tDIMENSIONS NCHAR=${characters.length};`)
    this.writeLine(
      `\tFORMAT DATATYPE=${dataType} GAP=- MISSING=? ${
        isMeristic ? '' : 'SYMBOLS=' + symbols
      };`
    )

    const statesMap = new Map()
    const characterIndicesMap = new Map()
    if (useCharacterStateLabels) {
      this.writeLine('\tCHARSTATELABELS')
      for (let i = 0, l = characters.length; i < l; ++i) {
        const character = characters[i]
        const characterId = parseInt(character.character_id)
        characterIndicesMap.set(characterId, i + 1)
        const characterName = this.cleanName(character.name)
        this.write(`\t\t${i + 1} '${characterName}'`)
        if (characters.states) {
          this.write(' /')
          for (const state of character.states) {
            const stateId = parseInt(state.state_id)
            statesMap.set(stateId, state)
            const stateName = this.cleanName(state.name)
            this.write(` '${stateName}'`)
          }
        }
        if (i - 1 < l) {
          this.writeLine(',')
        }
      }
      this.writeLine('\t;')
    } else {
      this.writeLine('\tCHARLABELS')
      for (let i = 0, l = characters.length; i < l; ++i) {
        const character = characters[i]
        const characterId = parseInt(character.character_id)
        characterIndicesMap.set(characterId, i + 1)
        const characterName = this.cleanName(character.name)
        this.writeLine(`\t\t[${i + 1}] '${characterName}'`)
      }
      this.writeLine('\t;')

      this.writeLine('\tSTATELABELS')
      for (let i = 0, l = characters.length; i < l; ++i) {
        this.writeLine(`\t\t${i + 1}`)
        const character = characters[i]
        if (character.states) {
          for (const state of character.states) {
            const stateId = parseInt(state.state_id)
            statesMap.set(stateId, state)
            const stateName = this.cleanName(state.name)
            this.writeLine(`\t\t\t'${stateName}'`)
          }
        }
        if (i - 1 < l) {
          this.writeLine('\t\t\t,')
        }
      }
      this.writeLine('\t;')
    }

    this.writeLine('\tMATRIX')
    for (const taxon of taxa) {
      const taxonId = parseInt(taxon.taxon_id)
      const taxonName = taxaNameMap.get(taxonId)
      this.write(`\t'${taxonName}' `)
      this.write(' '.repeat(maxTaxonNameLength + 5 - taxonName.length))
      for (const character of characters) {
        if (isMeristic) {
          this.write(' ')
        }
        const characterId = parseInt(character.character_id)
        const cells = cellsTable.get(taxonId, characterId)
        if (cells == undefined || cells.length == 0) {
          this.write('?')
        } else if (cells.length == 1) {
          const cell = cells[0]
          if (cell.state_id) {
            const stateId = parseInt(cell.state_id)
            const state = statesMap.get(stateId)
            const index = parseInt(state.num)
            this.write(SYMBOLS[index])
          } else if (character.type == 2) {
            this.write(`${cell.start_value}`)
          } else if (cell.is_npa) {
            this.write('?')
          } else {
            this.write('-')
          }
        } else {
          const outputCells = []
          for (const cell of cells) {
            if (cell.state_id) {
              const stateId = parseInt(cell.state_id)
              const state = statesMap.get(stateId)
              const index = parseInt(state.num)
              outputCells.push(SYMBOLS[index])
            } else {
              outputCells.push('-')
            }
          }
          this.write(cells[0].is_certain ? '{' : '(')
          this.write(outputCells.join(','))
          this.write(cells[0].is_certain ? '}' : ')')
        }
      }
      this.write('\n')
    }
    this.writeLine(';')
    this.writeLine('ENDBLOCK;')

    if (includeNotes) {
      const hasTaxonNotes = taxa.some((t) => t.notes.trim().length > 0)
      const hasCharacterNotes = characters.some(
        (c) => c.description.trim().length > 0
      )
      if (cellNotes.length || hasTaxonNotes || hasCharacterNotes) {
        this.writeLine('BEGIN NOTES;')
        if (hasTaxonNotes) {
          this.writeLine('[Taxon comments]')
          let index = 0
          for (const taxon of taxa) {
            ++index
            const comment = this.cleanText(taxon.notes)
            if (comment) {
              this.writeLine(`TEXT TAXON=${index} TEXT='${comment}';`)
            }
          }
        }

        if (hasCharacterNotes) {
          this.writeLine('[Character comments]')
          let index = 0
          for (const character of characters) {
            ++index
            const comment = this.cleanText(character.description)
            if (comment) {
              this.writeLine(`TEXT CHARACTER=${index} TEXT='${comment}';`)
            }
          }
        }

        if (cellNotes.length) {
          this.writeLine('[Attribute comments]')
          for (const cellNote of cellNotes) {
            const note = this.cleanText(cellNote.notes)
            if (!note) {
              continue
            }
            const taxonId = parseInt(cellNote.taxon_id)
            const characterId = parseInt(cellNote.character_id)
            const taxonIndex = taxaIndicesMap.get(taxonId)
            const characterIndex = characterIndicesMap.get(characterId)
            this.writeLine(
              `TEXT CHARACTER=${characterIndex} TAXON=${taxonIndex} TEXT='${note}';`
            )
          }
        }
        this.writeLine('ENDBLOCK;')
      }
    }

    const orderings = this.getCharacterOrderings(
      characters,
      characterIndicesMap
    )
    if (orderings) {
      this.writeLine('BEGIN ASSUMPTIONS;')
      const consolidatedOrderings = []

      for (const ordering of orderings) {
        const consolidatedGroups = []
        for (const range of ordering.ranges) {
          const text =
            range.length == 1 ? `${range[0]}` : `${range[0]}-${range[1]}`
          consolidatedGroups.push(text)
        }
        const orderName = CHARACTER_ORDERING_ABBREVIATED[ordering.order]
        const orderingText = `${orderName}: ` + consolidatedGroups.join(' ')
        consolidatedOrderings.push(orderingText)
      }
      this.writeLine(
        'TYPESET * UNTITLED = ' + consolidatedOrderings.join(', ') + ';'
      )

      this.writeLine('ENDBLOCK;')
    }

    for (const block of blocks) {
      this.writeLine(`BEGIN ${block.name};`)
      this.writeLine(block.content)
      this.writeLine('ENDBLOCK;')
    }
  }
}

const CHARACTER_ORDERING_ABBREVIATED = ['unord', 'ord', 'irreversible', 'dollo']
