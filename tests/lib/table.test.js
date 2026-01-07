import { describe, expect, test } from '@jest/globals'

import { Table } from 'lib/table'

describe('TableTests', () => {
  test('Test get', () => {
    const table = new Table()
    table.set('a', 'b', 'c')
    table.set('c', 'd', 'e')
    table.set('c', 'e', 'f')
    table.set('e', 'f', 'g')
    table.set('e', 'f', 'a')

    expect(table.get('a', 'b')).toStrictEqual('c')
    expect(table.get('c', 'd')).toStrictEqual('e')
    expect(table.get('c', 'e')).toStrictEqual('f')
    expect(table.get('e', 'f')).toStrictEqual('a')
    expect(table.get('a', 'c')).toStrictEqual(undefined)
  })

  test('Test has', () => {
    const table = new Table()
    table.set('a', 'b', 'c')
    table.set('c', 'd', 'e')
    table.set('c', 'e', 'f')
    table.set('e', 'f', 'g')
    table.set('e', 'f', 'a')

    expect(table.has('a', 'b')).toStrictEqual(true)
    expect(table.has('c', 'd')).toStrictEqual(true)
    expect(table.has('c', 'e')).toStrictEqual(true)
    expect(table.has('e', 'f')).toStrictEqual(true)
    expect(table.has('a', 'c')).toStrictEqual(false)
  })

  test('Test delete', () => {
    const table = new Table()
    table.set('a', 'b', 'c')
    table.set('c', 'd', 'e')
    table.set('c', 'e', 'f')

    // Delete existing entry
    expect(table.delete('a', 'b')).toStrictEqual(true)
    expect(table.has('a', 'b')).toStrictEqual(false)
    expect(table.get('a', 'b')).toStrictEqual(undefined)

    // Delete non-existing entry
    expect(table.delete('x', 'y')).toStrictEqual(false)

    // Delete one entry from row with multiple entries
    expect(table.delete('c', 'd')).toStrictEqual(true)
    expect(table.has('c', 'd')).toStrictEqual(false)
    expect(table.has('c', 'e')).toStrictEqual(true) // Other entry in same row should still exist

    // Delete last entry in a row (should clean up the row)
    expect(table.delete('c', 'e')).toStrictEqual(true)
    expect(table.has('c', 'e')).toStrictEqual(false)
  })
})
