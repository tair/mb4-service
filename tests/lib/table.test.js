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
})
