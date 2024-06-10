import { describe, expect, test } from '@jest/globals'

import { getFileNameFromUrl } from 'util/url'

describe('Url Tests', () => {
  test('Test Basic Url', () => {
    const url = 'http://example.com/test.png'
    expect(getFileNameFromUrl(url)).toStrictEqual('test.png')
  })

  test('Test Url with Paths', () => {
    const url = 'http://example.com/aaa/bbb/ccc/test.png'
    expect(getFileNameFromUrl(url)).toStrictEqual('test.png')
  })

  test('Test Url with Parameters', () => {
    const url = 'http://example.com/test.png?a=3&c=4'
    expect(getFileNameFromUrl(url)).toStrictEqual('test.png')
  })

  test('Test Url with Paths and Parameters', () => {
    const url = 'http://example.com/aaa/bbb/ccc/test.png?a=3&c=4'
    expect(getFileNameFromUrl(url)).toStrictEqual('test.png')
  })

  test('Test Url without Filename', () => {
    const url = 'http://example.com/aaa/bbb/ccc/'
    expect(getFileNameFromUrl(url)).toStrictEqual('')
  })

  test('Test Url without path', () => {
    const url = 'http://example.com/'
    expect(getFileNameFromUrl(url)).toStrictEqual('')
  })

  test('Test Url without extension', () => {
    const url = 'http://example.com/abcdefgh'
    expect(getFileNameFromUrl(url)).toStrictEqual('abcdefgh.bin')
  })
})
