/**
 * Functional utility functions.
 */

/**
 * No-op function.
 */
function noop() {
  /* no-op */
}

/**
 * Exhaustiveness checker; throws for unexpected values.
 * @param {any} value
 * @param {string} [message='Unexpected value']
 * @throws {Error}
 */
function assertNever(value, message = 'Unexpected value') {
  const display = (() => {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  })();
  throw new Error(`${message}: ${display}`);
}

/**
 * Memoize a function result based on JSON-serialized arguments.
 * @param {Function} fn
 * @returns {Function}
 */
function memoize(fn) {
  const cache = new Map();
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

module.exports = { noop, assertNever, memoize };
