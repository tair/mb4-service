import { models } from '../../models/init-models.js'
import { Graph } from './graph.js'
import sequelizeConn from '../../util/db.js'
import { getTableNameByNumber } from '../table-number.js'

export class Datamodel {
  static datamodel = null

  constructor() {
    this.graph = new Graph()
    this.referencedTables = new Map()
  }

  #initialize() {
    for (const model in models) {
      this.graph.addNode(sequelizeConn.models[model])
    }

    for (const model in models) {
      const table = sequelizeConn.models[model]
      if (!this.tableExists(table)) {
        throw new Error(`Invalid table ${table.getTableName()}`)
      }

      for (const [field, attributes] of Object.entries(table.rawAttributes)) {
        if (attributes.references) {
          const referencedTableName = attributes.references.model
          const referencedTable = this.getTableByName(referencedTableName)
          if (!this.tableExists(referencedTable)) {
            throw new Error(`Invalid table ${referencedTableName}`)
          }
          const cost = attributes.cost ?? 10
          const referencedKey = attributes.references.key

          const edge = { field, referencedKey, cost }

          this.#addReferencedTables(referencedTable, table)
          this.graph.addEdge(table, referencedTable, edge)
        }
      }
    }
  }

  /**
   * Adds the table to the referencedTable maps so we can keep track of the
   * parent tables to their child table.
   * @param {Model} referencedTable The parent table is referenced by the child.
   * @param {Model} referencingTable The child table that refenced the parent.
   */
  #addReferencedTables(referencedTable, referencingTable) {
    if (this.referencedTables.has(referencedTable)) {
      this.referencedTables.get(referencedTable).push(referencingTable)
    } else {
      this.referencedTables.set(referencedTable, [referencingTable])
    }
  }

  static getInstance() {
    if (Datamodel.datamodel === null) {
      Datamodel.datamodel = new Datamodel()
      Datamodel.datamodel.#initialize()
    }
    return Datamodel.datamodel
  }

  /**
   * Returns field name of primary key for table
   *
   * @param {model} tableName The name of the table
   * @return {Array<string>} A list of the names of the primary keys
   */
  getPrimaryKey(model) {
    const primaryKeys = []
    for (const [field, attributes] of Object.entries(model.rawAttributes)) {
      if (attributes.primaryKey) {
        primaryKeys.push(field)
      }
    }
    return primaryKeys
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

  getTableNames() {
    const tableNames = []
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

  getPath(leftTable, rightTable) {
    return this.graph.getPath(leftTable, rightTable, (edge) => edge.cost)
  }

  /**
   * Gets all the tables this the given table references as foreign keys in its
   * columns.
   *
   * @param {Model} table
   * @returns {Array} An array of tables models.
   */
  getNeighboringTables(table) {
    return this.graph.getNeighboringNodes(table)
  }

  getRelationship(table, neighboringTable) {
    return this.graph.getEdge(table, neighboringTable)
  }

  /**
   * Gets all the tables that contain foreign keys to this table.
   * @param {Model} table
   * @returns {Array} An array of tables models.
   */
  getReferencingTables(table) {
    return this.referencedTables.get(table)
  }
}
