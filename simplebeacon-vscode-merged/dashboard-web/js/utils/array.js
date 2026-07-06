/**
 * @module array
 */

/**
 * Return an array with duplicate values removed.
 * Optionally supply a key-extractor function to deduplicate objects by a property.
 * @template T
 * @param {T[]} arr Array to deduplicate.
 * @param {(item:T)=>any} [keyFn] Optional function to derive a comparison key.
 * @returns {T[]}
 */
export function unique(arr, keyFn) {
  if (!Array.isArray(arr)) return [];
  if (!keyFn || typeof keyFn !== 'function') {
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
 * Remove null and undefined values from an array, narrowing the type.
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
 * If only one argument is provided, it is treated as `end` and `start` becomes 0.
 * @param {number} start
 * @param {number} [end]
 * @param {number} [step=1]
 * @returns {number[]}
 */
export function range(start, end, step = 1) {
  const s = end === undefined ? 0 : start;
  const e = end === undefined ? start : end;
  if (step === 0 || !Number.isFinite(step) || !Number.isFinite(s) || !Number.isFinite(e)) return [];
  const result = [];
  if (step > 0) {
    for (let i = s; i < e; i += step) result.push(i);
  } else {
    for (let i = s; i > e; i += step) result.push(i);
  }
  return result;
}

/**
 * Split an array into chunks of a given maximum size.
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

export function sample(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle(arr) {
  if (!Array.isArray(arr)) return [];
  const result = arr.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function reverse(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice().reverse();
}

export function union(...arrays) {
  const set = new Set();
  for (const arr of arrays) {
    if (Array.isArray(arr)) for (const item of arr) set.add(item);
  }
  return [...set];
}

export function intersection(arr1, arr2) {
  if (!Array.isArray(arr1) || !Array.isArray(arr2)) return [];
  const set2 = new Set(arr2);
  return arr1.filter(item => set2.has(item));
}

export function difference(arr1, arr2) {
  if (!Array.isArray(arr1)) return [];
  if (!Array.isArray(arr2)) return arr1.slice();
  const set2 = new Set(arr2);
  return arr1.filter(item => !set2.has(item));
}

export function groupBy(arr, keyFn) {
  const map = new Map();
  if (!Array.isArray(arr) || typeof keyFn !== 'function') return map;
  for (const item of arr) {
    const key = keyFn(item);
    const list = map.get(key);
    if (list) list.push(item);
    else map.set(key, [item]);
  }
  return map;
}

export function partition(arr, predicate) {
  const pass = [];
  const fail = [];
  if (!Array.isArray(arr) || typeof predicate !== 'function') return [pass, fail];
  for (const item of arr) {
    if (predicate(item)) pass.push(item);
    else fail.push(item);
  }
  return [pass, fail];
}

export function sortBy(arr, iteratee) {
  if (!Array.isArray(arr)) return [];
  if (typeof iteratee !== 'function') return arr.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return arr.slice().sort((a, b) => {
    const av = iteratee(a);
    const bv = iteratee(b);
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
}

export function keyBy(arr, keyFn) {
  const map = new Map();
  if (!Array.isArray(arr) || typeof keyFn !== 'function') return map;
  for (const item of arr) map.set(keyFn(item), item);
  return map;
}

export function times(n, fn) {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  const result = [];
  for (let i = 0; i < count; i++) result.push(typeof fn === 'function' ? fn(i) : i);
  return result;
}

export function randomChoice(arr) { return sample(arr); }

export function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

export function countBy(arr, keyFn) {
  const map = new Map();
  if (!Array.isArray(arr) || typeof keyFn !== 'function') return map;
  for (const item of arr) {
    const key = keyFn(item);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}
