import { Datamodel } from './datamodel/datamodel.js'
import { QueryTypes } from 'sequelize'
import sequelizeConn from '../util/db.js'

/**
 * The purpose of this class is to scan the base model in order to discover its
 * dependencies. This class uses graph information to generate the dependent
 * tables and construct the queries needed to gather the rows to scan.
 */
export class BaseModelScanner {
  constructor(model, modelId) {
    /**
     * Data model instance used for determining foreign key and relationship
     * type between tables.
     *
     * @type {Datamodel}
     */
    this.datamodel = Datamodel.getInstance()

    /**
     * Main table name to duplicate - parent table e.g. projects, matrices,
     * taxa, folios.
     *
     * @type {string}
     */
    this.mainModel = model

    /**
     * The main table's record ID.
     * @type {number}
     */
    this.mainModelId = modelId

    /**
     * The primary key of the main table.
     * @type {string}
     */
    this.mainTablePrimaryKey = this.datamodel.getPrimaryKey(model)

    /**
     * The tables which should be used when duplicating. Tables which are not
     * specified here should be explicitly named in the ignored table list
     * otherwise this will throw an error.
     *
     * @type {Model[]}
     */
    this.duplicatedTables = []

    /**
     * The tables to ignore when duplicating.
     *
     * @type {Model[]}
     */
    this.ignoredTables = []

    /**
     * The tables that have table_num as a parameter and therefore don't have an
     * explicit foreign key.
     *
     * @type {string[]}
     */
    this.numberedTables = []
  }

  setDuplicatedTables(duplicatedTables) {
    this.duplicatedTables = duplicatedTables
  }

  setIgnoredTables(ignoredTables) {
    this.ignoredTables = ignoredTables
  }

  async setTransaction(transaction) {
    this.transaction = transaction
  }

  async getTransaction() {
    return this.transaction
  }

  /**
   * Gets all the dependent tables in topologically sorted order. This is the
   * order in which the tables should be duplicated such that we have cloned
   * values to set in the dependent rows.
   */
  getTopologicalDependentTables() {
    if (this.duplicatedTables.some((t) => this.ignoredTables.includes(t))) {
      throw new Error('Common table exists in duplicated and ignored lists')
    }

    const dependentTables = []

    const visitedTables = new Set()
    // Mark the ignored tables as visited so that they are not included in the
    // returned list.
    for (const ignoredTable of this.ignoredTables) {
      visitedTables.add(ignoredTable)
    }

    const topologicalSort = (table) => {
      if (visitedTables.has(table)) {
        return
      }

      // Add to the visited list so that we don't revisit the table again.
      visitedTables.add(table)
      const neighbors = this.datamodel.getNeighboringTables(table)
      for (const neighbor of neighbors) {
        if (!visitedTables.has(neighbor)) {
          topologicalSort(neighbor)
        }
      }

      if (!this.duplicatedTables.includes(table)) {
        throw new Error(`The table ${table.getTableName()} is not allowlisted`)
      }

      dependentTables.push(table)
    }

    const tableQueue = [this.mainModel]
    while (tableQueue.length != 0) {
      const table = tableQueue.shift()
      // Skip tables which were explicitly ignored.
      if (this.ignoredTables.includes(table)) {
        continue
      }

      topologicalSort(table)

      const refereningTables = this.datamodel.getReferencingTables(table)
      if (refereningTables == null) {
        continue
      }

      for (const refereningTable of refereningTables) {
        if (!visitedTables.has(refereningTable)) {
          tableQueue.push(refereningTable)
        }
      }
    }

    // Reorder the dependent tables so that the numbered tables are below the
    // rest of the tables.
    const numbered = Object.keys(this.numberedTables)
    const diff = dependentTables.filter(
      (table) => !this.numberedTables.includes(table)
    )
    return diff.concat(numbered)
  }

  generateSQLStatementForTable(tableModel) {
    const joiningTables = this.datamodel.getPath(tableModel, this.mainModel)

    const clauses = [`SELECT ${tableModel.getTableName()}.*`]
    clauses.push(`FROM ${tableModel.getTableName()}`)
    for (let x = 1; x < joiningTables.length; ++x) {
      const childTable = joiningTables[x - 1]
      const parentTable = joiningTables[x]

      const childTableName = childTable.getTableName()
      const parentTableName = parentTable.getTableName()
      clauses.push(`INNER JOIN ${parentTableName} ON`)

      const relationship = this.datamodel.getRelationship(
        childTable,
        parentTable
      )
      const field = relationship.field
      clauses.push(`${parentTableName}.${field} = ${childTableName}.${field}`)
    }

    const mainModelName = this.mainModel.getTableName()
    clauses.push(`WHERE ${mainModelName}.${this.mainTablePrimaryKey} = ?`)
    return clauses.join(' ')
  }

  async getRowsForTable(tableModel) {
    const sql = this.generateSQLStatementForTable(tableModel)
    const transaction = this.getTransaction()
    const [rows] = await sequelizeConn.query(sql, {
      replacements: { [this.mainTablePrimaryKey]: this.mainModelId },
      transaction,
      type: QueryTypes.SELECT,
    })
    return rows
  }
}
