/**
 * @module array
 */

export function unique(arr, keyFn) {
    if (!Array.isArray(arr))
        return [];
    if (!keyFn || typeof keyFn !== 'function') {
        return [...new Set(arr)];
    }
    const seen = new Set();
    return arr.filter((item) => {
        const key = keyFn(item);
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}

export function compact(arr) {
    if (!Array.isArray(arr))
        return [];
    return arr.filter(isDefined);
}

export function groupBy(arr, keyFn) {
    const map = new Map();
    if (!Array.isArray(arr) || typeof keyFn !== 'function')
        return map;
    for (const item of arr) {
        const key = keyFn(item);
        const list = map.get(key);
        if (list) {
            list.push(item);
        }
        else {
            map.set(key, [item]);
        }
    }
    return map;
}

export function partition(arr, predicate) {
    const pass = [];
    const fail = [];
    if (!Array.isArray(arr) || typeof predicate !== 'function')
        return [pass, fail];
    for (const item of arr) {
        if (predicate(item)) {
            pass.push(item);
        }
        else {
            fail.push(item);
        }
    }
    return [pass, fail];
}

export function flatten(arr) {
    const result = [];
    if (!Array.isArray(arr))
        return result;
    for (const item of arr) {
        if (Array.isArray(item)) {
            result.push(...flatten(item));
        }
        else {
            result.push(item);
        }
    }
    return result;
}

export function range(start, end, step = 1) {
    const s = end === undefined ? 0 : start;
    const e = end === undefined ? start : end;
    if (step === 0 || !Number.isFinite(step) || !Number.isFinite(s) || !Number.isFinite(e))
        return [];
    const result = [];
    if (step > 0) {
        for (let i = s; i < e; i += step)
            result.push(i);
    }
    else {
        for (let i = s; i > e; i += step)
            result.push(i);
    }
    return result;
}

export function chunk(arr, size) {
    if (!Array.isArray(arr))
        return [];
    const chunkSize = Number.isFinite(size) && size >= 1 ? Math.floor(size) : 1;
    const result = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        result.push(arr.slice(i, i + chunkSize));
    }
    return result;
}

export function intersection(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b))
        return [];
    const setB = new Set(b);
    return a.filter(item => setB.has(item));
}

export function difference(a, b) {
    if (!Array.isArray(a))
        return [];
    if (!Array.isArray(b) || b.length === 0)
        return [...a];
    const setB = new Set(b);
    return a.filter(item => !setB.has(item));
}

export function randomChoice(arr) {
    if (!Array.isArray(arr) || arr.length === 0)
        return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
}

export function times(n, fn) {
    const count = Math.max(0, Math.floor(Number(n) || 0));
    const result = [];
    for (let i = 0; i < count; i++)
        result.push(fn(i));
    return result;
}

export function union(a, b) {
    if (!Array.isArray(a) && !Array.isArray(b))
        return [];
    if (!Array.isArray(a))
        return [...new Set(b)];
    if (!Array.isArray(b))
        return [...new Set(a)];
    return [...new Set([...a, ...b])];
}

export function ensureArray(value) {
    if (value == null)
        return [];
    if (Array.isArray(value))
        return value;
    return [value];
}

export function sortBy(arr, keyFn, order = 'asc') {
    if (!Array.isArray(arr))
        return [];
    if (typeof keyFn !== 'function')
        return [...arr];
    const sorted = [...arr];
    const dir = order === 'desc' ? -1 : 1;
    sorted.sort((a, b) => {
        const ka = keyFn(a);
        const kb = keyFn(b);
        if (ka === kb || (ka == null && kb == null))
            return 0;
        if (ka == null)
            return dir;
        if (kb == null)
            return -dir;
        if (typeof ka === 'number' && typeof kb === 'number')
            return (ka - kb) * dir;
        if (ka instanceof Date && kb instanceof Date)
            return (ka.getTime() - kb.getTime()) * dir;
        return String(ka).localeCompare(String(kb)) * dir;
    });
    return sorted;
}

export function keyBy(arr, keyFn) {
    if (!Array.isArray(arr) || typeof keyFn !== 'function')
        return {};
    const result = {};
    for (const item of arr) {
        const key = keyFn(item);
        if (key != null && typeof key === 'string') {
            result[key] = item;
        }
    }
    return result;
}

export function countBy(arr, iteratee) {
    if (!Array.isArray(arr) || typeof iteratee !== 'function')
        return {};
    const map = new Map();
    for (const item of arr) {
        const key = iteratee(item);
        map.set(key, (map.get(key) || 0) + 1);
    }
    return Object.fromEntries(map);
}
