import { describe, expect, test } from '@jest/globals'

import { Graph } from 'lib/datamodel/graph'

describe('Graph Tests', () => {
  test('hasNode', () => {
    const graph = new Graph()
    graph.addEdge('a', 'b')

    expect(graph.hasNode('a')).toStrictEqual(true)
    expect(graph.hasNode('b')).toStrictEqual(true)
  })

  test('addEdge', () => {
    const graph = new Graph()
    graph.addEdge('a', 'b', 123)

    expect(graph.getEdge('a', 'b')).toStrictEqual(123)
  })

  test('clear', () => {
    const graph = new Graph()
    graph.addEdge('a', 'b')

    expect(graph.hasNode('a')).toStrictEqual(true)
    graph.clear()
    expect(graph.hasNode('a')).toStrictEqual(false)
  })

  test('addNodes and numNodes', () => {
    const graph = new Graph()
    graph.addNode('a')
    graph.addNodes(['b', 'c'])

    expect(graph.numNodes()).toStrictEqual(3)
  })

  test('addNodes do not add duplicates', () => {
    const graph = new Graph()
    graph.addNode('a')
    graph.addNodes(['b', 'c'])
    graph.addNodes(['a', 'b', 'c'])

    expect(graph.numNodes()).toStrictEqual(3)
  })

  test('removeNode', () => {
    const graph = new Graph()
    graph.addNodes(['a', 'b', 'c', 'e', 'f'])
    graph.removeNode('b')
    graph.removeNode('f')

    expect(graph.hasNode('a')).toStrictEqual(true)
    expect(graph.hasNode('c')).toStrictEqual(true)
    expect(graph.hasNode('e')).toStrictEqual(true)
  })

  test('numNodes', () => {
    const graph = new Graph()
    graph.addEdge('a', 'b')
    graph.addEdge('a', 'c')

    expect(graph.numNodes()).toStrictEqual(3)
  })

  test('getNeighboringNodes', () => {
    const graph = new Graph()
    graph.addEdge('a', 'b')
    graph.addEdge('a', 'c')
    graph.addEdge('c', 'd')

    expect(graph.getNeighboringNodes('a')).toEqual(['b', 'c'])
    expect(graph.getNeighboringNodes('b')).toEqual([])
    expect(graph.getNeighboringNodes('c')).toEqual(['d'])
  })

  test('getPath', () => {
    const graph = new Graph()
    graph.addEdge('a', 'b', 4)
    graph.addEdge('a', 'h', 8)
    graph.addEdge('b', 'c', 8)
    graph.addEdge('b', 'h', 11)
    graph.addEdge('c', 'd', 7)
    graph.addEdge('c', 'i', 2)
    graph.addEdge('c', 'f', 4)
    graph.addEdge('d', 'e', 9)
    graph.addEdge('d', 'f', 14)
    graph.addEdge('e', 'f', 10)
    graph.addEdge('f', 'g', 2)
    graph.addEdge('g', 'h', 1)
    graph.addEdge('g', 'i', 6)
    graph.addEdge('h', 'i', 7)

    const costFunction = (edge) => (edge ? edge : Infinity)
    expect(graph.getPath('a', 'b', costFunction)).toEqual(['a', 'b'])
    expect(graph.getPath('a', 'c', costFunction)).toEqual(['a', 'b', 'c'])
    expect(graph.getPath('b', 'g', costFunction)).toEqual(['b', 'c', 'f', 'g'])
  })
})
