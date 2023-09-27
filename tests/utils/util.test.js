import { describe, expect, test } from '@jest/globals'

import * as util from '../../util/util'

describe('Util Tests', () => {
  test('Test intersection', () => {
    const array1 = [1, 2, 3]
    const array2 = [3, 4, 5]
    expect(util.array_intersect(array1, array2)).toStrictEqual([3])
  })

  test('Test difference', () => {
    const array1 = [1, 2, 3]
    const array2 = [3, 4, 5]
    expect(util.array_difference(array1, array2)).toStrictEqual([1, 2])
    expect(util.array_difference(array2, array1)).toStrictEqual([4, 5])
  })

  test('Test symmetic difference', () => {
    const array1 = [1, 2, 3]
    const array2 = [3, 4, 5]
    expect(util.array_symmetric_difference(array1, array2)).toStrictEqual([
      1, 2, 4, 5,
    ])
  })

  test('Test unique', () => {
    const array1 = [1, 1, 2, 2, 3, 3, 3]
    expect(util.array_unique(array1)).toStrictEqual([1, 2, 3])
  })

  test('Test capitalize first letter', () => {
    expect(util.capitalizeFirstLetter('dog')).toBe('Dog')
    expect(util.capitalizeFirstLetter('CAT')).toBe('CAT')
  })
})
