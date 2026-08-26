import { isDefined } from "./type.js";

/**
 * Return a de-duplicated copy of an array using a Set.
 * @template T
 * @param {T[]} arr Array to deduplicate.
 * @param {(item:T)=>any} [keyFn] Optional function to extract a comparison key.
 * @returns {T[]}
 */
export function unique(arr, keyFn) {
  if (!Array.isArray(arr)) return [];
  if (!keyFn || typeof keyFn !== "function") {
    return [...new Set(arr)];
  }
  const seen = new Set();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Remove null and undefined values from an array.
 * @template T
 * @param {(T | null | undefined)[]} arr
 * @returns {T[]}
 */
export function compact(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(isDefined);
}

/**
 * Flatten nested arrays into a single-level array.
 * @template T
 * @param {(T | T[])[]} arr
 * @returns {T[]}
 */
export function flatten(arr) {
  const result = [];
  if (!Array.isArray(arr)) return result;
  for (const item of arr) {
    if (Array.isArray(item)) {
      result.push(...flatten(item));
    } else {
      result.push(item);
    }
  }
  return result;
}

/**
 * Generate an array of numbers from `start` (inclusive) to `end` (exclusive).
 * @param {number} start
 * @param {number} [end]
 * @param {number} [step=1]
 * @returns {number[]}
 */
export function range(start, end, step = 1) {
  const s = end === undefined ? 0 : start;
  const e = end === undefined ? start : end;
  if (
    step === 0 ||
    !Number.isFinite(step) ||
    !Number.isFinite(s) ||
    !Number.isFinite(e)
  )
    return [];
  const result = [];
  if (step > 0) {
    for (let i = s; i < e; i += step) result.push(i);
  } else {
    for (let i = s; i > e; i += step) result.push(i);
  }
  return result;
}

/** Split an array into chunks of a given maximum size.
 * @template T
 * @param {T[]} arr Array to split.
 * @param {number} size Maximum chunk size (must be >= 1).
 * @returns {T[][]}
 */
export function chunk(arr, size) {
  if (!Array.isArray(arr)) return [];
  const chunkSize = Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
  const result = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    result.push(arr.slice(i, i + chunkSize));
  }
  return result;
}

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
 * Return a reversed copy of an array (non-mutating).
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function reverse(arr) {
  if (!Array.isArray(arr)) return [];
  return [...arr].reverse();
}

export function union(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return [];
  return [...new Set([...a, ...b])];
}

/** Return items present in both arrays.
 * @template T
 * @param {T[]} a First array.
 * @param {T[]} b Second array.
 * @returns {T[]}
 */
export function intersection(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return [];
  const setB = new Set(b);
  return a.filter((item) => setB.has(item));
}

/**
 * Return items in `a` that are not in `b`.
 * @template T
 * @param {T[]} a First array.
 * @param {T[]} b Second array.
 * @returns {T[]}
 */
export function difference(a, b) {
  if (!Array.isArray(a)) return [];
  if (!Array.isArray(b) || b.length === 0) return [...a];
  const setB = new Set(b);
  return a.filter((item) => !setB.has(item));
}

/**
 * Group array items by a key extracted from each item.
 * @template T, K
 * @param {T[]} arr
 * @param {(item: T) => K} keyFn
 * @returns {Map<K, T[]>}
 */
export function groupBy(arr, keyFn) {
  const map = new Map();
  if (!Array.isArray(arr) || typeof keyFn !== "function") return map;
  for (const item of arr) {
    const key = keyFn(item);
    const list = map.get(key);
    if (list) {
      list.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

/**
 * Split an array into two groups based on a predicate.
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => boolean} predicate
 * @returns {[T[], T[]]}
 */
export function partition(arr, predicate) {
  const pass = [];
  const fail = [];
  if (!Array.isArray(arr) || typeof predicate !== "function")
    return [pass, fail];
  for (const item of arr) {
    if (predicate(item)) {
      pass.push(item);
    } else {
      fail.push(item);
    }
  }
  return [pass, fail];
}

/** Sort an array by a key extracted from each item (stable sort).
 * @template T
 * @param {T[]} arr Array to sort.
 * @param {(item: T) => any} keyFn Function returning the sort key.
 * @param {'asc' | 'desc'} [order='asc'] Sort direction.
 * @returns {T[]}
 */
export function sortBy(arr, keyFn, order = "asc") {
  if (!Array.isArray(arr)) return [];
  if (typeof keyFn !== "function") return [...arr];
  const sorted = [...arr];
  const dir = order === "desc" ? -1 : 1;
  sorted.sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    if (ka === kb || (ka == null && kb == null)) return 0;
    if (ka == null) return dir;
    if (kb == null) return -dir;
    if (typeof ka === "number" && typeof kb === "number")
      return (ka - kb) * dir;
    if (ka instanceof Date && kb instanceof Date)
      return (ka.getTime() - kb.getTime()) * dir;
    return String(ka).localeCompare(String(kb)) * dir;
  });
  return sorted;
}

/**
 * Create a lookup object from an array, using a key-extractor function.
 * @template T
 * @param {T[]} arr Array to index.
 * @param {(item: T) => string} keyFn Function returning the lookup key.
 * @returns {Record<string, T>}
 */
export function keyBy(arr, keyFn) {
  if (!Array.isArray(arr) || typeof keyFn !== "function") return {};
  const result = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (key != null && typeof key === "string") {
      result[key] = item;
    }
  }
  return result;
}

/**
 * Call a function n times and collect the results.
 * @template T
 * @param {number} n
 * @param {(index: number) => T} fn
 * @returns {T[]}
 */
export function times(n, fn) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  const result = [];
  for (let i = 0; i < count; i++) result.push(fn(i));
  return result;
}

export function randomChoice(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Wrap a value in an array if it isn't already one.
 * Null/undefined produces an empty array.
 * @template T
 * @param {T | T[] | null | undefined} value
 * @returns {T[]}
 */
export function ensureArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  return [value];
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
