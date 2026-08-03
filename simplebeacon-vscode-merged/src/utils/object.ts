// simplebeacon-ignore memory-leak — pure object utility functions

/**
 * Deep-clone a serializable object.
 * Uses structuredClone when available, falls back to a recursive walk
 * that preserves Date, RegExp, Map, Set, Array, and plain objects.
 * If structuredClone fails, returns a deep copy via recursive walk.
 * @param {T} obj Object to clone.
 * @returns {T} Deep copy of the object, or a shallow copy / the original on failure.
 */
export function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch {
      // structuredClone can fail on functions, DOM nodes, etc.
    }
  }
  return _deepClone(obj) as T;
}

/**
 * Shallow clone a plain object or array.
 * Returns the primitive value unchanged.
 * @template T
 * @param {T} obj
 * @returns {T}
 */
export function clone<T>(obj: T): T {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return [...obj] as T;
  return { ...obj } as T;
}

function _deepClone(obj: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (seen.has(obj)) return seen.get(obj);
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags);
  if (obj instanceof URL) return new URL(obj.href);
  if (obj instanceof Error) {
    const err = new (obj.constructor as new (message: string) => Error)(obj.message);
    err.stack = (obj as Error).stack;
    seen.set(obj, err);
    return err;
  }
  if (obj instanceof Map) {
    const map = new Map();
    seen.set(obj, map);
    for (const [k, v] of obj) {
      map.set(_deepClone(k, seen), _deepClone(v, seen));
    }
    return map;
  }
  if (obj instanceof Set) {
    const set = new Set();
    seen.set(obj, set);
    for (const v of obj) {
      set.add(_deepClone(v, seen));
    }
    return set;
  }
  if (Array.isArray(obj)) {
    const arr: unknown[] = [];
    seen.set(obj, arr);
    for (let i = 0; i < obj.length; i++) {
      arr.push(_deepClone(obj[i], seen));
    }
    return arr;
  }
  if (Buffer.isBuffer(obj)) {
    const buf = Buffer.from(obj);
    seen.set(obj, buf);
    return buf;
  }
  if (obj instanceof Uint8Array) {
    const copy = new Uint8Array(obj);
    seen.set(obj, copy);
    return copy;
  }
  const cloned: Record<string, unknown> = {};
  seen.set(obj, cloned);
  try {
    for (const key of Object.keys(obj)) {
      try {
        cloned[key] = _deepClone((obj as Record<string, unknown>)[key], seen);
      } catch {
        // Skip properties that throw on access (e.g., throwing getters)
      }
    }
  } catch {
    // Object.keys may throw on exotic objects; return the reference as last resort
  }
  return cloned;
}

/**
 * Create a new object with only the specified keys from source.
 * @template T, K extends keyof T
 * @param {T} source
 * @param {K[]} keys
 * @returns {Pick<T, K>}
 */
export function pick<T extends Record<string, unknown>, K extends keyof T>(source: T, keys: K[]): Pick<T, K> {
  if (!source || typeof source !== 'object') return {} as Pick<T, K>;
  const result = {} as Pick<T, K>;
  if (!keys || typeof keys === 'string' || typeof keys[Symbol.iterator] !== 'function') return result;
  for (const key of keys) {
    if (Object.hasOwn(source, key)) result[key] = source[key] as Pick<T, K>[K];
  }
  return result;
}

/**
 * Create a new object without the specified keys from source.
 * @template T
 * @param {T} source
 * @param {string[]} keys
 * @returns {Partial<T>}
 */
export function omit<T extends Record<string, unknown>>(source: T, keys: string[]): Partial<T> {
  if (!source || typeof source !== 'object') return {} as Partial<T>;
  const set = new Set(keys && typeof keys[Symbol.iterator] === 'function' ? keys : []);
  const result = {} as Partial<T>;
  for (const key of Object.keys(source)) {
    if (!set.has(key)) result[key as keyof T] = source[key] as T[keyof T];
  }
  return result;
}

/**
 * Check whether a value is "empty" — null, undefined, empty string, empty array,
 * or an object with no own enumerable keys.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string' || Array.isArray(value)) return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Wrap a value in an array if it isn't already one.
 * Null/undefined produces an empty array.
 * @template T
 * @param {T | T[] | null | undefined} value
 * @returns {T[]}
 */
export function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

/**
 * Deep equality check for plain objects, arrays, Dates, RegExps, Maps, Sets,
 * and primitive values.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return a.source === b.source && a.flags === b.flags;

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
    }
    return true;
  }

  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a) {
      let found = false;
      for (const w of b) {
        if (deepEqual(v, w)) {
          found = true;
          break;
        }
      }
      if (!found) return false;
    }
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  return true;
}

/**
 * Shallow merge: fill only undefined keys on the target.
 * @param {Object} target
 * @param {...Object} sources
 * @returns {Object}
 */
export function defaults(
  target: Record<string, unknown>,
  ...sources: Record<string, unknown>[]
): Record<string, unknown> {
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

/**
 * Recursive deep merge for plain objects. Arrays are replaced, not merged.
 * @param {Object} target
 * @param {...Object} sources
 * @returns {Object}
 */
export function merge(target: Record<string, unknown>, ...sources: Record<string, unknown>[]): Record<string, unknown> {
  if (!target || typeof target !== 'object') return {};
  const result = { ...target };
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const key of Object.keys(src)) {
      const val = src[key];
      if (
        val &&
        typeof val === 'object' &&
        !Array.isArray(val) &&
        result[key] &&
        typeof result[key] === 'object' &&
        !Array.isArray(result[key])
      ) {
        result[key] = merge(result[key] as Record<string, unknown>, val as Record<string, unknown>);
      } else {
        result[key] = val;
      }
    }
  }
  return result;
}

/**
 * Safe own-property check.
 * @param {Object} obj
 * @param {string} key
 * @returns {boolean}
 */
export function has(obj: unknown, key: string): boolean {
  return obj != null && typeof obj === 'object' && Object.hasOwn(obj as Record<string, unknown>, key);
}

/**
 * Safely get a nested property by dot-path string.
 * @param {Object} obj
 * @param {string} path
 * @param {unknown} [fallback]
 * @returns {unknown}
 */
export function get(obj: unknown, path: string, fallback?: unknown): unknown {
  if (!obj || typeof obj !== 'object' || typeof path !== 'string') return fallback;
  const keys = path.split('.');
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return fallback;
    current = (current as Record<string, unknown>)[key];
  }
  return current === undefined ? fallback : current;
}

/**
 * Safely set a nested property by dot-path string.
 * @param {Object} obj
 * @param {string} path
 * @param {unknown} value
 * @returns {Object}
 */
export function set(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  if (!obj || typeof obj !== 'object' || typeof path !== 'string') return obj;
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return obj;
}

/**
 * Create a new object with keys transformed by a function.
 * @template T
 * @param {Record<string, T>} obj
 * @param {(value: T, key: string) => string} fn
 * @returns {Record<string, T>}
 */
export function mapKeys<T>(obj: Record<string, T>, fn: (value: T, key: string) => string): Record<string, T> {
  if (!obj || typeof obj !== 'object') return {};
  const result: Record<string, T> = {};
  for (const key of Object.keys(obj)) {
    const newKey = fn(obj[key], key);
    result[newKey] = obj[key];
  }
  return result;
}

/**
 * Invert an object's keys and values. Values must be string-able.
 * @param {Record<string, string | number>} obj
 * @returns {Record<string, string>}
 */
export function invert(obj: Record<string, string | number>): Record<string, string> {
  if (!obj || typeof obj !== 'object') return {};
  const result: Record<string, string> = {};
  for (const key of Object.keys(obj)) {
    result[String(obj[key])] = key;
  }
  return result;
}

/**
 * Get an object's values as an array.
 * @template T
 * @param {Record<string, T>} obj
 * @returns {T[]}
 */
export function values<T>(obj: Record<string, T>): T[] {
  if (!obj || typeof obj !== 'object') return [];
  return Object.keys(obj).map((key) => obj[key]);
}

/**
 * Get an object's keys as an array.
 * @param {Record<string, unknown>} obj
 * @returns {string[]}
 */
export function keys(obj: Record<string, unknown>): string[] {
  if (!obj || typeof obj !== 'object') return [];
  return Object.keys(obj);
}

/**
 * Recursively freeze an object and all nested objects/arrays.
 * @param {T} obj
 * @returns {T}
 */
export function freezeDeep<T>(obj: T): T {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Object.isFrozen(obj)) return obj;
  const seen = new WeakSet<object>();
  function freeze(val: unknown): unknown {
    if (val == null || typeof val !== 'object') return val;
    if (seen.has(val)) return val;
    if (Object.isFrozen(val)) return val;

    const ctor = (val as any).constructor;
    if (ctor === Date || ctor === RegExp || ctor === WeakMap || ctor === WeakSet) return val;

    if (ctor === Map) {
      seen.add(val);
      for (const [k, v] of val as Map<unknown, unknown>) {
        (val as Map<unknown, unknown>).set(k, freeze(v));
      }
      Object.freeze(val);
      return val;
    }

    if (ctor === Set) {
      seen.add(val);
      const frozenSet = new Set<unknown>();
      for (const v of val as Set<unknown>) {
        frozenSet.add(freeze(v));
      }
      Object.freeze(frozenSet);
      return frozenSet;
    }

    seen.add(val);
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        val[i] = freeze(val[i]);
      }
    } else {
      for (const key of Object.keys(val)) {
        (val as Record<string, unknown>)[key] = freeze((val as Record<string, unknown>)[key]);
      }
    }
    Object.freeze(val);
    return val;
  }
  return freeze(obj) as T;
}

/**
 * Recursively freeze every object in a namespace map.
 * Safely handles Date, RegExp, Map, Set, WeakMap, WeakSet, Promise, and Error.
 * @template T
 * @param {T} ns Namespace object whose values are objects to freeze.
 * @returns {T} Deeply frozen copy of the namespace.
 */
export function freezeNamespace<T extends Record<string, unknown>>(ns: T): T {
  if (ns == null || typeof ns !== 'object') return ns;
  if (Object.isFrozen(ns)) return ns;

  const seen = new WeakMap<object, unknown>();

  function deepFreeze(val: unknown): unknown {
    if (val == null || typeof val !== 'object') return val;
    if (seen.has(val)) return seen.get(val);
    if (Object.isFrozen(val)) return val;

    const ctor = (val as Record<string, unknown>).constructor;
    if (ctor === Date || ctor === RegExp || ctor === WeakMap || ctor === WeakSet || ctor === Promise || ctor === Error)
      return val;
    if (ctor === BigInt) return val;
    if (ctor === URL || ctor === URLSearchParams) return val;
    if (ArrayBuffer.isView(val)) return val;
    if (ctor === ArrayBuffer || ctor === SharedArrayBuffer) return val;

    if (ctor === Map) {
      const frozenMap = new Map<unknown, unknown>();
      seen.set(val, frozenMap);
      for (const [k, v] of val as Map<unknown, unknown>) {
        frozenMap.set(k, deepFreeze(v));
      }
      try {
        Object.freeze(frozenMap);
      } catch (_e) {
        /* ignore */
      }
      return frozenMap;
    }

    if (ctor === Set) {
      const frozenSet = new Set<unknown>();
      seen.set(val, frozenSet);
      for (const v of val as Set<unknown>) {
        frozenSet.add(deepFreeze(v));
      }
      try {
        Object.freeze(frozenSet);
      } catch (_e) {
        /* ignore */
      }
      return frozenSet;
    }

    if (Array.isArray(val)) {
      const frozenArr = new Array(val.length);
      seen.set(val, frozenArr);
      for (let i = 0; i < val.length; i++) {
        frozenArr[i] = deepFreeze(val[i]);
      }
      try {
        Object.freeze(frozenArr);
      } catch (_e) {
        /* ignore */
      }
      return frozenArr;
    }

    const frozenObj: Record<PropertyKey, unknown> = {};
    seen.set(val, frozenObj);
    for (const key of Reflect.ownKeys(val as object)) {
      frozenObj[key] = deepFreeze((val as Record<PropertyKey, unknown>)[key]);
    }
    try {
      Object.freeze(frozenObj);
    } catch (_e) {
      /* ignore */
    }
    return frozenObj;
  }

  const frozen: Record<string, unknown> = {};
  for (const key of Object.keys(ns)) {
    frozen[key] = deepFreeze(ns[key]);
  }
  return Object.freeze(frozen) as T;
}

/**
 * Map over object values, returning a new object.
 * @template T, R
 * @param {Record<string, T>} obj
 * @param {(value: T, key: string) => R} iteratee
 * @returns {Record<string, R>}
 */
export function mapValues<T, R>(obj: Record<string, T>, iteratee: (value: T, key: string) => R): Record<string, R> {
  if (!obj || typeof obj !== 'object') return {};
  const result: Record<string, R> = {};
  for (const key of Object.keys(obj)) {
    result[key] = iteratee(obj[key], key);
  }
  return result;
}

/**
 * Pick values from an object by path strings.
 * @template T
 * @param {Record<string, T>} obj
 * @param {string[]} paths
 * @returns {T[]}
 */
export function at<T>(obj: Record<string, T>, paths: string[]): T[] {
  if (!obj || typeof obj !== 'object') return [];
  if (!Array.isArray(paths)) return [];
  const result: T[] = [];
  for (const p of paths) {
    const parts = String(p).split('.');
    let current: unknown = obj;
    for (const part of parts) {
      current = (current as Record<string, unknown>)?.[part];
      if (current === undefined) break;
    }
    result.push(current as T);
  }
  return result;
}

/**
 * Remove a nested property by path string.
 * @param {Record<string, unknown>} obj
 * @param {string} path
 * @returns {boolean}
 */
export function unset(obj: Record<string, unknown>, path: string): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const parts = String(path).split('.');
  let current: unknown = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (current == null || typeof current !== 'object' || !(parts[i] in (current as Record<string, unknown>)))
      return false;
    current = (current as Record<string, unknown>)[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (current != null && typeof current === 'object' && last in (current as Record<string, unknown>)) {
    delete (current as Record<string, unknown>)[last];
    return true;
  }
  return false;
}

/**
 * Deep defaults — recursively assign missing nested properties.
 * @param {Record<string, unknown>} target
 * @param {...Record<string, unknown>} sources
 * @returns {Record<string, unknown>}
 */
export function defaultsDeep(
  target: Record<string, unknown>,
  ...sources: Record<string, unknown>[]
): Record<string, unknown> {
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
        defaultsDeep(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
      }
    }
  }
  return target;
}
