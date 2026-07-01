/**
 * function utilities.
 */


/**
 * Exhaustiveness checker for TypeScript-style discriminated unions.
 * @param {never} value
 * @param {string} [message]
 * @returns {never}
 */
export function assertNever(value, message = 'Unexpected value') {
    const display = typeof value === 'string' ? value : (() => { try { return JSON.stringify(value); } catch { return String(value); } })();
    throw new Error(`${message}: ${display}`);
}


/**
 * Compose functions left-to-right.
 * @param {...((...args: any[]) => any)} fns
 * @returns {(...args: any[]) => any}
 */
export function seq(...fns) {
    return (value) => fns.reduce((v, fn) => fn(v), value);
}


/**
 * Safely call a function and return a structured result.
 * @param {(...args: any[]) => any} fn Function to invoke.
 * @param {...any} args Arguments to pass to the function.
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
 * No-op function. Useful as a default for optional callbacks.
 * @returns {void}
 */
export function noop() { /* intentionally empty */ }


/**
 * Compose functions right-to-left.
 * @param {...((...args: any[]) => any)} fns
 * @returns {(...args: any[]) => any}
 */
export function flow(...fns) {
    return (value) => fns.reduceRight((v, fn) => fn(v), value);
}


/**
 * Negate a predicate.
 * @param {(...args: any[]) => boolean} predicate
 * @returns {(...args: any[]) => boolean}
 */
export function negate(predicate) {
    if (typeof predicate !== 'function') throw new TypeError('negate requires a function');
    return function (...args) {
        return !predicate.apply(this, args);
    };
}

