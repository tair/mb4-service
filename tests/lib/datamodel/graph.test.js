import { describe, expect, test } from '@jest/globals'

import { Graph } from '../../../lib/datamodel/graph'
import { Edge } from '../../../lib/datamodel/edge'

describe('Graph Tests', () => {
  test('Test Graph hasNode', () => {
    const graph = new Graph()
    graph.addEdge('a', 'b', new Edge('a', 'b', 10))

    expect(graph.hasNode('a')).toStrictEqual(true)
    expect(graph.hasNode('b')).toStrictEqual(true)
  })
})
