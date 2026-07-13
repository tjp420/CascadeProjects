/**
 * @module array
 */

import { isDefined } from './type.js';

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

// ── Data-last list primitives (migrated from utils.js barrel) ───────────

export function head(list) {
    if (list == null || typeof list.length !== 'number') return undefined;
    return list[0];
}

export function tail(list) {
    if (list == null || typeof list.length !== 'number') return [];
    return Array.prototype.slice.call(list, 1);
}

export function last(list) {
    if (list == null || typeof list.length !== 'number') return undefined;
    return list[list.length - 1];
}

export function init(list) {
    if (list == null || typeof list.length !== 'number') return [];
    return Array.prototype.slice.call(list, 0, -1);
}

export function take(n, list) {
    if (list == null || typeof list.length !== 'number') return [];
    return typeof list === 'string' ? list.slice(0, n) : Array.prototype.slice.call(list, 0, n);
}

export function drop(n, list) {
    if (list == null || typeof list.length !== 'number') return [];
    return typeof list === 'string' ? list.slice(n) : Array.prototype.slice.call(list, n);
}

export function takeLast(n, list) {
    if (list == null || typeof list.length !== 'number') return [];
    return typeof list === 'string' ? list.slice(-n) : Array.prototype.slice.call(list, -n);
}

export function dropLast(n, list) {
    if (list == null || typeof list.length !== 'number') return [];
    return typeof list === 'string' ? list.slice(0, -n) : Array.prototype.slice.call(list, 0, -n);
}

export function pluck(key, list) {
    if (list == null || typeof list.length !== 'number') return [];
    return Array.prototype.map.call(list, obj => obj == null ? undefined : obj[key]);
}

export function find(pred, list) {
    if (typeof pred !== 'function') return undefined;
    if (list == null || typeof list.length !== 'number') return undefined;
    return Array.prototype.find.call(list, pred);
}

export function findIndex(pred, list) {
    if (typeof pred !== 'function' || list == null || typeof list.length !== 'number') return -1;
    return Array.prototype.findIndex.call(list, pred);
}

export function sort(list) {
    if (list == null || typeof list.length !== 'number') return [];
    return Array.prototype.slice.call(list).sort();
}

export function contains(value, list) {
    if (list == null || typeof list.length !== 'number') return false;
    return Array.prototype.indexOf.call(list, value) >= 0;
}

export function uniqBy(iteratee, list) {
    if (typeof iteratee !== 'function') return [];
    if (list == null || typeof list.length !== 'number') return [];
    const seen = new Set();
    return Array.prototype.filter.call(list, item => {
        const key = iteratee(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function sortByInline(iteratee, list) {
    if (typeof iteratee !== 'function') return [];
    if (list == null || typeof list.length !== 'number') return [];
    return Array.prototype.slice.call(list).sort((a, b) => {
        const av = iteratee(a), bv = iteratee(b);
        if (av < bv) return -1;
        if (av > bv) return 1;
        return 0;
    });
}

export function flattenInline(depth, list) {
    if (list == null || typeof list.length !== 'number') return [];
    const result = [];
    const stack = [];
    // Push initial list in reverse so the first element is popped first.
    for (let i = list.length - 1; i >= 0; i--) stack.push([list[i], 1]);
    while (stack.length) {
        const [item, d] = stack.pop();
        if (Array.isArray(item) && d < depth) {
            // Push children in reverse so the first child is popped first.
            for (let i = item.length - 1; i >= 0; i--) stack.push([item[i], d + 1]);
        } else {
            result.push(item);
        }
    }
    return result;
}

export function zip(arr1, arr2) {
    if (!arr1 || !arr2 || typeof arr1.length !== 'number' || typeof arr2.length !== 'number') return [];
    const len = Math.min(arr1.length, arr2.length);
    const result = new Array(len);
    for (let i = 0; i < len; i++) result[i] = [arr1[i], arr2[i]];
    return result;
}

export function unzip(arr) {
    if (!arr || typeof arr.length !== 'number') return [[], []];
    const a = new Array(arr.length), b = new Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
        const pair = arr[i];
        a[i] = pair != null ? pair[0] : undefined;
        b[i] = pair != null ? pair[1] : undefined;
    }
    return [a, b];
}

export function project(keys, list) {
    if (!Array.isArray(keys)) return [];
    if (list == null || typeof list.length !== 'number') return [];
    return Array.prototype.map.call(list, obj => {
        const result = {};
        for (const k of keys) { if (k in obj) result[k] = obj[k]; }
        return result;
    });
}

export function reverseInline(list) {
    if (list == null || typeof list.length !== 'number') return [];
    if (typeof list === 'string') return list.split('').reverse().join('');
    return Array.prototype.slice.call(list).reverse();
}
