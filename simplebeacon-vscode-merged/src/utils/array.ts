// simplebeacon-ignore memory-leak — pure array utility functions
import { isDefined } from './type-guards';

/**
 * Return a de-duplicated copy of an array.
 * Optionally supply a key-extractor function to deduplicate objects by a property.
 * @param {T[]} arr Array to deduplicate.
 * @param {(item:T)=>K} [keyFn] Optional function to derive a comparison key.
 * @returns {T[]}
 */
export function unique<T>(arr: T[]): T[];
export function unique<T, K>(arr: T[], keyFn: (item: T) => K): T[];
export function unique<T, K>(arr: T[], keyFn?: (item: T) => K): T[] {
  if (!Array.isArray(arr)) return [] as T[];
  if (!keyFn || typeof keyFn !== 'function') {
    return [...new Set(arr)];
  }
  const seen = new Set<K>();
  return arr.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
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
export function compact<T>(arr: (T | null | undefined)[]): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter(isDefined);
}

/**
 * Flatten nested arrays into a single-level array.
 * @param {any[]} arr Array that may contain nested arrays.
 * @returns {any[]}
 */
export function flatten<T>(arr: (T | T[])[]): T[] {
  const result: T[] = [];
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
export function range(start: number, end?: number, step = 1): number[] {
  const s = end === undefined ? 0 : start;
  const e = end === undefined ? start : end;
  if (step === 0 || !Number.isFinite(step) || !Number.isFinite(s) || !Number.isFinite(e)) return [];
  const result: number[] = [];
  if (step > 0) {
    for (let i = s; i < e; i += step) result.push(i);
  } else {
    for (let i = s; i > e; i += step) result.push(i);
  }
  return result;
}

/**
 * Sort an array by a key extracted from each item (stable sort).
 * @param {T[]} arr Array to sort.
 * @param {(item: T) => K} keyFn Function returning the sort key.
 * @param {'asc' | 'desc'} [order='asc'] Sort direction.
 * @returns {T[]} New sorted array.
 */
export function sortBy<T, K extends string | number | Date>(
  arr: T[],
  keyFn: (item: T) => K,
  order: 'asc' | 'desc' = 'asc'
): T[] {
  if (!Array.isArray(arr)) return [];
  if (typeof keyFn !== 'function') return [...arr];
  const sorted = [...arr];
  const dir = order === 'desc' ? -1 : 1;
  sorted.sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    if (ka === kb || (ka == null && kb == null)) return 0;
    if (ka == null) return dir;
    if (kb == null) return -dir;
    if (typeof ka === 'number' && typeof kb === 'number') return (ka - kb) * dir;
    if (ka instanceof Date && kb instanceof Date) return (ka.getTime() - kb.getTime()) * dir;
    return String(ka).localeCompare(String(kb)) * dir;
  });
  return sorted;
}

/**
 * Create a lookup object from an array, using a key-extractor function.
 * @param {T[]} arr Array to index.
 * @param {(item: T) => string} keyFn Function returning the lookup key.
 * @returns {Record<string, T>} Object mapping keys to items.
 */
export function keyBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, T> {
  if (!Array.isArray(arr) || typeof keyFn !== 'function') return {};
  const result: Record<string, T> = {};
  for (const item of arr) {
    const key = keyFn(item);
    if (key != null && typeof key === 'string') {
      result[key] = item;
    }
  }
  return result;
}

/**
 * Split an array into chunks of a given maximum size.
 * @param {T[]} arr Array to split.
 * @param {number} size Maximum chunk size (must be >= 1).
 * @returns {T[][]}
 */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (!Array.isArray(arr)) return [];
  const chunkSize = Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    result.push(arr.slice(i, i + chunkSize));
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
export function times<T>(n: number, fn: (index: number) => T): T[] {
  const count = Math.max(0, Math.floor(Number(n) || 0));
  const result: T[] = [];
  for (let i = 0; i < count; i++) result.push(fn(i));
  return result;
}

/**
 * Pick a random element from an array.
 * @template T
 * @param {T[]} arr
 * @returns {T | undefined}
 */
export function randomChoice<T>(arr: T[]): T | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Return items present in both arrays.
 * @template T
 * @param {T[]} a First array.
 * @param {T[]} b Second array.
 * @returns {T[]}
 */
export function intersection<T>(a: T[], b: T[]): T[] {
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
export function difference<T>(a: T[], b: T[]): T[] {
  if (!Array.isArray(a)) return [];
  if (!Array.isArray(b) || b.length === 0) return [...a];
  const setB = new Set(b);
  return a.filter((item) => !setB.has(item));
}

/**
 * Return unique items present in either array (set union).
 * @template T
 * @param {T[]} a First array.
 * @param {T[]} b Second array.
 * @returns {T[]}
 */
export function union<T>(a: T[], b: T[]): T[] {
  if (!Array.isArray(a) && !Array.isArray(b)) return [];
  if (!Array.isArray(a)) return [...new Set(b)];
  if (!Array.isArray(b)) return [...new Set(a)];
  return [...new Set([...a, ...b])];
}

/**
 * Group array items by a key extracted from each item.
 * @param {T[]} arr Array to group.
 * @param {(item: T) => K} keyFn Function that returns the group key.
 * @returns {Map<K, T[]>} Map of keys to arrays of items.
 */
export function groupBy<T, K>(arr: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  if (!Array.isArray(arr) || typeof keyFn !== 'function') return map;
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
 * @param {T[]} arr Array to partition.
 * @param {(item: T) => boolean} predicate Function returning true for the first group.
 * @returns {[T[], T[]]} Tuple of [passing, failing] items.
 */
export function partition<T>(arr: T[], predicate: (item: T) => boolean): [T[], T[]] {
  const pass: T[] = [];
  const fail: T[] = [];
  if (!Array.isArray(arr) || typeof predicate !== 'function') return [pass, fail];
  for (const item of arr) {
    if (predicate(item)) {
      pass.push(item);
    } else {
      fail.push(item);
    }
  }
  return [pass, fail];
}

/**
 * Return a random element from an array.
 * @template T
 * @param {T[]} arr
 * @returns {T | undefined}
 */
export function sample<T>(arr: T[]): T | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Fisher-Yates shuffle — returns a new shuffled array.
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function shuffle<T>(arr: T[]): T[] {
  if (!Array.isArray(arr)) return [];
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Zip multiple arrays into tuples.
 * @template T
 * @param {T[][]} arrays
 * @returns {T[][]}
 */
export function zip<T>(...arrays: T[][]): T[][] {
  if (arrays.length === 0) return [];
  const minLen = Math.min(...arrays.map((a) => a.length));
  const result: T[][] = [];
  for (let i = 0; i < minLen; i++) {
    result.push(arrays.map((a) => a[i]));
  }
  return result;
}

/**
 * Return the first N elements of an array.
 * @template T
 * @param {T[]} arr
 * @param {number} [n=1]
 * @returns {T[]}
 */
export function head<T>(arr: T[], n = 1): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, Math.max(0, Math.floor(Number(n) || 0)));
}

/**
 * Return the last N elements of an array.
 * @template T
 * @param {T[]} arr
 * @param {number} [n=1]
 * @returns {T[]}
 */
export function tail<T>(arr: T[], n = 1): T[] {
  if (!Array.isArray(arr)) return [];
  const count = Math.max(0, Math.floor(Number(n) || 0));
  return arr.slice(-count);
}

/**
 * Alias for flatten that always flattens all nesting levels.
 * @template T
 * @param {(T | T[])[]} arr
 * @returns {T[]}
 */
export function flattenDeep<T>(arr: (T | T[])[]): T[] {
  return flatten(arr);
}

/**
 * Return the first N elements of an array.
 * @template T
 * @param {T[]} arr
 * @param {number} [n=1]
 * @returns {T[]}
 */
export function take<T>(arr: T[], n = 1): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, Math.max(0, Math.floor(Number(n) || 0)));
}

/**
 * Return all but the first N elements of an array.
 * @template T
 * @param {T[]} arr
 * @param {number} [n=1]
 * @returns {T[]}
 */
export function drop<T>(arr: T[], n = 1): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(Math.max(0, Math.floor(Number(n) || 0)));
}

/**
 * Return the last element of an array, or undefined if empty.
 * @template T
 * @param {T[]} arr
 * @returns {T | undefined}
 */
export function last<T>(arr: T[]): T | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  return arr[arr.length - 1];
}

/**
 * Return all but the last element of an array.
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
export function initial<T>(arr: T[]): T[] {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, -1);
}

/**
 * Find the index of the first element matching a predicate.
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => boolean} predicate
 * @returns {number} Index or -1 if not found.
 */
export function findIndex<T>(arr: T[], predicate: (item: T) => boolean): number {
  if (!Array.isArray(arr) || typeof predicate !== 'function') return -1;
  for (let i = 0; i < arr.length; i++) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}

/**
 * Return the element with the maximum iteratee value.
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => number | string} iteratee
 * @returns {T | undefined}
 */
export function maxBy<T>(arr: T[], iteratee: (item: T) => number | string): T | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  if (typeof iteratee !== 'function') return arr[0];
  let maxItem = arr[0];
  let maxVal = iteratee(maxItem);
  for (let i = 1; i < arr.length; i++) {
    const val = iteratee(arr[i]);
    if (val > maxVal) {
      maxVal = val;
      maxItem = arr[i];
    }
  }
  return maxItem;
}

/**
 * Return the element with the minimum iteratee value.
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => number | string} iteratee
 * @returns {T | undefined}
 */
export function minBy<T>(arr: T[], iteratee: (item: T) => number | string): T | undefined {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  if (typeof iteratee !== 'function') return arr[0];
  let minItem = arr[0];
  let minVal = iteratee(minItem);
  for (let i = 1; i < arr.length; i++) {
    const val = iteratee(arr[i]);
    if (val < minVal) {
      minVal = val;
      minItem = arr[i];
    }
  }
  return minItem;
}

/**
 * Count elements by a key extracted from each item.
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => string} iteratee
 * @returns {Record<string, number>}
 */
export function countBy<T>(arr: T[], iteratee: (item: T) => string): Record<string, number> {
  if (!Array.isArray(arr) || typeof iteratee !== 'function') return {};
  const map = new Map<string, number>();
  for (const item of arr) {
    const key = iteratee(item);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Object.fromEntries(map);
}
