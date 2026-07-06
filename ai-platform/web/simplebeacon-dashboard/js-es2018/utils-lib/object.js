/**
 * Deep-clone a serializable object.
 * Uses structuredClone when available, falls back to a recursive walk
 * that preserves Date, RegExp, Map, Set, Array, and plain objects.
 * If structuredClone fails, returns a deep copy via recursive walk.
 * @param {unknown} obj
 * @returns {unknown}
 */
export function deepClone(obj) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(obj);
        }
        catch (_a) {
            // structuredClone can fail on functions, DOM nodes, etc.
        }
    }
    return _deepClone(obj);
}
/**
 * Shallow clone a plain object or array.
 * Returns the primitive value unchanged.
 * @param {unknown} obj
 * @returns {unknown}
 */
export function clone(obj) {
    if (obj == null || typeof obj !== 'object')
        return obj;
    if (Array.isArray(obj))
        return [...obj];
    return { ...obj };
}
function _deepClone(obj, seen = new WeakMap()) {
    if (obj === null || typeof obj !== 'object')
        return obj;
    if (seen.has(obj))
        return seen.get(obj);
    if (obj instanceof Date)
        return new Date(obj.getTime());
    if (obj instanceof RegExp)
        return new RegExp(obj.source, obj.flags);
    if (obj instanceof URL)
        return new URL(obj.href);
    if (obj instanceof Error) {
        const err = new (obj.constructor)(obj.message);
        err.stack = obj.stack;
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
        const arr = [];
        seen.set(obj, arr);
        for (let i = 0; i < obj.length; i++) {
            arr.push(_deepClone(obj[i], seen));
        }
        return arr;
    }
    const cloned = {};
    seen.set(obj, cloned);
    try {
        for (const key of Object.keys(obj)) {
            try {
                cloned[key] = _deepClone(obj[key], seen);
            }
            catch (_a) {
                // Skip properties that throw on access (e.g., throwing getters)
            }
        }
    }
    catch (_b) {
        // Object.keys may throw on exotic objects
    }
    return cloned;
}
/**
 * Perform a deep equality check between two values.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function deepEqual(a, b) {
    if (a === b)
        return true;
    if (a == null || b == null)
        return a === b;
    if (typeof a !== typeof b)
        return false;
    if (typeof a !== 'object')
        return false;
    if (a instanceof Date && b instanceof Date)
        return a.getTime() === b.getTime();
    if (a instanceof RegExp && b instanceof RegExp)
        return a.source === b.source && a.flags === b.flags;
    if (a instanceof Map && b instanceof Map) {
        if (a.size !== b.size)
            return false;
        for (const [k, v] of a) {
            if (!b.has(k) || !deepEqual(v, b.get(k)))
                return false;
        }
        return true;
    }
    if (a instanceof Set && b instanceof Set) {
        if (a.size !== b.size)
            return false;
        for (const v of a) {
            let found = false;
            for (const w of b) {
                if (deepEqual(v, w)) {
                    found = true;
                    break;
                }
            }
            if (!found)
                return false;
        }
        return true;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length)
            return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i]))
                return false;
        }
        return true;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length)
        return false;
    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key))
            return false;
        if (!deepEqual(a[key], b[key]))
            return false;
    }
    return true;
}
/**
 * Create a new object with only the specified keys.
 * @template T, K
 * @param {T} obj
 * @param {K[]} keys
 * @returns {Pick<T, K>}
 */
export function pick(obj, keys) {
    if (!obj || typeof obj !== 'object')
        return {};
    const result = {};
    if (!keys || typeof keys === 'string' || typeof keys[Symbol.iterator] !== 'function')
        return result;
    for (const key of keys) {
        if (Object.hasOwn(obj, key))
            result[key] = obj[key];
    }
    return result;
}
/**
 * Create a new object without the specified keys.
 * @template T
 * @param {T} obj
 * @param {string[]} keys
 * @returns {Partial<T>}
 */
export function omit(obj, keys) {
    if (!obj || typeof obj !== 'object')
        return {};
    const set = new Set(keys && typeof keys !== 'string' && typeof keys[Symbol.iterator] === 'function' ? keys : []);
    const result = {};
    for (const key of Object.keys(obj)) {
        if (!set.has(key))
            result[key] = obj[key];
    }
    return result;
}
/**
 * Shallow merge: fill only undefined keys on the target.
 * @param {Object} target
 * @param {...Object} sources
 * @returns {Object}
 */
export function defaults(target, ...sources) {
    if (!target || typeof target !== 'object')
        return {};
    const result = { ...target };
    for (const src of sources) {
        if (!src || typeof src !== 'object')
            continue;
        for (const key of Object.keys(src)) {
            if (!(key in result))
                result[key] = src[key];
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
    if (!target || typeof target !== 'object')
        return {};
    const result = { ...target };
    for (const src of sources) {
        if (!src || typeof src !== 'object')
            continue;
        for (const key of Object.keys(src)) {
            const val = src[key];
            if (val && typeof val === 'object' && !Array.isArray(val) && result[key] && typeof result[key] === 'object' && !Array.isArray(result[key])) {
                result[key] = merge(result[key], val);
            }
            else {
                result[key] = val;
            }
        }
    }
    return result;
}
/** @param {Object} obj
 * @returns {Object}
 */
export function invert(obj) {
    if (!obj || typeof obj !== 'object')
        return {};
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
        result[String(val)] = key;
    }
    return result;
}
/**
 * Map over object values, returning a new object with transformed values.
 * @param {Object} obj
 * @param {(value:any,key:string)=>any} fn
 * @returns {Object}
 */
export function mapValues(obj, fn) {
    if (!obj || typeof obj !== 'object' || typeof fn !== 'function')
        return {};
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
        result[key] = fn(val, key);
    }
    return result;
}
/**
 * Map over object keys, returning a new object with renamed keys.
 * @param {Object} obj
 * @param {(key:string,value:any)=>string} fn
 * @returns {Object}
 */
export function mapKeys(obj, fn) {
    if (!obj || typeof obj !== 'object' || typeof fn !== 'function')
        return {};
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
        result[fn(key, val)] = val;
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
 * Safely get a nested property by dot-path string.
 * @param {Object} obj
 * @param {string} path
 * @param {unknown} [fallback]
 * @returns {unknown}
 */
export function get(obj, path, fallback) {
    if (!obj || typeof obj !== 'object' || typeof path !== 'string')
        return fallback;
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current == null || typeof current !== 'object')
            return fallback;
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
    if (!obj || typeof obj !== 'object' || typeof path !== 'string')
        return obj;
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
 * Create an object from two arrays: one of keys and one of values.
 * @param {string[]} keys
 * @param {unknown[]} values
 * @returns {Object<string, unknown>}
 */
export function zipObject(keys, values) {
    if (!Array.isArray(keys))
        return {};
    const result = {};
    for (let i = 0; i < keys.length; i++) {
        result[keys[i]] = i < (values || []).length ? values[i] : undefined;
    }
    return result;
}
/**
 * Return the first argument unchanged.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function identity(value) {
    return value;
}
/**
 * Return a function that always returns the provided value.
 * @template T
 * @param {T} value
 * @returns {() => T}
 */
export function constant(value) {
    return () => value;
}
/**
 * Pick values from an object by path strings.
 * @template T
 * @param {Record<string, T>} obj
 * @param {string[]} paths
 * @returns {T[]}
 */
export function at(obj, paths) {
    if (!obj || typeof obj !== 'object')
        return [];
    if (!Array.isArray(paths))
        return [];
    const result = [];
    for (const p of paths) {
        const parts = String(p).split('.');
        let current = obj;
        for (const part of parts) {
            current = current === null || current === void 0 ? void 0 : current[part];
            if (current === undefined)
                break;
        }
        result.push(current);
    }
    return result;
}
/**
 * Remove a nested property by path string.
 * @param {Record<string, unknown>} obj
 * @param {string} path
 * @returns {boolean}
 */
export function unset(obj, path) {
    if (!obj || typeof obj !== 'object')
        return false;
    const parts = String(path).split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (current == null || typeof current !== 'object' || !(parts[i] in current))
            return false;
        current = current[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (current != null && typeof current === 'object' && last in current) {
        delete current[last];
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
export function defaultsDeep(target, ...sources) {
    if (!target || typeof target !== 'object')
        return target;
    for (const source of sources) {
        if (!source || typeof source !== 'object')
            continue;
        for (const key of Object.keys(source)) {
            if (target[key] === undefined) {
                target[key] = source[key];
            }
            else if (target[key] != null && typeof target[key] === 'object' &&
                source[key] != null && typeof source[key] === 'object' &&
                !Array.isArray(target[key]) && !Array.isArray(source[key])) {
                defaultsDeep(target[key], source[key]);
            }
        }
    }
    return target;
}
