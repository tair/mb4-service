
/**
 * The purpose of this class is to scan the base model in order to discover it's dependencies. This class uses graph
 * information to generate the dependent tables and construct the queries needed to gather the rows to scan.
 */
export default class BaseModelScanner {
    constructor(masterTable, itemId) {
        this.masterTable = masterTable
        this.masterItemId = itemId
        this.masterTablePrimaryKey = masterTable.primaryKeyAttribute
        this.duplicatedTables = []
        this.ignoredTables = []
        this.numberedTables = []
    }
}