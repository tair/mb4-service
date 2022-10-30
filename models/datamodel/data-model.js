import { TABLE_NUMBER } from './table-number.js'

class DataModel {

  getTableNumber(model) {
    const tableName = model.getTableName()
    return TABLE_NUMBER[tableName]
  }

  getTableNameByNumber(tableNumber) {
    for (const [name, number] of Object.entries(TABLE_NUMBER)) {
      if (number == tableNumber) {
        return name
      }
    }
    return null
  }

}