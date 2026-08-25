/**
 * Return a random element from an array.
 * @template T
 * @param {T[]} arr
 * @returns {T | undefined}
 */
export function sample(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Return a shuffled copy of an array (Fisher-Yates).
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function shuffle(arr) {
  if (!Array.isArray(arr)) return [];
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Sum numeric values in an array.
 * @param {number[]|Object[]} arr
 * @param {(item:any)=>number} [keyFn]
 * @returns {number}
 */
export function sum(arr, keyFn) {
  if (!Array.isArray(arr)) return 0;
  let total = 0;
  for (const item of arr) {
    const val = typeof keyFn === "function" ? keyFn(item) : item;
    const n = Number(val);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

/**
 * Calculate the arithmetic mean.
 * @param {number[]|Object[]} arr
 * @param {(item:any)=>number} [keyFn]
 * @returns {number}
 */
export function mean(arr, keyFn) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  return sum(arr, keyFn) / arr.length;
}

/**
 * Return the item with the maximum key value.
 * @template T
 * @param {T[]} arr
 * @param {(item:T)=>number} keyFn
 * @returns {T | undefined}
 */
export function maxBy(arr, keyFn) {
  if (!Array.isArray(arr) || arr.length === 0 || typeof keyFn !== "function")
    return undefined;
  let maxItem = arr[0];
  let maxVal = keyFn(maxItem);
  for (let i = 1; i < arr.length; i++) {
    const val = keyFn(arr[i]);
    if (val > maxVal) {
      maxVal = val;
      maxItem = arr[i];
    }
  }
  return maxItem;
}

/**
 * Return the item with the minimum key value.
 * @template T
 * @param {T[]} arr
 * @param {(item:T)=>number} keyFn
 * @returns {T | undefined}
 */
export function minBy(arr, keyFn) {
  if (!Array.isArray(arr) || arr.length === 0 || typeof keyFn !== "function")
    return undefined;
  let minItem = arr[0];
  let minVal = keyFn(minItem);
  for (let i = 1; i < arr.length; i++) {
    const val = keyFn(arr[i]);
    if (val < minVal) {
      minVal = val;
      minItem = arr[i];
    }
  }
  return minItem;
}

/**
 * Return a reversed copy of an array.
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function reverse(arr) {
  if (!Array.isArray(arr)) return [];
  return [...arr].reverse();
}

/**
 * Return unique items present in either array.
 * @template T
 * @param {T[]} a
 * @param {T[]} b
 * @returns {T[]}
 */
export function union(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return [];
  return [...new Set([...a, ...b])];
}

/**
 * Map over object values.
 * @param {Object} obj
 * @param {(value:any,key:string)=>any} fn
 * @returns {Object}
 */
export function mapValues(obj, fn) {
  if (!obj || typeof obj !== "object" || typeof fn !== "function") return {};
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    result[key] = fn(val, key);
  }
  return result;
}

/**
 * Map over object keys.
 * @param {Object} obj
 * @param {(key:string,value:any)=>string} fn
 * @returns {Object}
 */
export function mapKeys(obj, fn) {
  if (!obj || typeof obj !== "object" || typeof fn !== "function") return {};
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    result[fn(key, val)] = val;
  }
  return result;
}

/**
 * Swap keys and values.
 * @param {Object} obj
 * @returns {Object}
 */
export function invert(obj) {
  if (!obj || typeof obj !== "object") return {};
  const result = {};
  for (const [key, val] of Object.entries(obj)) {
    result[String(val)] = key;
  }
  return result;
}

/**
 * Shallow clone.
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function clone(obj) {
  if (obj == null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return [...obj];
  return { ...obj };
}

/**
 * Recursive deep defaults.
 * @param {Object} target
 * @param {...Object} sources
 * @returns {Object}
 */
export function defaultsDeep(target, ...sources) {
  if (!target || typeof target !== "object") return {};
  const result = { ...target };
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    for (const key of Object.keys(src)) {
      if (result[key] === undefined) {
        const val = src[key];
        result[key] =
          val && typeof val === "object" && !Array.isArray(val)
            ? defaultsDeep({}, val)
            : val;
      } else if (
        result[key] &&
        typeof result[key] === "object" &&
        !Array.isArray(result[key]) &&
        src[key] &&
        typeof src[key] === "object" &&
        !Array.isArray(src[key])
      ) {
        result[key] = defaultsDeep(result[key], src[key]);
      }
    }
  }
  return result;
}

/**
 * Pick values from an object at dot-paths.
 * @param {Object} obj
 * @param {string[]} paths
 * @returns {any[]}
 */
export function at(obj, paths) {
  if (!obj || typeof obj !== "object" || !Array.isArray(paths)) return [];
  return paths.map((path) => get(obj, path));
}

/**
 * Remove a nested property by dot-path.
 * @param {Object} obj
 * @param {string} path
 * @returns {boolean}
 */
export function unset(obj, path) {
  if (!obj || typeof obj !== "object" || typeof path !== "string") return false;
  const keys = path.split(".");
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] == null || typeof current[key] !== "object") return false;
    current = current[key];
  }
  const lastKey = keys[keys.length - 1];
  if (Object.prototype.hasOwnProperty.call(current, lastKey)) {
    delete current[lastKey];
    return true;
  }
  return false;
}

/**
 * Compose functions right-to-left.
 * @param {...Function} fns
 * @returns {Function}
 */
export function flow(...fns) {
  return (value) => fns.reduceRight((v, fn) => fn(v), value);
}

/**
 * Negate a predicate.
 * @param {Function} predicate
 * @returns {Function}
 */
export function negate(predicate) {
  if (typeof predicate !== "function")
    throw new TypeError("negate requires a function");
  return function (...args) {
    return !predicate.apply(this, args);
  };
}

/**
 * Count elements by a key extracted from each item.
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => string} iteratee
 * @returns {Record<string, number>}
 */
export function countBy(arr, iteratee) {
  if (!Array.isArray(arr) || typeof iteratee !== "function") return {};
  const map = new Map();
  for (const item of arr) {
    const key = iteratee(item);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Object.fromEntries(map);
}

/**
 * Find the index of the first element matching a predicate.
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => boolean} predicate
 * @returns {number} Index or -1 if not found.
 */
export function findIndex(arr, predicate) {
  if (!Array.isArray(arr) || typeof predicate !== "function") return -1;
  for (let i = 0; i < arr.length; i++) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

/** Type guard: value is null.
 * @param {any} value
 * @returns {boolean}
 */
export function isNull(value) {
  return value === null;
}

/** Type guard: value is undefined.
 * @param {any} value
 * @returns {boolean}
 */
export function isUndefined(value) {
  return value === undefined;
}

/** Type guard: value is null or undefined.
 * @param {any} value
 * @returns {boolean}
 */
export function isNil(value) {
  return value == null;
}

/** Type guard: value is a symbol.
 * @param {any} value
 * @returns {boolean}
 */
export function isSymbol(value) {
  return typeof value === "symbol";
}

/** Type guard: value is a Map.
 * @param {any} value
 * @returns {boolean}
 */
export function isMap(value) {
  return value instanceof Map;
}

/** Type guard: value is a Set.
 * @param {any} value
 * @returns {boolean}
 */
export function isSet(value) {
  return value instanceof Set;
}
