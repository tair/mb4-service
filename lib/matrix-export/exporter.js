export class Exporter {
  constructor(writeFunction) {
    this.write = writeFunction
  }

  /**
   * This method should be overrided by subclasses to export it within
   * different formats.
   */
  export() {}

  writeLine(text) {
    this.write(text)
    this.write('\n')
  }

  cleanName(name) {
    return name
      .replace(/<\/?[^>]+(>|$)/g, '')
      .replace(/[']+/g, "''")
      .replace(/[\r\n\t]+/g, ' ')
      .trim()
  }

  cleanText(text) {
    return text
      .replace(/[']+/g, "''")
      .trim()
      .replace(/[\r\n]+/g, '^n')
  }

  getOutputMessage() {
    const date = new Date()
    const year = date.getFullYear()
    const month = date.getMonth() + 1
    const day = date.getDate()
    const hours = ('0' + date.getUTCHours()).slice(-2)
    const minutes = ('0' + date.getUTCMinutes()).slice(-2)
    const seconds = ('0' + date.getUTCSeconds()).slice(-2)
    const dateText = `${year}-${month}-${day} ${hours}.${minutes}.${seconds}`

    return `File output by Morphobank v4.0 (http://www.morphobank.org); ${dateText}`
  }

  /**
   * This method partitions a set of characters by their order such that it is
   * under grouped by their ranges.
   * Ex:
   * [1, 1, 1, 1, 0, 0, 1, 0, 0, 0]
   * Output:
   * [{
   *   order : 1,
   *   range: [[0, 3], [6]],
   *  },
   *  {
   *   order: 0,
   *   ranges: [[4, 5], [7, 9]]],
   *  }]
   *
   * @param {Object} characters
   * @param {Map} characterIndicesMap
   * @returns
   */
  getCharacterOrderings(characters, characterIndicesMap) {
    const orderingMap = new Map()
    for (const character of characters) {
      const ordering = parseInt(character.ordering)
      if (!orderingMap.has(ordering)) {
        orderingMap.set(ordering, [])
      }
      const characterId = parseInt(character.character_id)
      const characterIndex = characterIndicesMap.get(characterId)
      orderingMap.get(ordering).push(characterIndex)
    }

    // If there is only one ordering then we don't need to specify it.
    if (orderingMap.size <= 1) {
      return null
    }

    const consolidatedOrderings = []
    for (const [order, positions] of orderingMap.entries()) {
      const groups = []
      for (let i = 0, l = positions.length; i < l; ++i) {
        if (i > 0 && positions[i - 1] == positions[i] - 1) {
          groups[groups.length - 1].push(positions[i])
        } else {
          groups.push([positions[i]])
        }
      }

      const ranges = []
      for (const group of groups) {
        const range =
          group.length == 1 ? [group[0]] : [group[0], group[group.length - 1]]
        ranges.push(range)
      }

      consolidatedOrderings.push({
        order: order,
        ranges: ranges,
      })
    }

    return consolidatedOrderings
  }
}

export class ExportOptions {
  constructor(matrixId) {
    this.matrixId = matrixId
    this.matrix = null
    this.taxa = null
    this.characters = null
    this.cellsTable = null
    this.includeNotes = false
    this.cellNotes = null
    this.blocks = null
  }
}
