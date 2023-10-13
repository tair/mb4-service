/** * @fileoverview Datastructure: PriorityQueue.
 *
 *
 * This file provides the implementation of a PriorityQueue data structure. Smaller keys
 * rise to the top.
 *
 * The big-O notation for all operations are below:
 * <pre>
 *  Method          big-O
 * ----------------------------------------------------------------------------
 * - insert         O(logn)
 * - remove         O(logn)
 * - peek           O(1)
 * - contains       O(n)
 * </pre>
 */

/**
 * Class for a PriorityQueue data structure.
 *
 * @template K, V
 */
export class PriorityQueue {
  constructor() {
    /**
     * The nodes of the heap.
     *
     * This is a densely packed array containing all nodes of the heap, using
     * the standard flat representation of a tree as an array (i.e. element [0]
     * at the top, with [1] and [2] as the second row, [3] through [6] as the
     * third, etc). Thus, the children of element `i` are `2i+1` and `2i+2`, and
     * the parent of element `i` is `⌊(i-1)/2⌋`.
     *
     * The only invariant is that children's keys must be greater than parents'.
     *
     * @private @const {!Array<!Node>}
     */
    this.nodes = []
  }

  /**
   * Insert the given value into the heap with the given key.
   * @param {K} key The key.
   * @param {V} value The value.
   */
  insert(key, value) {
    const node = new Node(key, value)
    this.nodes.push(node)
    this.#moveUp(this.nodes.length - 1)
  }

  /**
   * Insert the given value into the heap with the given key.
   * @param {K} key The key.
   * @param {V} value The value.
   */
  upsert(key, value) {
    const index = this.nodes.findIndex((n) => n.value == value)
    if (index < 0) {
      this.insert(key, value)
      return
    }

    const node = this.nodes[index]
    node.key = key
    this.#moveUp(index)
    this.#moveDown(index)
  }

  /**
   * Retrieves and removes the root value of this heap.
   * @return {V} The value removed from the root of the heap.  Returns
   *     undefined if the heap is empty.
   */
  remove() {
    const count = this.nodes.length
    const rootNode = this.nodes[0]
    if (count <= 0) {
      return undefined
    } else if (count == 1) {
      this.nodes.length = 0
    } else {
      this.nodes[0] = this.nodes.pop()
      this.#moveDown(0)
    }
    return rootNode.value
  }

  /**
   * Retrieves but does not remove the root value of this heap.
   * @return {V} The value at the root of the heap. Returns
   *     undefined if the heap is empty.
   */
  peek() {
    return this.nodes.length == 0 ? undefined : this.nodes[0].value
  }

  /**
   * Retrieves but does not remove the key of the root node of this heap.
   * @return {K} The key at the root of the heap. Returns undefined if the
   *     heap is empty.
   */
  peekKey() {
    return this.nodes[0] && this.nodes[0].key
  }

  /**
   * Moves the node at the given index down to its proper place in the heap.
   * @param {number} index The index of the node to move down.
   * @private
   */
  #moveDown(index) {
    const count = this.nodes.length

    // Save the node being moved down.
    const node = this.nodes[index]
    // While the current node has a child.
    while (index < count >> 1) {
      const leftChildIndex = this.#getLeftChildIndex(index)
      const rightChildIndex = this.#getRightChildIndex(index)
      const rightNode = this.nodes[rightChildIndex]
      const leftNode = this.nodes[leftChildIndex]
      // Determine the index of the smaller child.
      const smallerChildIndex =
        rightChildIndex < count && rightNode.key < leftNode.key
          ? rightChildIndex
          : leftChildIndex

      // If the node being moved down is smaller than its children, the node
      // has found the correct index it should be at.
      if (this.nodes[smallerChildIndex].key > node.key) {
        break
      }

      // If not, then take the smaller child as the current node.
      this.nodes[index] = this.nodes[smallerChildIndex]
      index = smallerChildIndex
    }
    this.nodes[index] = node
  }

  /**
   * Moves the node at the given index up to its proper place in the heap.
   * @param {number} index The index of the node to move up.
   * @private
   */
  #moveUp(index) {
    const node = this.nodes[index]

    // While the node being moved up is not at the root.
    while (index > 0) {
      // If the parent is greater than the node being moved up, move the parent
      // down.
      const parentIndex = this.#getParentIndex(index)
      if (this.nodes[parentIndex].key > node.key) {
        this.nodes[index] = this.nodes[parentIndex]
        index = parentIndex
      } else {
        break
      }
    }
    this.nodes[index] = node
  }

  /**
   * Gets the index of the left child of the node at the given index.
   * @param {number} index The index of the node to get the left child for.
   * @return {number} The index of the left child.
   * @private
   */
  #getLeftChildIndex(index) {
    return index * 2 + 1
  }

  /**
   * Gets the index of the right child of the node at the given index.
   * @param {number} index The index of the node to get the right child for.
   * @return {number} The index of the right child.
   * @private
   */
  #getRightChildIndex(index) {
    return index * 2 + 2
  }

  /**
   * Gets the index of the parent of the node at the given index.
   * @param {number} index The index of the node to get the parent for.
   * @return {number} The index of the parent.
   * @private
   */
  #getParentIndex(index) {
    return (index - 1) >> 1
  }

  /**
   * Gets the values of the heap.
   * @return {!Array<V>} The values in the heap.
   */
  getValues() {
    const values = []
    const l = this.nodes.length
    for (let i = 0; i < l; i++) {
      values.push(this.nodes[i].value)
    }
    return values
  }

  /**
   * Gets the keys of the heap.
   * @return {!Array<K>} The keys in the heap.
   */
  getKeys() {
    const keys = []
    const l = this.nodes.length
    for (let i = 0; i < l; i++) {
      keys.push(this.nodes[i].key)
    }
    return keys
  }

  /**
   * Whether the heap contains the given value.
   * @param {V} val The value to check for.
   * @return {boolean} Whether the heap contains the value.
   */
  containsValue(val) {
    return this.nodes.some((node) => node.value == val)
  }

  /**
   * Whether the heap contains the given key.
   * @param {K} key The key to check for.
   * @return {boolean} Whether the heap contains the key.
   */
  containsKey(key) {
    return this.nodes.some((node) => node.key == key)
  }

  /**
   * The number of key-value pairs in the map
   * @return {number} The number of pairs.
   */
  getCount() {
    return this.nodes.length
  }

  /**
   * Returns true if this heap contains no elements.
   * @return {boolean} Whether this heap contains no elements.
   */
  isEmpty() {
    return this.nodes.length === 0
  }

  /**
   * Removes all elements from the heap.
   */
  clear() {
    this.nodes.length = 0
  }
}

/**
 * A generic immutable node. This can be used in various collections that
 * require a node object for its item (such as a heap).
 * @param {K} key Key.
 * @param {V} value Value.
 * @constructor
 * @template K, V
 */
class Node {
  constructor(key, value) {
    this.key = key
    this.value = value
  }
}
