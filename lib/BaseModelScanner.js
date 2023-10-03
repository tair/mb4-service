import { Datamodel } from "./datamodel/datamodel.js"

/**
 * The purpose of this class is to scan the base model in order to discover its dependencies. This class uses graph
 * information to generate the dependent tables and construct the queries needed to gather the rows to scan.
 */
export class BaseModelScanner {

    constructor(mainTableName) {
        /**
         * Data model instance used for determining foreign key and relationship type between tables.
         * 
         * @type {Datamodel}
         */
        this.datamodel = Datamodel.getInstance()
        /**
         * Main table name to duplicate - parent table e.g. projects, matrices, taxa, folios
         * 
         * @type {string}
         */
        this.mainTableName = mainTableName
        /**
         * The tables which should be used when duplicating. Tables which are not specified here should be explicitly named
         * in the ignored table list otherwise this will throw an error.
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
         * The tables that have table_num as a parameter and therefore don't have an explicit foreign key.
         * 
         * @type {string[]}
         */
        this.numberedTables = []
    }

    /**
     * Wrapper method for Graph::getNeighbors.
     * 
     * @param {model} table the table to get the neighboring tables of
     * @returns An array of the neighboring tables
     */
    getCustomNeighbors(table) {
        return Array.from(this.datamodel.getGraph().getNeighboringNodes(table))
    }

    /**
     * Gets the table instance.
     * 
     * @param {string} tableName The table name
     * @returns The instance of the table
     */
    getTableInstance(tableName) {
        return this.datamodel.getTableByName(tableName)
    }

    /**
     * Gets all the dependent tables in topologically sorted order. This is the order in which the tables should be
     * duplicated such that we have cloned values to set in the dependent rows.
     */
    getTopologicalDependentTables() {
        if (this.duplicatedTables.some(table => this.ignoredTables.includes(table))) {
            throw new Error('There is a common table in the duplicated and ignored lists.')
        }
        const mainTable = this.getTableInstance(this.mainTableName)
        const dependentTables = [mainTable]
        console.log(mainTable)
        const tableQueue = this.getCustomNeighbors(mainTable)
        const visitedTables = []
        visitedTables.push(mainTable)

        // Mark the ignored tables as visited so that they are not included in the returned list.
        for (const ignoredTable in this.ignoredTables) {
            visitedTables.push(ignoredTable)
        }

        const topologicalSort = (table, visitedTables, dependentTables) => {
            if (visitedTables.includes(table)) {
                return
            }
            // Add to the visited list so that we don't revisit the table again.
            visitedTables.push(table)
            const neighbors = this.getCustomNeighbors(table)
            for (const neighbor in neighbors) {
                if (!visitedTables.includes(neighbor)) {
                    topologicalSort(neighbor, visitedTables, dependentTables)
                }
            }
            if (!this.duplicatedTables.includes(table)) {
                throw new Error('The table ' + table.getTableName() + ' is not allowlisted')
            }
            dependentTables.push(table)
        }

        while (tableQueue.length != 0) {
            console.log(tableQueue)
            const table = tableQueue.shift()
            // Skip tables which were explicitly ignored.
            if (this.ignoredTables.includes(table)) {
                continue
            }
            topologicalSort(table, visitedTables, dependentTables)
            const neighbors = this.getCustomNeighbors(table)
            for (const neighbor in neighbors) {
                if (!visitedTables.includes(neighbor)) {
                    tableQueue.push(neighbor)
                }
            }
        }
        // Reorder the dependent tables so that the numbered tables are below the rest of the tables.
        const numbered = Object.keys(this.numberedTables)
        const diff = dependentTables.filter(table => !this.numberedTables.includes(table))
        return diff.concat(numbered)
    }

}