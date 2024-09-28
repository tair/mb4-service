import fs from 'fs'
import { describe, expect, jest, test } from '@jest/globals'
import { NexusExporter } from 'lib/matrix-export/nexus-exporter'
import * as util from './util'

describe('NexusExporterTests', () => {
  // The exporters uses the current Data so we have to create a fake one.
  jest.useFakeTimers().setSystemTime(new Date('2024-04-05T12:34:56.000Z'))

  test('Test Nexus outputs', () => {
    let text = ''
    const textFunction = (a) => (text += a)
    const exporter = new NexusExporter(textFunction)
    exporter.export({
      matrix: util.matrix,
      taxa: util.taxa,
      characters: util.characters,
      cellsTable: util.createCellTable(util.cells),
      includeNotes: false,
      cellNotes: util.notes,
      blocks: [],
    })
    expectIgnoringWhiteSpace(text, 'nexus-export')
  })

  test('Test Nexus with notes', () => {
    let text = ''
    const textFunction = (a) => (text += a)
    const exporter = new NexusExporter(textFunction)
    exporter.export({
      matrix: util.matrix,
      taxa: util.taxa,
      characters: util.characters,
      cellsTable: util.createCellTable(util.cells),
      includeNotes: true,
      cellNotes: util.notes,
      blocks: [],
    })
    expectIgnoringWhiteSpace(text, 'nexus-export-with-notes')
  })
})

function expectIgnoringWhiteSpace(expected, file) {
  expected = expected
    .replace(/\n[\s*\n*]+/g, '\n')
    .replace(/  +/g, ' ')
    .trim()

  const path = `tests/lib/matrix-export/files/${file}.nex`
  const content = fs.readFileSync(path, { encoding: 'utf8', flag: 'r' })
  const actual = content
    .replace(/\n[\s*\n*]+/g, '\n')
    .replace(/  +/g, ' ')
    .trim()
  expect(expected).toBe(actual)
}
