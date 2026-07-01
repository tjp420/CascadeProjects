'use strict';

// ── Analyzer-specific Helpers ───────────────────────────────────

/**
 * Return a clean relative path string (always forward slashes, no leading './').
 * @param {string} baseDir
 * @param {string} targetPath
 * @returns {string}
 */
function formatRelativePath(baseDir, targetPath) {
    const rel = path.relative(baseDir, targetPath).replace(/\\/g, '/');
    return rel.replace(/^\.\//, '');
}

/**
 * Fast Map-based counting of findings by category.
 * @param {Array<Object>} findings
 * @returns {Object<string, number>}
 */
function countByCategory(findings) {
    if (!Array.isArray(findings)) return {};
    const map = new Map();
    for (const f of findings) {
        const cat = f?.category || 'unknown';
        map.set(cat, (map.get(cat) || 0) + 1);
    }
    return Object.fromEntries(map);
}

function tryFn(fn, ...args) {
    try {
        return { ok: true, value: fn.apply(this, args) };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
}

function memoize(fn, maxSize = 100) {
    if (typeof fn !== 'function') throw new TypeError('memoize requires a function');
    const limit = Number.isFinite(maxSize) && maxSize > 0 ? Math.floor(maxSize) : 100;
    const cache = new Map();
    const memoized = function (...args) {
        let key;
        try {
            key = JSON.stringify(args, (_k, v) => (v === undefined ? '__memo_undefined__' : v));
        } catch {
            return fn.apply(this, args);
        }
        if (cache.has(key)) {
            const value = cache.get(key);
            cache.delete(key);
            cache.set(key, value);
            return value;
        }
        const result = fn.apply(this, args);
        cache.set(key, result);
        if (cache.size > limit) {
            const oldest = cache.keys().next().value;
            if (oldest) cache.delete(oldest);
        }
        return result;
    };
    memoized.clear = () => cache.clear();
    Object.defineProperty(memoized, 'size', { get: () => cache.size });
    memoized.has = (...args) => {
        try {
            const key = JSON.stringify(args, (_k, v) => (v === undefined ? '__memo_undefined__' : v));
            return cache.has(key);
        } catch {
            return false;
        }
    };
    return memoized;
}

function hash(str) {
    const s = String(str ?? '');
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    }
    return h >>> 0;
}

function randomId(length = 8) {
    const len = Math.max(1, Math.floor(Number(length) || 8));
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const max = chars.length;
    let id = '';
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const arr = new Uint32Array(len);
        crypto.getRandomValues(arr);
        for (let i = 0; i < len; i++) id += chars[arr[i] % max];
    } else {
        for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * max)];
    }
    return id;
}

function sleep(ms) {
    const delay = Number.isFinite(ms) && ms > 0 ? ms : 0;
    return new Promise(resolve => setTimeout(resolve, delay));
}

function delay(ms) {
    return sleep(ms);
}

function parseJsonSafe(text, fallback) {
    if (text == null) return fallback;
    try {
        return JSON.parse(String(text));
    } catch {
        return fallback;
    }
}

function deepEqual(a, b) {
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

function unique(arr, keyFn) {
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

function partition(arr, predicate) {
    const pass = [];
    const fail = [];
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

function sortBy(arr, keyFn, order = 'asc') {
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

function flatten(arr) {
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

function range(start, end, step = 1) {
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

function chunk(arr, size) {
    if (!Array.isArray(arr)) return [];
    const chunkSize = Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
    const result = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        result.push(arr.slice(i, i + chunkSize));
    }
    return result;
}

function times(n, fn) {
    const count = Math.max(0, Math.floor(Number(n) || 0));
    const result = [];
    for (let i = 0; i < count; i++) result.push(fn(i));
    return result;
}

function get(obj, path, fallback) {
    if (!obj || typeof obj !== 'object' || typeof path !== 'string') return fallback;
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
        if (current == null || typeof current !== 'object') return fallback;
        current = current[key];
    }
    return current === undefined ? fallback : current;
}

function set(obj, path, value) {
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

function zipObject(keys, values) {
    if (!Array.isArray(keys)) return {};
    const result = {};
    for (let i = 0; i < keys.length; i++) {
        result[keys[i]] = i < (values || []).length ? values[i] : undefined;
    }
    return result;
}

function seq(...fns) {
    return (value) => fns.reduce((v, fn) => fn(v), value);
}

function identity(value) {
    return value;
}

function constant(value) {
    return () => value;
}

function random(min, max, floating) {
    const lo = min === undefined ? 0 : Number(min) || 0;
    const hi = max === undefined ? 1 : Number(max) || 1;
    const r = Math.random() * (hi - lo) + lo;
    return floating ? r : Math.floor(r);
}

function noop() { /* no-op */ }

function assertNever(value, message = 'Unexpected value') {
    const display = (() => { try { return JSON.stringify(value); } catch { return String(value); } })();
    throw new Error(`${message}: ${display}`);
}

function formatDuration(ms) {
    if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remSeconds = seconds % 60;
    if (minutes < 60) return `${minutes}m ${remSeconds}s`;
    const hours = Math.floor(minutes / 60);
    const remMinutes = minutes % 60;
    return `${hours}h ${remMinutes}m`;
}

function formatNumber(n) {
    if (n == null) return '—';
    const numericCount = Number(n);
    if (!Number.isFinite(numericCount)) return '—';
    return numericCount.toLocaleString();
}

function escapeRegExp(str) {
    return String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function kebabCase(str) {
    return String(str ?? '')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
}

function camelCase(str) {
    return String(str ?? '')
        .replace(/[-_\s]+(.)?/g, (_, ch) => (ch ? ch.toUpperCase() : ''))
        .replace(/^[A-Z]/, (ch) => ch.toLowerCase());
}

function snakeCase(str) {
    return String(str ?? '')
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
}

function padStart(str, len, char = ' ') {
    const s = String(str);
    const targetLen = Math.max(0, Math.floor(Number(len) || 0));
    const padChar = String(char || ' ').slice(0, 1);
    if (s.length >= targetLen) return s;
    return padChar.repeat(targetLen - s.length) + s;
}

function padEnd(str, len, char = ' ') {
    const s = String(str);
    const targetLen = Math.max(0, Math.floor(Number(len) || 0));
    const padChar = String(char || ' ').slice(0, 1);
    if (s.length >= targetLen) return s;
    return s + padChar.repeat(targetLen - s.length);
}

function withTimeout(promise, ms, message = 'Operation timed out') {
    if (promise == null || typeof promise.then !== 'function') {
        return Promise.reject(new TypeError('withTimeout requires a valid Promise'));
    }
    const timeoutMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled) reject(new Error(message));
        }, timeoutMs);
        promise.then(
            (value) => { settled = true; clearTimeout(timer); resolve(value); },
            (err) => { settled = true; clearTimeout(timer); reject(err); }
        );
    });
}

async function retry(fn, retries = 3, delayMs = 200) {
    if (typeof fn !== 'function') throw new TypeError('retry expects a function');
    const maxAttempts = Math.max(0, Number.isFinite(retries) ? Math.floor(retries) : 0);
    let lastErr;
    let wait = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;
    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (attempt < maxAttempts) {
                await sleep(wait);
                wait *= 2;
            }
        }
    }
    throw lastErr;
}

function pick(obj, keys) {
    if (!obj || typeof obj !== 'object') return {};
    const result = {};
    const keySet = new Set(Array.isArray(keys) ? keys : []);
    for (const key of keySet) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) result[key] = obj[key];
    }
    return result;
}

function omit(obj, keys) {
    if (!obj || typeof obj !== 'object') return {};
    const result = { ...obj };
    const keySet = new Set(Array.isArray(keys) ? keys : []);
    for (const key of keySet) delete result[key];
    return result;
}

function groupBy(arr, keyFn) {
    if (typeof keyFn !== 'function') throw new TypeError('groupBy expects a function');
    const result = {};
    if (!Array.isArray(arr)) return result;
    for (const item of arr) {
        const key = String(keyFn(item));
        if (!result[key]) result[key] = [];
        result[key].push(item);
    }
    return result;
}

function keyBy(arr, keyFn) {
    if (typeof keyFn !== 'function') throw new TypeError('keyBy expects a function');
    const result = {};
    if (!Array.isArray(arr)) return result;
    for (const item of arr) {
        const key = String(keyFn(item));
        result[key] = item;
    }
    return result;
}

function compact(arr) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(Boolean);
}

function countBy(collection, iteratee) {
    if (!Array.isArray(collection)) return {};
    const fn = typeof iteratee === 'function' ? iteratee : (item) => item[iteratee];
    const result = {};
    for (const item of collection) {
        const key = String(fn(item));
        result[key] = (result[key] || 0) + 1;
    }
    return result;
}

function find(collection, predicate) {
    if (!Array.isArray(collection)) return undefined;
    const fn = typeof predicate === 'function' ? predicate : (item) => item === predicate;
    for (const item of collection) {
        if (fn(item)) return item;
    }
    return undefined;
}

function findIndex(collection, predicate) {
    if (!Array.isArray(collection)) return -1;
    const fn = typeof predicate === 'function' ? predicate : (item) => item === predicate;
    for (let i = 0; i < collection.length; i++) {
        if (fn(collection[i])) return i;
    }
    return -1;
}

function findLastIndex(collection, predicate) {
    if (!Array.isArray(collection)) return -1;
    const fn = typeof predicate === 'function' ? predicate : (item) => item === predicate;
    for (let i = collection.length - 1; i >= 0; i--) {
        if (fn(collection[i])) return i;
    }
    return -1;
}

function head(array) {
    return Array.isArray(array) && array.length > 0 ? array[0] : undefined;
}

function last(array) {
    return Array.isArray(array) && array.length > 0 ? array[array.length - 1] : undefined;
}

function initial(array) {
    if (!Array.isArray(array) || array.length <= 1) return [];
    return array.slice(0, -1);
}

function tail(array) {
    if (!Array.isArray(array) || array.length <= 1) return [];
    return array.slice(1);
}

function difference(array, values) {
    if (!Array.isArray(array)) return [];
    const set = new Set(Array.isArray(values) ? values : []);
    return array.filter((item) => !set.has(item));
}

function intersection(arrays) {
    if (!Array.isArray(arrays) || arrays.length === 0) return [];
    const sets = arrays.map((a) => new Set(Array.isArray(a) ? a : []));
    if (sets.length === 0) return [];
    const first = [...sets[0]];
    return first.filter((item) => sets.every((s) => s.has(item)));
}

function without(array, ...values) {
    if (!Array.isArray(array)) return [];
    const set = new Set(values);
    return array.filter((item) => !set.has(item));
}

function pullAll(array, values) {
    if (!Array.isArray(array)) return array;
    const set = new Set(Array.isArray(values) ? values : []);
    let writeIdx = 0;
    for (let readIdx = 0; readIdx < array.length; readIdx++) {
        if (!set.has(array[readIdx])) {
            array[writeIdx++] = array[readIdx];
        }
    }
    array.length = writeIdx;
    return array;
}

function sortedIndex(array, value) {
    if (!Array.isArray(array)) return 0;
    let low = 0;
    let high = array.length;
    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (array[mid] < value) low = mid + 1;
        else high = mid;
    }
    return low;
}

function isMatch(object, source) {
    if (!object || typeof object !== 'object') return false;
    if (!source || typeof source !== 'object') return true;
    for (const key of Object.keys(source)) {
        if (!deepEqual(object[key], source[key])) return false;
    }
    return true;
}

function isMatchWith(object, source, customizer) {
    if (!object || typeof object !== 'object') return false;
    if (!source || typeof source !== 'object') return true;
    const cmp = typeof customizer === 'function' ? customizer : deepEqual;
    for (const key of Object.keys(source)) {
        if (!cmp(object[key], source[key])) return false;
    }
    return true;
}

function conformsTo(object, source) {
    if (!object || typeof object !== 'object') return false;
    if (!source || typeof source !== 'object') return true;
    for (const key of Object.keys(source)) {
        const predicate = source[key];
        if (typeof predicate !== 'function') return false;
        if (!predicate(object[key])) return false;
    }
    return true;
}

function castArray(value) {
    if (value == null) return [];
    return Array.isArray(value) ? value : [value];
}

function toPath(value) {
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') return value.split('.');
    return [String(value)];
}

function invoke(object, path, ...args) {
    if (!object || typeof object !== 'object') return undefined;
    const keys = toPath(path);
    let current = object;
    for (let i = 0; i < keys.length - 1; i++) {
        current = current?.[keys[i]];
        if (current == null) return undefined;
    }
    const method = current?.[keys[keys.length - 1]];
    if (typeof method !== 'function') return undefined;
    try {
        return method.apply(current, args);
    } catch {
        return undefined;
    }
}

function result(object, path, defaultValue) {
    if (!object || typeof object !== 'object') return defaultValue;
    const keys = toPath(path);
    let current = object;
    for (const key of keys) {
        if (current == null) return defaultValue;
        current = current[key];
    }
    if (typeof current === 'function') {
        try {
            return current.call(object);
        } catch {
            return defaultValue;
        }
    }
    return current !== undefined ? current : defaultValue;
}

module.exports = {
    formatRelativePath,
    countByCategory,
    tryFn,
    memoize,
    hash,
    randomId,
    sleep,
    delay,
    parseJsonSafe,
    deepEqual,
    unique,
    partition,
    sortBy,
    flatten,
    range,
    chunk,
    times,
    get,
    set,
    zipObject,
    seq,
    identity,
    constant,
    random,
    noop,
    assertNever,
    formatDuration,
    formatNumber,
    escapeRegExp,
    kebabCase,
    camelCase,
    snakeCase,
    padStart,
    padEnd,
    withTimeout,
    pick,
    omit,
    groupBy,
    keyBy,
    compact,
    countBy,
    find,
    findIndex,
    findLastIndex,
    head,
    last,
    initial,
    tail,
    difference,
    intersection,
    without,
    pullAll,
    sortedIndex,
    isMatch,
    isMatchWith,
    conformsTo,
    castArray,
    toPath,
    invoke,
    result,
    retry
};
