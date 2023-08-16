import { models } from "../../models/init-models.js"
import { Graph } from "./graph.js"
import { Edge } from "./edge.js"
import sequelizeConn from "../../util/db.js"
import { getTableNameByNumber } from "../table-number.js"

export class Datamodel {

  static datamodel = null
  
  constructor() {
    this.graph = new Graph()
  }

  initialize() {
    // Add tables
    for (const model in models) {
      this.graph.addNode(sequelizeConn.models[model])
    }
    // Add relationships
    for (const model in models) {
      const table = sequelizeConn.models[model]
      for (const [field, attributes] of Object.entries(table.rawAttributes)) {
        if (attributes.references) {
          const neighborName = attributes.references.model
          const neighbor = this.getTableByName(neighborName)
          if (!this.tableExists(table)) {
            throw new Error('invalid table ' + table.getTableName() + ' in relationship in datamodel definition')
          }
          if (!this.tableExists(neighbor)) {
            throw new Error('invalid table ' + table.getTableName() + ' in relationship in datamodel definition')
          }
          const outgoingEdge = new Edge(table, neighbor)
          const incomingEdge = new Edge(neighbor, table)
          this.graph.addEdge(table, neighbor, outgoingEdge)
          this.graph.addEdge(neighbor, table, incomingEdge)
        }
      }
    }
  }

  static getInstance() {
    if (Datamodel.datamodel === null) {
      Datamodel.datamodel = new Datamodel()
      Datamodel.datamodel.initialize()
    }
    return Datamodel.datamodel
  }

  /**
   * Check if table exists in datamodel
   *
   * @param {model} table The table to check for
   * @return {boolean} True if it exists, false if it doesn't
   */
  tableExists(table) {
    return this.graph.hasNode(table)
  }

  /**
   * Returns field name of primary key for table
   *
   * @param {string} tableName The name of the table
   * @return {string} The name of the primary key
   */
  getTablePrimaryKeyName(tableName) {
    return this.getTableByName(tableName).primaryKeyAttribute
  }

  getTableNames() {
    let tableNames = []
    for (const table of this.graph.getNodes()) {
      tableNames.push(table.getTableName())
    }
    return tableNames
  }

  /**
   * Returns model representing table; model can be used to manipulate records or get information
   * on various table attributes
   *
   * @param {string} tableName Name of table to get
   * @returns Model representing table
   */
  getTableByName(tableName) {
    const tables = [...this.graph.getNodes()]
    return tables.find((table) => table.getTableName() === tableName)
  }

  /**
   * Returns model representing table; model can be used to manipulate records or get information
   * on various table attributes
   *
   * @param {number} tableNumber Number of the table to get
   * @returns Model representing table
   */
  getTableByNumber(tableNumber) {
    const tableName = getTableNameByNumber(tableNumber)
    return this.getTableByName(tableName)
  }
}
