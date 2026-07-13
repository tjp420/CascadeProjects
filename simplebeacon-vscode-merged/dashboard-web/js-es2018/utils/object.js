/**
 * @module object
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

export function omit(obj, keys) {
    if (!obj || typeof obj !== 'object')
        return {};
    const keySet = new Set(keys && typeof keys !== 'string' && typeof keys[Symbol.iterator] === 'function' ? keys : []);
    const result = {};
    for (const key of Object.keys(obj)) {
        if (!keySet.has(key))
            result[key] = obj[key];
    }
    return result;
}

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

export function has(obj, key) {
    return obj != null && typeof obj === 'object' && Object.hasOwn(obj, key);
}

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

export function clone(obj) {
    if (obj == null || typeof obj !== 'object')
        return obj;
    if (Array.isArray(obj))
        return [...obj];
    return { ...obj };
}

export function at(obj, paths) {
    if (!obj || typeof obj !== 'object' || !Array.isArray(paths))
        return [];
    return paths.map((path) => get(obj, path));
}

export function unset(obj, path) {
    if (!obj || typeof obj !== 'object' || typeof path !== 'string')
        return false;
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] == null || typeof current[key] !== 'object')
            return false;
        current = current[key];
    }
    const lastKey = keys[keys.length - 1];
    if (Object.prototype.hasOwnProperty.call(current, lastKey)) {
        delete current[lastKey];
        return true;
    }
    return false;
}

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

export function zipObject(keys, values) {
    if (!Array.isArray(keys))
        return {};
    const result = {};
    for (let i = 0; i < keys.length; i++) {
        result[keys[i]] = i < (values || []).length ? values[i] : undefined;
    }
    return result;
}

export function identity(value) {
    return value;
}

export function constant(value) {
    return () => value;
}

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

export function mapValues(obj, fn) {
    if (!obj || typeof obj !== 'object' || typeof fn !== 'function')
        return {};
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
        result[key] = fn(val, key);
    }
    return result;
}

export function mapKeys(obj, fn) {
    if (!obj || typeof obj !== 'object' || typeof fn !== 'function')
        return {};
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
        result[fn(key, val)] = val;
    }
    return result;
}

export function invert(obj) {
    if (!obj || typeof obj !== 'object')
        return {};
    const result = {};
    for (const [key, val] of Object.entries(obj)) {
        result[String(val)] = key;
    }
    return result;
}

export function evolve(transformations, obj) {
    if (obj == null || typeof obj !== 'object') return obj;
    if (transformations == null || typeof transformations !== 'object') return obj;
    const result = {};
    for (const key of Object.keys(obj)) {
        const fn = transformations[key];
        result[key] = typeof fn === 'function' ? fn(obj[key]) : obj[key];
    }
    return result;
}

export function dissoc(key, obj) {
    if (obj == null || typeof obj !== 'object') return {};
    const result = {};
    for (const k of Object.keys(obj)) { if (k !== key) result[k] = obj[k]; }
    return result;
}

function _mergeDeep(leftPrecedence, a, b) {
    if (a == null || typeof a !== 'object') return b;
    if (b == null || typeof b !== 'object') return a;
    if (Array.isArray(a) || Array.isArray(b)) return leftPrecedence ? a : b;
    const result = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (k in a && k in b && a[k] != null && typeof a[k] === 'object' && b[k] != null && typeof b[k] === 'object') {
            result[k] = _mergeDeep(leftPrecedence, a[k], b[k]);
        } else {
            result[k] = leftPrecedence ? (k in a ? a[k] : b[k]) : (k in b ? b[k] : a[k]);
        }
    }
    return result;
}

export function mergeDeepLeft(a, b) {
    return _mergeDeep(true, a, b);
}

export function mergeDeepRight(a, b) {
    return _mergeDeep(false, a, b);
}

export function memoizeBy(fn, keyFn) {
    if (typeof fn !== 'function' || typeof keyFn !== 'function') return fn;
    const cache = new Map();
    return (...args) => {
        const key = keyFn(...args);
        if (cache.has(key)) return cache.get(key);
        const result = fn(...args);
        cache.set(key, result);
        return result;
    };
}
