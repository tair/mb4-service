import { models } from '../../models/init-models.js'
import { Graph } from './graph.js'
import sequelizeConn from '../../util/db.js'
import { getTableNameByNumber } from '../table-number.js'

export class Datamodel {
  constructor() {
    this.graph = new Graph()
    for (const model in models) {
      this.graph.addNode(sequelizeConn.models[model])
    }
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
