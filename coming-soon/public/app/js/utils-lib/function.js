/**
 * @module function
 */

/**
 * Exhaustiveness checker for TypeScript-style discriminated unions.
 * @param {never} value
 * @param {string} [message]
 * @returns {never}
 */
export function assertNever(value, message = 'Unexpected value') {
    const display =
        typeof value === 'string'
            ? value
            : (() => {
                  try {
                      return JSON.stringify(value);
                  } catch {
                      return String(value);
                  }
              })();
    throw new Error(`${message}: ${display}`);
}

/**
 * Compose functions left-to-right.
 * @param {...Function} fns
 * @returns {Function}
 */
export function seq(...fns) {
    return value => fns.reduce((v, fn) => fn(v), value);
}

/**
 * Safely call a function and return a structured result.
 * @param {Function} fn
 * @param {...any} args
 * @returns {{ok: boolean, value?: any, error?: Error}}
 */
export function tryFn(fn, ...args) {
    try {
        return { ok: true, value: fn.apply(this, args) };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
}

/**
 * No-op function.
 * @returns {void}
 */
export function noop() {
    /* intentionally empty */
}

/**
 * Compose functions right-to-left.
 * @param {...Function} fns
 * @returns {Function}
 */
export function flow(...fns) {
    return value => fns.reduceRight((v, fn) => fn(v), value);
}

/**
 * Negate a predicate.
 * @param {Function} predicate
 * @returns {Function}
 */
export function negate(predicate) {
    if (typeof predicate !== 'function') throw new TypeError('negate requires a function');
    return function (...args) {
        return !predicate.apply(this, args);
    };
}

/**
 * Compose functions right-to-left.
 * @param {...Function} fns
 * @returns {Function}
 */
export function compose(...fns) {
    if (fns.length === 0) return value => value;
    return value => fns.reduceRight((acc, fn) => fn(acc), value);
}

/**
 * Pipe functions left-to-right.
 * @param {...Function} fns
 * @returns {Function}
 */
export function pipe(...fns) {
    if (fns.length === 0) return value => value;
    return value => fns.reduce((acc, fn) => fn(acc), value);
}

/**
 * Zip two arrays applying a function to each pair.
 * @param {Array} arr1
 * @param {Array} arr2
 * @param {Function} fn
 * @returns {Array}
 */
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

/**
 * Curry a function so it can be called with one argument at a time.
 * @param {Function} fn
 * @returns {Function}
 */
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

/**
 * Partially apply a function with preset leading arguments.
 * @param {Function} fn
 * @param {...any} presetArgs
 * @returns {Function}
 */
export function partial(fn, ...presetArgs) {
    if (typeof fn !== 'function') throw new TypeError('partial requires a function');
    return function (...args) {
        return fn.apply(this, presetArgs.concat(args));
    };
}

/**
 * Run a side-effect function on a value and return the value.
 * @param {any} value
 * @param {Function} fn
 * @returns {any}
 */
export function tap(value, fn) {
    fn(value);
    return value;
}

/**
 * Recursively freeze an object and all of its enumerable properties.
 * Handles Date, RegExp, Map, Set, WeakMap, and WeakSet safely.
 * @param {any} obj
 * @returns {any}
 */
export function deepFreeze(obj) {
    if (obj == null || typeof obj !== 'object') return obj;
    if (Object.isFrozen(obj)) return obj;
    const ctor = obj.constructor;
    if (ctor === Date || ctor === RegExp || ctor === WeakMap || ctor === WeakSet) return obj;
    if (ctor === Map) {
        for (const [k, v] of obj) obj.set(k, deepFreeze(v));
        return Object.freeze(obj);
    }
    if (ctor === Set) {
        const values = Array.from(obj);
        obj.clear();
        for (const v of values) obj.add(deepFreeze(v));
        return Object.freeze(obj);
    }
    try {
        Object.freeze(obj);
    } catch {
        return obj;
    }
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (value && typeof value === 'object' && !Object.isFrozen(value)) {
            deepFreeze(value);
        }
    }
    return obj;
}
