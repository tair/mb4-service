/** Class that signifies a graph */
export class Graph {
  constructor() {
    /**
     * The underlying graph object. This is an object with nodes and edges.
     * The class contains an adjacency list property called graph that represents the edges
     * between each of the nodes. Each edge can have a weight, which by default is 10.
     *
     * @type {Map<String, Map<String, Edge>>}
     */
    this.graph = new Map()
  }

  clear() {
    this.graph.clear()
    return true
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

  addEdge(node1, node2, edge) {
    this.addNodes([node1, node2])
    this.graph.get(node1).set(node2, edge)
  }

  removeEdge(node1, node2) {
    if (this.graph.has(node1) && this.graph.get(node1).has(node2)) {
      this.graph.get(node1).delete(node2)
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
    return this.graph.has(node) ? this.graph.get(node).keys() : []
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
  getPath(startNode, endNode) {
    if (!this.hasNode(startNode) || !this.hasNode(endNode)) {
      throw new Error('ERROR: Start or end node does not exist in the graph.')
    }

    const unvisited = new Set()
    const distances = new Map()
    const previousNodes = new Map()

    for (const node of this.getNodes()) {
      // Mark all nodes as unvisited
      unvisited.add(node)
      // Assign zero distance value to startNode and Infinity distance
      // value to all other nodes
      distances.set(node, node === startNode ? 0 : Infinity)
    }

    // Set the startNode as the current node
    let currentNode = startNode

    // Continue until all the nodes are visited
    while (unvisited.size >= 0) {
      // For the current node, consider all of its unvisited neighbors
      // and calculate their estimated distances through the current node
      let newCurrentNode = currentNode
      let minDistance = Infinity
      for (const neighbor of this.getNeighboringNodes(currentNode)) {
        if (unvisited.has(neighbor)) {
          const currentDistance = distances.get(currentNode)
          const edge = this.graph.get(currentNode).get(neighbor)
          const neighborDistance = currentDistance + edge.weight
          // Recalculate estimated distance to neighbor if the new
          // distance is less
          if (neighborDistance < distances.get(neighbor)) {
            distances.set(neighbor, neighborDistance)
            // Keep track of the previous node
            previousNodes.set(neighbor, currentNode)
          }
          // The node that is shortest distance from the current node
          // is the next node to visit
          if (neighborDistance < minDistance) {
            minDistance = neighborDistance
            newCurrentNode = neighbor
          }
        }
      }

      // Mark the current node as visited and remove it from the
      // unvisited set
      unvisited.delete(currentNode)

      currentNode = newCurrentNode

      // If we have reached the endNode that means have already
      // found the shortest distance to it
      if (currentNode === endNode) {
        break
      }
    }

    // Reconstruct the shortest path
    const shortestPath = [endNode]
    let previousNode = previousNodes.get(endNode)
    while (previousNode) {
      shortestPath.unshift(previousNode)
      previousNode = previousNodes.get(previousNode)
    }

    return shortestPath
  }

  /**
   * This returns an array of the graph's nodes in topologically sorted order.
   * If the graph is not a DAG, no topological sorting is possible and an empty array is returned.
   * 
   * Implements Kahn's Algorithm.
   * @return {array} An array of the graph's nodes in topologically sorted order.
   */
  topologicalSort() {
    // Create array to store the in-degrees of all nodes and initialize them to 0
    const indegrees = new Map()
    for (const node of this.getNodes()) {
      indegrees.set(node, 0)
    }

    // Traverse all nodes and increment the in-degree of each node's neighbors by 1
    for (const node of this.getNodes()) {
      for (const neighbor of this.getNeighboringNodes(node)) {
        indegrees.set(neighbor, indegrees.get(neighbor) + 1)
      }
    }

    // Create a queue and enqueue all nodes with an in-degree of 0
    const queue = []
    for (const [node, degree] of indegrees) {
      if (degree === 0) {
        queue.push(node)
      }
    }
    
    let visitedCount = 0
    const topologicalOrder = []
    while (queue.length != 0) {
      // Dequeue current node and add it to topological order
      let currentNode = queue.shift()
      topologicalOrder.push(currentNode)

      // Iterate through the current node's neighbors and decrease their in-degree by 1
      for (const neighbor of this.getNeighboringNodes(currentNode)) {
        indegrees.set(neighbor, indegrees.get(neighbor) - 1)
        // If in-degree becomes 0, add it to the queue
        if (indegrees.get(neighbor) === 0) {
          queue.push(neighbor)
        }
      }
      visitedCount++
    }

    // Check if there was a cycle
    if (visitedCount != this.numNodes()) {
      console.log("Cycle detected in datamodel graph")
      return []
    }
    return topologicalOrder
  }

}
