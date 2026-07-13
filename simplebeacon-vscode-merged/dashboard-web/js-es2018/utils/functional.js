/**
 * @module functional
 */

export function compose(...fns) {
    if (fns.length === 0) return (value) => value;
    return (value) => fns.reduceRight((acc, fn) => fn(acc), value);
}

export function pipe(...fns) {
    if (fns.length === 0) return (value) => value;
    return (value) => fns.reduce((acc, fn) => fn(acc), value);
}

export function zipWith(arr1, arr2, fn) {
    if (!arr1 || typeof arr1.length !== 'number' || !arr2 || typeof arr2.length !== 'number') {
        return [];
    }
    if (typeof fn !== 'function') return [];
    const len = Math.min(arr1.length, arr2.length);
    const result = new Array(len);
    for (let i = 0; i < len; i++) {
        result[i] = fn(arr1[i], arr2[i]);
    }
    return result;
}

export function curry(fn) {
    if (typeof fn !== 'function') throw new TypeError('curry requires a function');
    return function curried(...args) {
        if (args.length >= fn.length) {
            return fn.apply(this, args);
        }
        return function (...nextArgs) {
            return curried.apply(this, args.concat(nextArgs));
        };
    };
}

export function partial(fn, ...presetArgs) {
    if (typeof fn !== 'function') throw new TypeError('partial requires a function');
    return function (...args) {
        return fn.apply(this, presetArgs.concat(args));
    };
}

export function tap(value, fn) {
    fn(value);
    return value;
}

export function flip(fn) {
    return (b, a) => fn(a, b);
}

export function tryCatch(fn, handler) {
    if (typeof fn !== 'function' || typeof handler !== 'function') return fn;
    return (...args) => { try { return fn(...args); } catch (e) { return handler(e); } };
}

export function defaultTo(defaultValue, value) {
    return value == null || (typeof value === 'number' && Number.isNaN(value)) ? defaultValue : value;
}

export function prop(key, obj) {
    if (obj == null) return undefined;
    if (typeof key !== 'string' && typeof key !== 'number' && typeof key !== 'symbol') return undefined;
    return obj[key];
}

export function getPath(keys, obj) {
    if (keys == null) return undefined;
    const keyList = Array.isArray(keys) ? keys : String(keys).split('.');
    let val = obj;
    for (const k of keyList) { if (val == null) return undefined; val = val[k]; }
    return val;
}

export function pathOr(defaultValue, keys, obj) {
    const result = getPath(keys, obj);
    return result === undefined ? defaultValue : result;
}

export function when(pred, fn, value) {
    if (typeof pred !== 'function' || typeof fn !== 'function') return value;
    return pred(value) ? fn(value) : value;
}

export function unless(pred, fn, value) {
    if (typeof pred !== 'function' || typeof fn !== 'function') return value;
    return pred(value) ? value : fn(value);
}

export function ifElse(pred, onTrue, onFalse, value) {
    if (typeof pred !== 'function' || typeof onTrue !== 'function' || typeof onFalse !== 'function') return value;
    return pred(value) ? onTrue(value) : onFalse(value);
}

export function cond(pairs) {
    if (!Array.isArray(pairs)) return () => undefined;
    return (value) => {
        for (const [pred, fn] of pairs) {
            if (typeof pred !== 'function' || typeof fn !== 'function') continue;
            if (pred(value)) return fn(value);
        }
        return undefined;
    };
}

export function allPass(preds) {
    if (!Array.isArray(preds)) return () => false;
    return (value) => preds.every(p => typeof p === 'function' && p(value));
}

export function anyPass(preds) {
    if (!Array.isArray(preds)) return () => false;
    return (value) => preds.some(p => typeof p === 'function' && p(value));
}

export function complement(pred) {
    if (typeof pred !== 'function') return () => true;
    return (...args) => !pred(...args);
}

export function always(value) {
    return () => value;
}

export function T() { return () => true; }

export function F() { return () => false; }

export function propEq(key, val, obj) {
    if (obj == null || typeof obj !== 'object') return false;
    return obj[key] === val;
}

export function pathEq(keys, val, obj) {
    return getPath(keys, obj) === val;
}

export function onceInline(fn) {
    if (typeof fn !== 'function') return () => undefined;
    let ran = false;
    let result;
    return (...args) => {
        if (ran) return result;
        ran = true;
        result = fn(...args);
        return result;
    };
}
