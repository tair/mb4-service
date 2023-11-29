/**
 * A collection that maps keys to values, similar to Map, but in which each key
 * may be associated with multiple values. You can visualize the contents of a
 * multimap either as a map from keys to nonempty collections of values:
 *   - a → 1, 2
 *   - b → 3
 *
 * This class is basically a wrapper around Map<K, Set<V>>
 * @param {K} The value of the key.
 * @param {V} The value of the values.
 */
export class Multimap {
  constructor() {
    this.map = new Map()
  }

  /**
   * Gets all the values in the multimap.
   */
  get(key) {
    return this.map.get(key)
  }

  /**
   * Puts a single value in the multimap.
   * @param {K} key
   * @param {V} value
   */
  put(key, value) {
    if (!this.map.has(key)) {
      this.map.set(key, new Set())
    }
    const set = this.map.get(key)
    set.add(value)
  }

  /**
   *
   * @param {K} key
   * @param {V} values
   */
  putAll(key, values) {
    if (!this.map.has(key)) {
      this.map.set(key, new Set())
    }
    const set = this.map.get(key)
    for (const value of set) {
      set.add(value)
    }
  }

  containsKey(key) {
    return this.map.has(key)
  }

  containsValue(key, value) {
    return this.map.has(key) && this.map.get(key).has(value)
  }
}
