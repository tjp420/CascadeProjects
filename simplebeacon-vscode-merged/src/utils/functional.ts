/**
 * @module functional
 * Functional programming primitives and small utility combinators.
 */

/** Unary function type used by compose/pipe. */
export type Unary<A, B> = (x: A) => B;

/** Generic function shape used by curry/partial. */
export type AnyFunction = (...args: any[]) => any;

/** Curried type: supports full application or applying arguments one at a time. */
export type Curried<T extends AnyFunction> = T extends (...args: infer Args) => infer R
  ? Args extends [infer First, ...infer Rest]
    ? ((...args: Args) => R) & ((arg: First) => Curried<(...args: Rest) => R>)
    : T
  : never;

/**
 * Compose functions right-to-left.
 * `compose(f, g, h)(x)` is equivalent to `f(g(h(x)))`.
 * Returns identity when called with no arguments.
 */
export function compose<T>(): (value: T) => T;
export function compose<T, A>(fn1: Unary<T, A>): (value: T) => A;
export function compose<T, A, B>(fn2: Unary<A, B>, fn1: Unary<T, A>): (value: T) => B;
export function compose<T, A, B, C>(fn3: Unary<B, C>, fn2: Unary<A, B>, fn1: Unary<T, A>): (value: T) => C;
export function compose<T, A, B, C, D>(fn4: Unary<C, D>, fn3: Unary<B, C>, fn2: Unary<A, B>, fn1: Unary<T, A>): (value: T) => D;
export function compose<T, A, B, C, D, E>(fn5: Unary<D, E>, fn4: Unary<C, D>, fn3: Unary<B, C>, fn2: Unary<A, B>, fn1: Unary<T, A>): (value: T) => E;
export function compose<T>(...fns: Array<(x: unknown) => unknown>): (value: T) => unknown {
  if (fns.length === 0) return (value: T) => value;
  return (value: T) => fns.reduceRight((acc, fn) => fn(acc), value as unknown);
}

/**
 * Pipe functions left-to-right.
 * `pipe(f, g, h)(x)` is equivalent to `h(g(f(x)))`.
 * Returns identity when called with no arguments.
 */
export function pipe<T>(): (value: T) => T;
export function pipe<T, A>(fn1: Unary<T, A>): (value: T) => A;
export function pipe<T, A, B>(fn1: Unary<T, A>, fn2: Unary<A, B>): (value: T) => B;
export function pipe<T, A, B, C>(fn1: Unary<T, A>, fn2: Unary<A, B>, fn3: Unary<B, C>): (value: T) => C;
export function pipe<T, A, B, C, D>(fn1: Unary<T, A>, fn2: Unary<A, B>, fn3: Unary<B, C>, fn4: Unary<C, D>): (value: T) => D;
export function pipe<T, A, B, C, D, E>(fn1: Unary<T, A>, fn2: Unary<A, B>, fn3: Unary<B, C>, fn4: Unary<C, D>, fn5: Unary<D, E>): (value: T) => E;
export function pipe<T>(...fns: Array<(x: unknown) => unknown>): (value: T) => unknown {
  if (fns.length === 0) return (value: T) => value;
  return (value: T) => fns.reduce((acc, fn) => fn(acc), value as unknown);
}

/**
 * Zip two arrays with a custom combiner function.
 */
export const zipWith = <T, U, R>(arr1: T[], arr2: U[], fn: (a: T, b: U) => R): R[] => {
  if (!arr1 || typeof arr1.length !== 'number' || !arr2 || typeof arr2.length !== 'number') {
    return [];
  }
  if (typeof fn !== 'function') return [];
  const len = Math.min(arr1.length, arr2.length);
  const result: R[] = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = fn(arr1[i], arr2[i]);
  }
  return result;
};

/**
 * Curry a function so it can be called with one argument at a time.
 */
export const curry = <T extends AnyFunction>(fn: T): Curried<T> => {
  if (typeof fn !== 'function') throw new TypeError('curry requires a function');
  const curried = (...args: unknown[]): unknown => {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return (...nextArgs: unknown[]): unknown => curried(...args.concat(nextArgs));
  };
  return curried as Curried<T>;
};

/**
 * Create a partial application of a function with preset arguments.
 */
export const partial = <T extends AnyFunction>(fn: T, ...presetArgs: unknown[]): ((...args: unknown[]) => ReturnType<T>) => {
  if (typeof fn !== 'function') throw new TypeError('partial requires a function');
  return (...args: unknown[]): ReturnType<T> => fn(...presetArgs.concat(args)) as ReturnType<T>;
};

/**
 * Execute a side-effect function on a value, then return the value.
 * Useful for debugging inside pipelines.
 * @returns The original value.
 */
export const tap = <T>(value: T, fn: (value: T) => void): T => {
  if (typeof fn !== 'function') throw new TypeError('tap requires a function');
  fn(value);
  return value;
};

/**
 * Flip the first two arguments of a binary function.
 * `flip(fn)(a, b)` is equivalent to `fn(b, a)`.
 * @returns Flipped function.
 */
export const flip = <A, B, R>(fn: (a: A, b: B) => R): ((b: B, a: A) => R) => {
  if (typeof fn !== 'function') throw new TypeError('flip requires a function');
  return (b, a) => fn(a, b);
};

/**
 * Runtime assertion helper.
 * @param condition Value to assert.
 * @param message Optional message on failure.
 * @throws {Error} If condition is falsy.
 */
export function assert(condition: unknown, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

/**
 * Functional try/catch wrapper.
 * @param fn Function to execute safely.
 * @returns Result object with discriminated union shape.
 */
export function tryCatch<T>(fn: () => T): { ok: true; value: T } | { ok: false; error: unknown } {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, error };
  }
}
