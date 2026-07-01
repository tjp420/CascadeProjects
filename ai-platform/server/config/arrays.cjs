/**
 * Array aggregation and math helpers.
 * @module arrays
 */

/**
 * Count occurrences of values returned by an iteratee.
 * @param {any[]} arr
 * @param {Function} iteratee
 * @returns {Object<string, number>}
 */
function countBy(arr, iteratee) {
  if (!Array.isArray(arr) || typeof iteratee !== 'function') return {};
  const map = new Map();
  for (const item of arr) {
    const key = iteratee(item);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Object.fromEntries(map);
}

/**
 * Return the item with the maximum iteratee value.
 * @param {any[]} arr
 * @param {Function} iteratee
 * @returns {any | undefined}
 */
function maxBy(arr, iteratee) {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  if (typeof iteratee !== 'function') return arr[0];
  let maxItem = arr[0];
  let maxVal = iteratee(maxItem);
  for (let i = 1; i < arr.length; i++) {
    const val = iteratee(arr[i]);
    if (val > maxVal) { maxVal = val; maxItem = arr[i]; }
  }
  return maxItem;
}

/**
 * Return the item with the minimum iteratee value.
 * @param {any[]} arr
 * @param {Function} iteratee
 * @returns {any | undefined}
 */
function minBy(arr, iteratee) {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  if (typeof iteratee !== 'function') return arr[0];
  let minItem = arr[0];
  let minVal = iteratee(minItem);
  for (let i = 1; i < arr.length; i++) {
    const val = iteratee(arr[i]);
    if (val < minVal) { minVal = val; minItem = arr[i]; }
  }
  return minItem;
}

/**
 * Find the index of the first item matching a predicate.
 * @param {any[]} arr
 * @param {Function} predicate
 * @returns {number}
 */
function findIndex(arr, predicate) {
  if (!Array.isArray(arr) || typeof predicate !== 'function') return -1;
  for (let i = 0; i < arr.length; i++) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

/**
 * Sum numeric values in an array, optionally via an iteratee.
 * @param {any[]} arr
 * @param {Function} [keyFn]
 * @returns {number}
 */
function sum(arr, keyFn) {
  if (!Array.isArray(arr)) return 0;
  let total = 0;
  for (const item of arr) {
    const val = typeof keyFn === 'function' ? keyFn(item) : item;
    const n = Number(val);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

/**
 * Calculate the arithmetic mean, optionally via an iteratee.
 * @param {any[]} arr
 * @param {Function} [keyFn]
 * @returns {number}
 */
function mean(arr, keyFn) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  return sum(arr, keyFn) / arr.length;
}

module.exports = Object.freeze({
  countBy,
  maxBy,
  minBy,
  findIndex,
  sum,
  mean
});
