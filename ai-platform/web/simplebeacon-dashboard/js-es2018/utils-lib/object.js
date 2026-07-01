/**
 * object utilities.
 */


/**
 * Deep-clone a serializable object.
 * Uses structuredClone when available, falls back to JSON round-trip.
 * Falls back to a shallow copy for objects/arrays instead of the original
 * reference to prevent accidental mutation.
 * @param {unknown} obj
 * @returns {unknown}
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
        if (Object.prototype.hasOwnProperty.call(obj, key)) result[key] = obj[key];
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
 * Check whether a value is "empty" — null, undefined, empty string, empty array,
 * or an object with no own enumerable keys.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEmpty(value) {
    if (value == null) return true;
    if (typeof value === 'string') return value.length === 0;
    if (Array.isArray(value)) return value.length === 0;
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
export function ensureArray(value) {
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
export function deepEqual(a, b) {
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
                if (deepEqual(v, w)) { found = true; break; }
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

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
}


/**
 * Shallow merge: fill only undefined keys on the target.
 * @param {Object} target
 * @param {...Object} sources
 * @returns {Object}
 */
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


/**
 * Safe own-property check.
 * @param {Object} obj
 * @param {string} key
 * @returns {boolean}
 */
export function has(obj, key) {
    return obj != null && typeof obj === 'object' && Object.hasOwn(obj, key);
}


/**
 * Safely parse a JSON string, returning a fallback on failure.
 * @template T
 * @param {string} text
 * @param {T} fallback
 * @returns {T}
 */
export function parseJsonSafe(text, fallback = null) {
    if (text == null) return fallback;
    try {
        return JSON.parse(String(text));
    } catch {
        return fallback;
    }
}


/**
 * Safely get a nested property by dot-path string.
 * @param {Object} obj
 * @param {string} path
 * @param {unknown} [fallback]
 * @returns {unknown}
 */
export function get(obj, path, fallback) {
    if (!obj || typeof obj !== 'object' || typeof path !== 'string') return fallback;
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current == null || typeof current !== 'object') return fallback;
        current = current[key];
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
export function set(obj, path, value) {
    if (!obj || typeof obj !== 'object' || typeof path !== 'string') return obj;
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] == null || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }
    current[keys[keys.length - 1]] = value;
    return obj;
}


/**
 * Map over object values.
 * @param {Object} obj
 * @param {(value:any,key:string)=>any} fn
 * @returns {Object}
 */
export function mapValues(obj, fn) {
    if (!obj || typeof obj !== 'object' || typeof fn !== 'function') return {};
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
    if (!obj || typeof obj !== 'object' || typeof fn !== 'function') return {};
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
    if (!obj || typeof obj !== 'object') return {};
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
    if (obj == null || typeof obj !== 'object') return obj;
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
    if (!target || typeof target !== 'object') return {};
    const result = { ...target };
    for (const src of sources) {
        if (!src || typeof src !== 'object') continue;
        for (const key of Object.keys(src)) {
            if (result[key] === undefined) {
                const val = src[key];
                result[key] = (val && typeof val === 'object' && !Array.isArray(val))
                    ? defaultsDeep({}, val)
                    : val;
            } else if (result[key] && typeof result[key] === 'object' && !Array.isArray(result[key]) &&
                       src[key] && typeof src[key] === 'object' && !Array.isArray(src[key])) {
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
    if (!obj || typeof obj !== 'object' || !Array.isArray(paths)) return [];
    return paths.map((path) => get(obj, path));
}


/**
 * Remove a nested property by dot-path.
 * @param {Object} obj
 * @param {string} path
 * @returns {boolean}
 */
export function unset(obj, path) {
    if (!obj || typeof obj !== 'object' || typeof path !== 'string') return false;
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] == null || typeof current[key] !== 'object') return false;
        current = current[key];
    }
    const lastKey = keys[keys.length - 1];
    if (Object.prototype.hasOwnProperty.call(current, lastKey)) {
        delete current[lastKey];
        return true;
    }
    return false;
}

