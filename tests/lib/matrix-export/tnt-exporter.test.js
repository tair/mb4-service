import fs from 'fs'
import { describe, expect, jest, test } from '@jest/globals'
import { TNTExporter } from 'lib/matrix-export/tnt-exporter'
import * as util from './util'

describe('TNTExporterTests', () => {
  // The exporters uses the current Data so we have to create a fake one.
  jest.useFakeTimers().setSystemTime(new Date('2024-04-05T12:34:56.000Z'))

  test('Test TNT outputs', () => {
    let text = ''
    const textFunction = (a) => (text += a)

    const exporter = new TNTExporter(textFunction)
    exporter.export({
      matrix: util.matrix,
      taxa: util.taxa,
      characters: util.characters,
      cellsTable: util.createCellTable(util.cells),
      includeNotes: false,
      cellNotes: util.notes,
      blocks: [],
    })

    expectIgnoringWhiteSpace(text, 'tnt-export')
  })
})

function expectIgnoringWhiteSpace(expected, file) {
  expected = expected
    .replace(/\n[\s*\n*]+/g, '\n')
    .replace(/  +/g, ' ')
    .trim()

  const path = `tests/lib/matrix-export/files/${file}.tnt`
  const content = fs.readFileSync(path, { encoding: 'utf8', flag: 'r' })
  const actual = content
    .replace(/\n[\s*\n*]+/g, '\n')
    .replace(/  +/g, ' ')
    .trim()
  expect(expected).toBe(actual)
}
