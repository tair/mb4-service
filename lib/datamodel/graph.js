import { PriorityQueue } from '../priority-queue.js'

/**
 * Class that signifies a graph. This is generalized to be a set of nodes of
 * type V and an edge of type E.
 *
 */
export class Graph {
  constructor() {
    /**
     * The underlying graph object. This is an object with nodes and edges.
     * The class contains an adjacency list property called graph that
     * represents the edges between each of the nodes. Each edge can have a
     * weight, which by default is 10.
     *
     * @type {Map<V, Map<V, Edge<E>>>}
     */
    this.graph = new Map()
  }

  clear() {
    this.graph.clear()
  }

  addNode(node) {
    if (!this.graph.has(node)) {
      this.graph.set(node, new Map())
    }
  }

  addNodes(nodes) {
    if (typeof nodes[Symbol.iterator] !== 'function') {
      throw new Error('Parameter to addNodes is not an array')
    }
    for (const node of nodes) {
      this.addNode(node)
    }
  }

  addEdge(source, target, properties = {}) {
    this.addNodes([source, target])
    this.graph.get(source).set(target, new Edge(source, target, properties))
  }

  getEdge(source, target) {
    if (this.graph.has(source)) {
      const neighbors = this.graph.get(source)
      if (neighbors.has(target)) {
        const edge = neighbors.get(target)
        return edge.properties
      }
    }
    return null
  }

  removeEdge(source, node2) {
    if (this.graph.has(source) && this.graph.get(source).has(node2)) {
      this.graph.get(source).delete(node2)
    }
  }

  removeNode(nodeToRemove) {
    if (this.graph.has(nodeToRemove)) {
      this.graph.delete(nodeToRemove)
      // Delete any edges directed to the removed node
      for (const node of this.graph.values()) {
        node.delete(nodeToRemove)
      }
    }
  }

  hasNode(node) {
    return this.graph.has(node)
  }

  getNodes() {
    return this.graph.keys()
  }

  numNodes() {
    return this.graph.size
  }

  getNeighboringNodes(node) {
    return this.graph.has(node) ? Array.from(this.graph.get(node).keys()) : []
  }

  /**
   * This returns a path of nodes given a start and an end node; it always returns the shortest path between the
   * nodes. The weights of each edge must be nonnegative.
   *
   * Implements Dijkstra's Single-Source Shortest Path Algorithm.
   * @param {string} startNode
   * @param {string} endNode
   * @return array
   */
  getPath(startNode, endNode, costFunction) {
    if (!this.hasNode(startNode) || !this.hasNode(endNode)) {
      throw new Error('Start or end node does not exist in the graph.')
    }

    const distances = new Map()
    const previous = new Map()

    const queue = new PriorityQueue()
    for (const node of this.getNodes()) {
      distances.set(node, Infinity)
      previous.set(node, null)
      queue.insert(Infinity, node)
    }

    distances.set(startNode, 0)

    while (!queue.isEmpty()) {
      const node = queue.remove()
      for (const neighbor of this.getNeighboringNodes(node)) {
        const edge = this.getEdge(node, neighbor)
        if (edge == null) {
          continue
        }

        const cost = distances.get(node) + costFunction(edge)
        if (cost < distances.get(neighbor)) {
          distances.set(neighbor, cost)
          previous.set(neighbor, node)
          queue.upsert(cost, neighbor)
        }
      }
    }

    // Reconstruct the shortest path by traversing the previous nodes.
    const shortestPath = []
    for (let node = endNode; node != null; node = previous.get(node)) {
      shortestPath.push(node)
    }
    return shortestPath.reverse()
  }
}

/** Class that signifies an edge in the graph */
class Edge {
  constructor(source, target, properties = {}) {
    this.source = source
    this.target = target
    this.properties = properties
  }
}
