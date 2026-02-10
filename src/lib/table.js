export class Table {
  constructor() {
    this.map = new Map()
  }

  set(row, col, value) {
    if (!this.map.has(row)) {
      this.map.set(row, new Map())
    }
    const submap = this.map.get(row)
    submap.set(col, value)
  }

  has(row, col) {
    const hasRow = this.map.has(row)
    if (hasRow) {
      const submap = this.map.get(row)
      return submap.has(col)
    }
    return false
  }

  getMap(row) {
    if (!this.map.has(row)) {
      return undefined
    }

    return this.map.get(row)
  }

  get(row, col) {
    if (!this.map.has(row)) {
      return undefined
    }

    const submap = this.map.get(row)
    if (!submap.has(col)) {
      return undefined
    }

    return submap.get(col)
  }

  delete(row, col) {
    if (!this.map.has(row)) {
      return false
    }

    const submap = this.map.get(row)
    const deleted = submap.delete(col)

    // Clean up empty row maps
    if (submap.size === 0) {
      this.map.delete(row)
    }

    return deleted
  }

  [Symbol.iterator]() {
    return this.map[Symbol.iterator]()
  }

  entries() {
    return this.map.entries()
  }

  keys() {
    return this.map.keys()
  }

  values() {
    return this.map.values()
  }
}
