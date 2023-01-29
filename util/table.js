export class Table {
  constructor() {
    this.map = new Map()
  }

  set(key1, key2, mx1, mx2 = undefined) {
    if (!this.map.has(key1)) {
      this.map.set(key1, new Map())
    }
    const submap = this.map.get(key1)
    if (mx2 === undefined) {
      submap.set(key2, mx1)
      return
    }

    if (!submap.has(key2)) {
      submap.set(key2, new Map())
    }
    submap.get(key2).set(mx1, mx2)
  }

  has(key1, key2 = undefined, key3 = undefined) {
    const hasKey1 = this.map.has(key1)
    if (hasKey1 == false || key2 === undefined) {
      return hasKey1
    }

    let submap = this.map.get(key1)
    const hasKey2 = submap.has(key2)
    if (hasKey2 == false || key3 === undefined) {
      return hasKey2
    }

    return submap.get(key2).has(key3)
  }

  get(key1, key2 = undefined, key3 = undefined) {
    if (!this.map.has(key1)) {
      return undefined
    }
    let submap = this.map.get(key1)
    if (key2 === undefined) {
      return submap
    }

    if (!submap.has(key2)) {
      return undefined
    }
    submap = submap.get(key2)
    if (key3 === undefined) {
      return submap
    }

    return submap.get(key3)
  }

  delete(key1, key2 = undefined, key3 = undefined) {
    if (key2 === undefined) {
      return this.map.delete(key1)
    }
    let submap = this.map.get(key1)
    if (!submap) {
      return false
    }
    if (key3 === undefined) {
      return submap.delete(key2)
    }
    submap = submap.get(key2)
    if (!submap) {
      return false
    }
    return submap.delete(key3)
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
