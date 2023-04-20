/** Class that signifies a graph */
class Graph {
    /**
      * The underlying graph object. This is an object with nodes and edges.
      * The class contains an adjacency list property that represents the edges
     * between each of the nodes. Each edge can have attributes such as weight (which 
     * by default is 10) and whether or not the edge is directed.
     * 
      */
    adjacencyList;
 
    constructor() {
       this.adjacencyList = []
    }
 
    clear() {
       this.adjacencyList = []
       return true
    }
 
    addNode(node) {
       if (!this.adjacencyList[node]) {
          this.adjacencyList[node] = []
       }
    }
 
    addNodes(nodes) {
       if (!Array.isArray(nodes)) {
          return false
       }
       nodes.forEach(node => {
          this.addNode(node)
       })
    }
 
    addEdge(node1, node2, weight=10, directed=true) {
       this.adjacencyList[node1].push({ node: node2, weight })
       if (!directed) {
          this.adjacencyList[node2].push({ node: node1, weight })
       }
    }
 
    removeEdge(node1, node2) {
       this.adjacencyList[node1] = this.adjacencyList.filter(
          node => node !== node1
       )
       if (!directed) {
          this.adjacencyList[node2] = this.adjacencyList.filter(
             node => node !== node2
          )
       }
    }
 
    removeNode(node) {
       const edges = this.adjacencyList[node]
       edges.array.forEach(e => {
          this.removeEdge(e, node)
          if (directed) {
             this.removeEdge(node, e)
          }
          delete this.adjacencyList[node]
       })
    }
 
    hasNode(node) {
       return this.adjacencyList[node] && Array.isArray(this.adjacencyList[node])
    }
 
    getNode(node) {
       return this.adjacencyList[node]
    }
 
    getNodes() {
       return this.adjacencyList
    }
    
}