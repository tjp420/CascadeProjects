/**
 * @module object
 */

/**
 * Deep-clone a serializable object using structured clone when available.
 * Falls back to a recursive walk that preserves Date, RegExp, Map, Set,
 * Array, and plain objects. Uses a WeakMap to handle circular references.
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function deepClone(obj) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch {
      // structuredClone can fail on functions, DOM nodes, etc.
    }
  }
  return _deepClone(obj);
}

/**
 * Pick a subset of keys from an object.
 * @template T, K
 * @param {T} obj
 * @param {K[]} keys
 * @returns {Object}
 */
export function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  if (!keys || typeof keys === 'string' || typeof keys[Symbol.iterator] !== 'function') return result;
  for (const key of keys) {
    if (Object.hasOwn(obj, key)) result[key] = obj[key];
  }
  return result;
}

/**
 * Create a new object without the specified keys.
 * @template T, K
 * @param {T} obj
 * @param {K[]} keys
 * @returns {Object}
 */
export function omit(obj, keys) {
  if (!obj || typeof obj !== 'object') return {};
  const keySet = new Set(
    keys && typeof keys !== 'string' && typeof keys[Symbol.iterator] === 'function' ? keys : []
  );
  const result = {};
  for (const key of Object.keys(obj)) {
    if (!keySet.has(key)) result[key] = obj[key];
  }
  return result;
}

/**
 * Recursive deep merge for plain objects. Arrays are replaced, not merged.
 * @param {Object} target
 * @param {...Object} sources
 * @returns {Object}
 */
export function merge(target, ...sources) {
  if (!target || typeof target !== 'object') return {};
  const result = { ...target };
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const key of Object.keys(src)) {
      const val = src[key];
      if (val && typeof val === 'object' && !Array.isArray(val) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
        result[key] = merge(result[key], val);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

export function clone(obj) {
  if (obj == null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags);
  if (Array.isArray(obj)) return obj.map(clone);
  const result = {};
  for (const key of Object.keys(obj)) result[key] = clone(obj[key]);
  return result;
}

export function deepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  const ta = typeof a;
  const tb = typeof b;
  if (ta !== tb) return false;
  if (ta !== 'object') return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return a.source === b.source && a.flags === b.flags;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.hasOwn(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}

export function defaults(target, ...sources) {
  if (!target || typeof target !== 'object') return {};
  const result = { ...target };
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const key of Object.keys(src)) {
      if (!(key in result)) result[key] = src[key];
    }
  }
  return result;
}

export function invert(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  for (const key of Object.keys(obj)) result[obj[key]] = key;
  return result;
}

export function mapValues(obj, iteratee) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  for (const key of Object.keys(obj)) result[key] = iteratee(obj[key], key, obj);
  return result;
}

export function mapKeys(obj, iteratee) {
  if (!obj || typeof obj !== 'object') return {};
  const result = {};
  for (const key of Object.keys(obj)) result[iteratee(key, obj[key], obj)] = obj[key];
  return result;
}

export function has(obj, path) {
  if (!obj || typeof obj !== 'object') return false;
  const keys = Array.isArray(path) ? path : String(path).split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return false;
    if (!Object.hasOwn(current, key)) return false;
    current = current[key];
  }
  return true;
}

export function get(obj, path, fallback) {
  if (!obj || typeof obj !== 'object') return fallback;
  const keys = Array.isArray(path) ? path : String(path).split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return fallback;
    if (!Object.hasOwn(current, key)) return fallback;
    current = current[key];
  }
  return current === undefined ? fallback : current;
}

export function set(obj, path, value) {
  if (!obj || typeof obj !== 'object') return obj;
  const keys = Array.isArray(path) ? path : String(path).split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') current[key] = {};
    current = current[key];
  }
  current[keys[keys.length - 1]] = value;
  return obj;
}

export function zipObject(keys, values) {
  const result = {};
  if (!Array.isArray(keys)) return result;
  for (let i = 0; i < keys.length; i++) result[keys[i]] = values?.[i];
  return result;
}

export function identity(value) { return value; }

export function constant(value) { return () => value; }

export function at(obj, paths) {
  if (!obj || typeof obj !== 'object') return [];
  const arr = Array.isArray(paths) ? paths : [paths];
  return arr.map(p => get(obj, p));
}

export function unset(obj, path) {
  if (!obj || typeof obj !== 'object') return false;
  const keys = Array.isArray(path) ? path : String(path).split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current || typeof current !== 'object') return false;
    current = current[keys[i]];
  }
  if (!current || typeof current !== 'object') return false;
  const lastKey = keys[keys.length - 1];
  if (!Object.hasOwn(current, lastKey)) return false;
  delete current[lastKey];
  return true;
}

export function defaultsDeep(target, ...sources) {
  if (!target || typeof target !== 'object') return {};
  const result = clone(target);
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const key of Object.keys(src)) {
      if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key]) &&
          src[key] && typeof src[key] === 'object' && !Array.isArray(src[key])) {
        result[key] = defaultsDeep(result[key], src[key]);
      } else if (!(key in result)) {
        result[key] = clone(src[key]);
      }
    }
  }
  return result;
}
