/**
 * @module lru-cache
 * Simple LRU cache with a byte-size budget for string values.
 */

class LRUCache {
  /**
   * @param {Object} options
   * @param {number} [options.maxBytes=256*1024*1024] Maximum total byte budget.
   * @param {number} [options.maxEntries=Infinity] Maximum number of entries.
   */
  constructor(options = {}) {
    this._maxBytes = options.maxBytes || 256 * 1024 * 1024;
    this._maxEntries = options.maxEntries || Infinity;
    this._map = new Map();
    this._currentBytes = 0;
  }

  /** @returns {number} Current byte usage. */
  get byteUsage() {
    return this._currentBytes;
  }

  /** @returns {number} Number of cached entries. */
  get size() {
    return this._map.size;
  }

  /**
   * Get a value and promote it to most-recently-used.
   * @param {string} key
   * @returns {string|undefined}
   */
  get(key) {
    if (!this._map.has(key)) return undefined;
    const value = this._map.get(key);
    // Promote: delete then re-set to move to end
    this._map.delete(key);
    this._map.set(key, value);
    return value;
  }

  /**
   * Set a value, evicting oldest entries if over budget.
   * @param {string} key
   * @param {string} value
   * @returns {boolean} True if the value was cached.
   */
  set(key, value) {
    if (typeof key !== "string" || typeof value !== "string") return false;
    const bytes = Buffer.byteLength(value, "utf8");
    if (bytes > this._maxBytes) return false; // Value too large

    // If already cached, subtract old size
    if (this._map.has(key)) {
      const old = this._map.get(key);
      this._currentBytes -= Buffer.byteLength(old, "utf8");
      this._map.delete(key);
    }

    // Evict until we have room
    while (
      (this._currentBytes + bytes > this._maxBytes ||
        this._map.size >= this._maxEntries) &&
      this._map.size > 0
    ) {
      const firstKey = this._map.keys().next().value;
      const firstValue = this._map.get(firstKey);
      this._currentBytes -= Buffer.byteLength(firstValue, "utf8");
      this._map.delete(firstKey);
    }

    this._map.set(key, value);
    this._currentBytes += bytes;
    return true;
  }

  /**
   * Check if a key exists without changing LRU order.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return this._map.has(key);
  }

  /** Remove all entries. */
  clear() {
    this._map.clear();
    this._currentBytes = 0;
  }
}

module.exports = { LRUCache };
