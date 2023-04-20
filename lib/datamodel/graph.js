/** Class that signifies a graph */
class Graph {
    /**
      * The underlying graph object. This is an object with nodes and edges.
      * The class contains an adjacency list property called graph that represents the edges
      * between each of the nodes. Each edge can have attributes such as weight (which 
      * by default is 10) and whether or not the edge is directed.
      *
      * */
    graph;
 
    constructor() {
       this.graph = []
    }
 
    clear() {
       this.graph = []
       return true
    }
 
    addNode(node) {
       if (!this.graph[node]) {
          this.graph[node] = []
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
 
    addEdge(node1, node2, weight=10, directed=true) {
       this.graph[node1].push({ node: node2, weight })
       if (!directed) {
          this.graph[node2].push({ node: node1, weight })
       }
    }
 
    removeEdge(node1, node2) {
       this.graph[node1] = this.graph.filter(
          node => node !== node1
       )
    }
 
    removeNode(node) {
       const edges = this.graph[node]
       edges.array.forEach(e => {
          this.removeEdge(e, node)
          if (directed) {
             this.removeEdge(node, e)
          }
          delete this.graph[node]
       })
    }
 
    hasNode(node) {
       return this.graph[node] && Array.isArray(this.graph[node])
    }

}