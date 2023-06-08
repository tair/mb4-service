/** Class that signifies a graph */
class Graph {
     
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

    getNeighboringNodes(node) {
      return this.graph.has(node) ? this.graph.get(node).keys() : []
    }

}