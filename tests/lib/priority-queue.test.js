import { describe, expect, test } from '@jest/globals'

import { PriorityQueue } from 'lib/priority-queue'

describe('PriorityQueueTests', () => {
  test('Test insert with reverse order', () => {
    const queue = new PriorityQueue((a, b) => a < b)
    queue.insert(10, 'f')
    queue.insert(20, 'e')
    queue.insert(30, 'd')
    queue.insert(40, 'c')
    queue.insert(50, 'b')
    queue.insert(60, 'a')

    expect(queue.remove()).toStrictEqual('f')
    expect(queue.remove()).toStrictEqual('e')
    expect(queue.remove()).toStrictEqual('d')
    expect(queue.remove()).toStrictEqual('c')
    expect(queue.remove()).toStrictEqual('b')
    expect(queue.remove()).toStrictEqual('a')
  })

  test('Test getCount', () => {
    const queue = new PriorityQueue()
    queue.insert(10, 'a')
    queue.insert(40, 'd')
    queue.insert(70, 'g')
    queue.insert(30, 'c')
    queue.insert(20, 'b')
    queue.insert(60, 'f')
    queue.insert(50, 'e')

    expect(queue.getCount()).toStrictEqual(7)
  })

  test('Test update', () => {
    const queue = new PriorityQueue()
    queue.insert(10, 'a')
    queue.insert(80, 'b')
    queue.insert(30, 'c')
    queue.insert(10, 'd')
    queue.insert(50, 'e')
    queue.insert(15, 'f')
    queue.upsert(20, 'b')
    queue.upsert(40, 'd')
    queue.upsert(60, 'f')

    expect(queue.getCount()).toStrictEqual(6)
    expect(queue.remove()).toStrictEqual('a')
    expect(queue.remove()).toStrictEqual('b')
    expect(queue.remove()).toStrictEqual('c')
    expect(queue.remove()).toStrictEqual('d')
    expect(queue.remove()).toStrictEqual('e')
    expect(queue.remove()).toStrictEqual('f')
  })
})
