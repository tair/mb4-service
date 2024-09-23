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
          if (cell.state_id == null && !cell.is_npa) {
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
          const name = generateNameFromStates(cells)
          characterMultipleStates.set(name, cells)
        }

        let x = 0
        for (const [stateName, cells] of characterMultipleStates.entries()) {
          const elementName = cells[0].is_uncertain
            ? 'uncertain_state_set'
            : 'polymorphic_state_set'
          writer.startElement(elementName)
          writer.writeAttribute('id', stateName)
          writer.writeAttribute('symbol', 100 + ++x + character.states?.length)
          for (const cell of cells) {
            const stateId = cell.state_id
            const state = stateId
              ? `state${stateId}`
              : `state_gap${characterId}`
            writer.startElement('member')
            writer.writeAttribute('state', state)
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
      const taxonMap = cellsTable.getMap(taxonId)
      if (taxonMap == undefined) {
        continue
      }

      writer.startElement('row')
      writer.writeAttribute('id', `row${taxonId}`)
      writer.writeAttribute('otu', `otu${taxonId}`)

      for (const character of characters) {
        const characterId = parseInt(character.character_id)
        const cells = taxonMap.get(characterId)
        if (cells == undefined || cells.length == 0) {
          continue
        }

        writer.startElement('cell')
        writer.writeAttribute('char', `char${characterId}`)

        if (cells.length > 1) {
          const stateName = generateNameFromStates(cells)
          writer.writeAttribute('state', stateName)
        } else if (cells[0].state_id == null) {
          writer.writeAttribute('state', `state_gap${characterId}`)
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

function generateNameFromStates(cells) {
  const stateIds = array_unique(cells.map((c) => c.state_id)).sort()
  const name = stateIds.map((id) => id ?? 'gap').join('_')
  const prefix = cells[0].is_uncertain ? 'state_uncertain' : 'state_polymorphic'
  return prefix + '_' + name
}
