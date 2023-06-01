/** Class that signifies a graph */
class Graph {
    /**
      * The underlying graph object. This is an object with nodes and edges.
      * The class contains an adjacency list property called graph that represents the edges
      * between each of the nodes. Each edge can have attributes such as weight (which 
      * by default is 10) and whether or not the edge is directed.
      *
      * */ 
    constructor() {
       this.graph = new Map()
    }
 
    clear() {
       this.graph = new Map()
       return true
    }
 
    addNode(node) {
       if (!this.graph.has(node)) {
          this.graph.set(node, new Map())
       }
    }
 
    addNodes(nodes) {
       if (!Array.isArray(nodes)) {
          throw new Error('Parameter to addNodes is not an array')
      }
       nodes.forEach(node => {
          this.addNode(node)
         })
      }
 
    addEdge(node1, node2, edge) {
      if (!this.graph.has(node1)) {
         this.addNode(node1)
      }
      if (!this.graph.has(node2)) {
         this.addNode(node2)
      }
      this.graph.get(node1).set(node2, edge)
      if (!edge.directed) {
         this.graph.get(node2).set(node1, edge)
      }
   }
 
    removeEdge(node1, node2) {
      if (this.graph.has(node1) && this.graph.get(node1).has(node2)) {
         let edgeToRemove = this.graph.get(node1).get(node2)
         this.graph.get(node1).delete(node2)
         if (!edgeToRemove.directed) {
            this.graph.get(node2).delete(node1)
         }
      }
    }
 
    removeNode(node) {
      if (this.graph.has(node)) {
         const neighbors = this.graph.get(node)
         for (const neighbor of neighbors.keys()) {
            this.graph.get(neighbor).delete(node)
         }
         this.graph.delete(node)
      }
    }
 
    hasNode(node) {
       return this.graph.has(node)
    }

    getNodes() {
      return this.graph.keys()
    }

    getNeighboringNodes(node) {
      return this.graph.has(node) ? this.graph.get(node).values() : []
    }

}