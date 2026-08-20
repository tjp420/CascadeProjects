/**
 * Object / collection utility functions.
 */

/**
 * Create an object composed of picked properties.
 * @param {Object} obj
 * @param {string[]} keys
 * @returns {Object}
 */
function pick(obj, keys) {
  if (!obj || typeof obj !== "object") return {};
  const result = {};
  const keySet = new Set(Array.isArray(keys) ? keys : []);
  for (const key of keySet) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) result[key] = obj[key];
  }
  return result;
}

/**
 * Create an object composed of properties omitted.
 * @param {Object} obj
 * @param {string[]} keys
 * @returns {Object}
 */
function omit(obj, keys) {
  if (!obj || typeof obj !== "object") return {};
  const result = { ...obj };
  const keySet = new Set(Array.isArray(keys) ? keys : []);
  for (const key of keySet) delete result[key];
  return result;
}

/**
 * Remove falsy values from an array.
 * @param {any[]} arr
 * @returns {any[]}
 */
function compact(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(Boolean);
}

/**
 * Group array items by a key function.
 * @param {any[]} arr
 * @param {Function} keyFn
 * @returns {Object}
 */
function groupBy(arr, keyFn) {
  if (typeof keyFn !== "function")
    throw new TypeError("groupBy expects a function");
  const result = {};
  if (!Array.isArray(arr)) return result;
  for (const item of arr) {
    const key = String(keyFn(item));
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
}

/**
 * Index array items by a key function.
 * @param {any[]} arr
 * @param {Function} keyFn
 * @returns {Object}
 */
function keyBy(arr, keyFn) {
  if (typeof keyFn !== "function")
    throw new TypeError("keyBy expects a function");
  const result = {};
  if (!Array.isArray(arr)) return result;
  for (const item of arr) {
    const key = String(keyFn(item));
    result[key] = item;
  }
  return result;
}

/**
 * Create an object from paired keys and values.
 * @param {string[]} keys
 * @param {any[]} values
 * @returns {Object}
 */
function zipObject(keys, values) {
  if (!Array.isArray(keys)) return {};
  const result = {};
  for (let i = 0; i < keys.length; i++) {
    result[keys[i]] = i < (values || []).length ? values[i] : undefined;
  }
  return result;
}

module.exports = { pick, omit, compact, groupBy, keyBy, zipObject };
