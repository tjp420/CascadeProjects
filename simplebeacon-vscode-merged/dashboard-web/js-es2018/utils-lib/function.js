/**
 * function utilities.
 */


/**
 * Compose functions left-to-right.
 * @param {...((...args: any[]) => any)} fns
 * @returns {(...args: any[]) => any}
 */
export function seq(...fns) {
  return (value) => fns.reduce((v, fn) => fn(v), value);
}


/**
 * Compose functions right-to-left.
 * @param {...((...args: any[]) => any)} fns
 * @returns {(...args: any[]) => any}
 */
export function flow(...fns) {
  return (value) => fns.reduceRight((v, fn) => fn(v), value);
}


/**
 * Return a negated version of a predicate function.
 * @param {(...args: any[]) => boolean} predicate
 * @returns {(...args: any[]) => boolean}
 */
export function negate(predicate) {
  if (typeof predicate !== 'function') throw new TypeError('negate requires a function');
  return function (...args) {
    return !predicate.apply(this, args);
  };
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
 * Exhaustiveness checker. Throws at runtime if an unexpected value is encountered.
 * @param {never} value
 * @param {string} [message='Unexpected value']
 * @returns {never}
 */
export function assertNever(value, message = 'Unexpected value') {
  const display = typeof value === 'string' ? value : (() => { try { return JSON.stringify(value); } catch { return String(value); } })();
  throw new Error(`${message}: ${display}`);
}


/**
 * Safely call a function and return a structured result.
 * @param {(...args: any[]) => any} fn Function to invoke.
 * @param {...any} args Arguments to pass to the function.
 * @returns {{ ok: true; value: any } | { ok: false; error: Error }}
 */
export function tryFn(fn, ...args) {
  try {
    return { ok: true, value: fn(...args) };
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
 * Zip two arrays applying a function to each pair.
 * @param {any[]} arr1
 * @param {any[]} arr2
 * @param {(a: any, b: any) => any} fn
 * @returns {any[]}
 */
export function zipWith(arr1, arr2, fn) {
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

