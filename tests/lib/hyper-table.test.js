import { describe, expect, test } from '@jest/globals'

import { HyperTable } from 'lib/hyper-table'

describe('HyperTableTests', () => {
  test('Test get', () => {
    const table = new HyperTable()
    table.set('x', 'y', 'i', 'a')
    table.set('x', 'y', 'i', 'b')
    table.set('x', 'y', 'i', 'c')
    table.set('x', 'y', 'j', 'a')
    table.set('x', 'y', 'k', 'b')

    expect(table.get('x', 'y')).toStrictEqual(
      new Map([
        ['i', 'a'],
        ['i', 'b'],
        ['i', 'c'],
        ['j', 'a'],
        ['k', 'b'],
      ])
    )
  })

  test('Test has', () => {
    const table = new HyperTable()
    table.set('x', 'y', 'i', 'a')
    table.set('x', 'y', 'i', 'b')
    table.set('x', 'y', 'i', 'c')
    table.set('x', 'y', 'j', 'a')
    table.set('x', 'y', 'k', 'b')

    expect(table.has('x', 'y', 'i')).toStrictEqual(true)
    expect(table.has('x', 'y', 'j')).toStrictEqual(true)
    expect(table.has('x', 'y', 'k')).toStrictEqual(true)
    expect(table.has('x', 'y', 'z')).toStrictEqual(false)
    expect(table.has('x', 'z', 'i')).toStrictEqual(false)
    expect(table.has('i', 'y', 'i')).toStrictEqual(false)
    expect(table.has('i', 'y')).toStrictEqual(false)
    expect(table.has('i')).toStrictEqual(false)
  })
})
