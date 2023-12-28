import XMLWriter from 'xml-writer/lib/xml-writer.js'
import { Exporter } from './exporter.js'
import { array_unique } from '../../util/util.js'
import { getTaxonName } from '../../util/taxa.js'

export class NeXMLExporter extends Exporter {
  export({ taxa, characters, cellsTable }) {
    const characterGaps = new Set()
    const charactersMultipleStates = new Map()
    for (const [taxonId, row] of cellsTable.entries()) {
      for (const [characterId, cells] of row.entries()) {
        if (cells.length > 1) {
          if (!charactersMultipleStates.has(characterId)) {
            charactersMultipleStates.set(characterId, [])
          }
          charactersMultipleStates.get(characterId).push(taxonId)
        }
        for (const cell of cells) {
          if (cell.state_id == null) {
            characterGaps.add(characterId)
            break
          }
        }
      }
    }

    const writer = new XMLWriter(true)
    writer.startDocument('1.0', 'UTF-8')
    writer.endDocument()
    writer.startElement('nex:nexml')
    writer.writeAttribute(
      'xmlns:xsi',
      'http://www.w3.org/2001/XMLSchema-instance'
    )
    writer.writeAttribute('xmlns:nex', 'http://www.nexml.org/2009')
    writer.writeAttribute('xmlns:xml', 'http://www.w3.org/XML/1998/namespace')
    writer.writeAttribute(
      'xsi:schemaLocation',
      'http://www.nexml.org/2009 ../xsd/nexml.xsd'
    )

    writer.startElement('otus')
    writer.writeAttribute('id', 'tax1')
    for (const taxon of taxa) {
      const name = this.cleanName(getTaxonName(taxon, null, false, false))
      writer.startElement('otu')
      writer.writeAttribute('id', `otu${taxon.taxon_id}`)
      writer.writeAttribute('label', name)
      writer.endElement() // otu
    }
    writer.endElement() // otus

    writer.startElement('characters')
    writer.writeAttribute('otus', 'tax1')
    writer.writeAttribute('xsi:type', 'nex:StandardCells')
    writer.startElement('format')
    for (const character of characters) {
      const characterId = parseInt(character.character_id)
      writer.startElement('states')
      writer.writeAttribute('id', `states${characterId}`)
      for (const state of character.states) {
        writer.startElement('state')
        writer.writeAttribute('id', `state${state.state_id}`)
        writer.writeAttribute('label', state.name)
        writer.writeAttribute('symbol', state.num)
        writer.endElement() // state
      }

      // Write gaps for the character
      if (characterGaps.has(characterId)) {
        writer.startElement('uncertain_state_set')
        writer.writeAttribute('id', `state_gap${characterId}`)
        writer.writeAttribute('symbol', 100 + character.states?.length)
        writer.endElement() // state
      }

      // Write multiple states for character
      if (charactersMultipleStates.has(characterId)) {
        const characterMultipleStates = new Map()

        for (const taxonId of charactersMultipleStates.get(characterId)) {
          const cells = cellsTable.get(taxonId, characterId)
          const stateIds = array_unique(
            cells.map((c) => c.state_id || 0)
          ).sort()
          const name = stateIds.join('_')
          characterMultipleStates.set(name, stateIds)
        }

        let x = 0
        for (const [stateName, stateIds] of characterMultipleStates.entries()) {
          writer.startElement('uncertain_state_set')
          writer.writeAttribute('id', `uncertain_state_${stateName}`)
          writer.writeAttribute('symbol', 100 + ++x + character.states?.length)
          for (const stateId of stateIds) {
            writer.startElement('member')
            writer.writeAttribute('state', `state${stateId}`)
            writer.endElement() // member
          }
          writer.endElement() // uncertain_state_set
        }
      }
      writer.endElement() // states
    }

    for (const character of characters) {
      writer.startElement('char')
      writer.writeAttribute('id', `char${character.character_id}`)
      writer.writeAttribute('label', character.name)
      writer.writeAttribute('states', `states${character.character_id}`)
      writer.endElement() // char
    }
    writer.endElement() // format

    writer.startElement('matrix')
    for (const taxon of taxa) {
      const taxonId = parseInt(taxon.taxon_id)
      writer.startElement('row')
      writer.writeAttribute('id', `row${taxonId}`)
      writer.writeAttribute('otu', `otu${taxonId}`)
      for (const character of characters) {
        const characterId = parseInt(character.character_id)
        writer.startElement('cell')
        writer.writeAttribute('char', `char${characterId}`)

        const cells = cellsTable.get(taxonId, characterId)
        if (
          cells == undefined ||
          cells.length == 0 ||
          cells[0].state_id == null
        ) {
          writer.writeAttribute('state', `state_gap${characterId}`)
        } else if (cells.length > 1) {
          writer.writeAttribute('state', "uncertain_state_{$va_row['name']}")
        } else {
          writer.writeAttribute('state', `state${cells[0].state_id}`)
        }
        writer.endElement() // row
      }
      writer.endElement() // row
    }

    writer.endElement() // matrix
    writer.endElement() // characters

    writer.endDocument()
    this.write(writer.toString())
  }
}
