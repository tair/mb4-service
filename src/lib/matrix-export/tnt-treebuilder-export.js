import { Exporter } from './exporter.js'
import { getTaxonName } from '../../util/taxa.js'

const SYMBOLS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export class TNTTreeBuilderExporter extends Exporter {
  // Specific method for cleaning taxon names in TNT format
  formatTntText(text) {
    return text
      .replace(/;/g, '_') // replace semicolons with underscores
      .replace(/[\r\n\t\s]+/g, '_') // replace whitespace with underscores
      .trim()
  }

  export({ taxa, characters, cellsTable }) {
    const taxaNameMap = new Map()
    const taxaIndicesMap = new Map()
    let currentTaxaIndex = 0
    let maxTaxonNameLength = 0
    for (const taxon of taxa) {
      const taxonId = parseInt(taxon.taxon_id)
      const name = this.formatTntText(this.cleanName(getTaxonName(taxon, null, false, false)))
      taxaIndicesMap.set(taxonId, currentTaxaIndex++)
      taxaNameMap.set(taxonId, name)

      if (maxTaxonNameLength < name.length) {
        maxTaxonNameLength = name.length
      }
    }

    const statesMap = new Map()
    const characterNamesMap = new Map()
    const characterIndicesMap = new Map()
    for (let i = 0, l = characters.length; i < l; ++i) {
      const character = characters[i]
      const characterId = parseInt(character.character_id)
      characterIndicesMap.set(characterId, i)
      const characterName = this.formatTntText(this.cleanName(character.name))
      characterNamesMap.set(characterId, characterName)
      if (character.states) {
        for (const state of character.states) {
          const stateId = parseInt(state.state_id)
          statesMap.set(stateId, state)
        }
      }
    }

    const maxStateLength = characters
      .map((c) => c.states?.length || 0)
      .reduce((a, b) => Math.max(a, b))

    this.writeLine(`nstates num ${maxStateLength};`)
    this.writeLine('xread')
    this.writeLine(`'${this.getOutputMessage()}'`)
    this.writeLine(`${characters.length} ${taxa.length}`)

    const printContinuousCharacters = (continuousCharacters) => {
      this.writeLine('&[cont]')
      for (const taxon of taxa) {
        const taxonId = parseInt(taxon.taxon_id)
        const taxonName = taxaNameMap.get(taxonId)
        this.write(`${taxonName} `)
        this.write(' '.repeat(maxTaxonNameLength + 5 - taxonName.length))
        for (const character of continuousCharacters) {
          const characterId = parseInt(character.character_id)
          const cells = cellsTable.get(taxonId, characterId)
          if (
            cells == undefined ||
            cells.length == 0 ||
            cells[0].start_value == undefined
          ) {
            this.write(' ?')
          } else {
            const startValue = parseFloat(cells[0].start_value)
            const endValue = parseFloat(cells[0].end_value)
            this.write(
              startValue == endValue || !endValue
                ? ` ${startValue}`
                : ` ${startValue}-${endValue}`
            )
          }
        }
        this.write('\n')
      }
      this.write('\n')
    }

    const printDiscreteCharacters = (discreteCharacters) => {
      this.writeLine('&[num]')
      for (const taxon of taxa) {
        const taxonId = parseInt(taxon.taxon_id)
        const taxonName = taxaNameMap.get(taxonId)
        this.write(`${taxonName} `)
        this.write(' '.repeat(maxTaxonNameLength + 5 - taxonName.length))
        for (const character of discreteCharacters) {
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
            } else if (cell.is_npa) {
              this.write('?')
            } else {
              this.write('-')
            }
          } else {
            this.write('[')
            for (const cell of cells) {
              if (cell.state_id) {
                const stateId = parseInt(cell.state_id)
                const state = statesMap.get(stateId)
                const index = parseInt(state.num)
                this.write(SYMBOLS[index])
              } else {
                this.write('-')
              }
            }
            this.write(']')
          }
        }
        this.write('\n')
      }
      this.write('\n')
    }

    const partitionedCharactersByType = partitionArrayByGroup(characters, (c) =>
      parseInt(c.type)
    )
    for (const partitionedCharacters of partitionedCharactersByType) {
      const character = partitionedCharacters[0]
      const isDiscrete = character.type == 0
      if (isDiscrete) {
        printDiscreteCharacters(partitionedCharacters)
      } else {
        printContinuousCharacters(partitionedCharacters)
      }
    }

    this.writeLine(';')

    const orderings = this.getCharacterOrderings(
      characters,
      characterIndicesMap
    )
    if (orderings) {
      const consolidatedOrderings = []

      for (const ordering of orderings) {
        // TNT only supports order and unordered characters.
        if (ordering.order > 1) {
          continue
        }

        const consolidatedGroups = []
        for (const range of ordering.ranges) {
          const text =
            range.length == 1 ? `${range[0]}` : `${range[0]}.${range[1]}`
          consolidatedGroups.push(text)
        }
        const orderSymbol = CCODE_ORDERING[ordering.order]
        const orderingText = `${orderSymbol} ` + consolidatedGroups.join(' ')
        consolidatedOrderings.push(orderingText)
      }
      this.writeLine('ccode ' + consolidatedOrderings.join(' ') + ';')
    }
  }
}

const CCODE_ORDERING = ['-', '+']

/**
 * This function partitions an array into groups such that each group has the
 * same type defined by the partitioning function. This method does not reorder
 * the original array.
 *
 * Ex:
 * [0, 0, 0, 1, 1, 1, 0, 0, 1, 0, 1]
 * Output:
 * [[0, 0, 0], [1, 1, 1], [0, 0], [1], [0], [1]]
 */
function partitionArrayByGroup(array, partitionFunction) {
  const results = []
  let currentType = null
  let currentPartition = null

  for (const value of array) {
    const type = partitionFunction(value)
    if (type != currentType) {
      currentType = type
      currentPartition = []
      results.push(currentPartition)
    }
    currentPartition.push(value)
  }

  return results
}