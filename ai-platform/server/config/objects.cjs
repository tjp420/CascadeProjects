/**
 * Object manipulation utilities.
 * @module objects
 */

/**
 * Deep-assign missing properties from source objects.
 * @param {Object} target
 * @param {...Object} sources
 * @returns {Object}
 */
function defaultsDeep(target, ...sources) {
  if (!target || typeof target !== 'object') return target;
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const key of Object.keys(source)) {
      if (target[key] === undefined) {
        target[key] = source[key];
      } else if (
        target[key] != null &&
        typeof target[key] === 'object' &&
        source[key] != null &&
        typeof source[key] === 'object' &&
        !Array.isArray(target[key]) &&
        !Array.isArray(source[key])
      ) {
        defaultsDeep(target[key], source[key]);
      }
    }
  }
  return target;
}

/**
 * Create a new object with values mapped by a function.
 * @param {Object} obj
 * @param {(value:any,key:string)=>any} fn
 * @returns {Object}
 */
function mapValues(obj, fn) {
  if (!obj || typeof obj !== 'object' || typeof fn !== 'function') return {};
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = fn(val, key);
  }
  return result;
}

/**
 * Create a new object with keys mapped by a function.
 * @param {Object} obj
 * @param {(key:string,value:any)=>string} fn
 * @returns {Object}
 */
function mapKeys(obj, fn) {
  if (!obj || typeof obj !== 'object' || typeof fn !== 'function') return {};
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    result[fn(key, val)] = val;
  }
  return result;
}

/**
 * Invert keys and values of an object.
 * @param {Object} obj
 * @returns {Object}
 */
function invert(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    result[String(val)] = key;
  }
  return result;
}

module.exports = Object.freeze({
  defaultsDeep,
  mapValues,
  mapKeys,
  invert,
});
