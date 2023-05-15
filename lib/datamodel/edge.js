/** Class that signifies an edge in the graph */
class Edge {

    constructor(node1, node2, weight=10, directed=true) {
        this.node1 = node1
        this.node2 = node2
        this.weight = weight
        this.directed = directed
    }

}