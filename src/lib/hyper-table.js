export class HyperTable {
  constructor() {
    this.map = new Map()
  }

  set(x, y, z, value) {
    if (!this.map.has(x)) {
      this.map.set(x, new Map())
    }
    const submap = this.map.get(x)
    if (!submap.has(y)) {
      submap.set(y, new Map())
    }
    submap.get(y).set(z, value)
  }

  has(x, y, z) {
    if (this.map.has(x)) {
      const submap = this.map.get(x)
      if (submap.has(y)) {
        return submap.get(y).has(z)
      }
    }
    return false
  }

  get(x, y) {
    if (this.map.has(x)) {
      const submap = this.map.get(x)
      if (submap.has(y)) {
        return submap.get(y)
      }
    }
    return undefined
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
