// simplebeacon-ignore memory-leak — pure misc utility functions
import * as crypto from 'crypto';

/**
 * TypeScript exhaustiveness check for switch statements.
 * Call this in the `default` branch to get a compile-time error
 * when a union case is not handled.
 * @param {never} x
 * @returns {never}
 */
export function assertNever(x: never, message = 'Unhandled case'): never {
  const display = (() => {
    try { return JSON.stringify(x); } catch {}
    try { return String(x); } catch {}
    return '[unstringable value]';
  })();
  throw new Error(`${message}: ${display}`);
}

/**
 * No-op function. Useful as a default for optional callbacks.
 * @returns {void}
 */
export function noop(): void { /* intentionally empty */ }

/**
 * True when the value is null, undefined, or a whitespace-only string.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isBlank(value: unknown): boolean {
  return value == null || (typeof value === 'string' && value.trim().length === 0);
}

/**
 * Compute a simple 32-bit hash for a string.
 * @param {string} str
 * @returns {number} Unsigned 32-bit hash.
 */
export function hash(str: string): number {
  if (typeof str === 'symbol') return 0;
  const s = String(str ?? '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/**
 * Safely call a function and return a structured result.
 * @param {(...args: any[]) => T} fn Function to invoke.
 * @param {any[]} args Arguments to pass to the function.
 * @returns {{ ok: true; value: T } | { ok: false; error: Error }}
 */
export function tryFn<T>(fn: (...args: any[]) => T, ...args: any[]): { ok: true; value: T } | { ok: false; error: Error } {
  try {
    return { ok: true, value: fn(...args) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Map over an array with a concurrency limit.
 * @template T, R
 * @param {T[]} arr Array to map.
 * @param {(item: T, index: number) => Promise<R>} fn Async mapper.
 * @param {number} [concurrency=5] Maximum parallel invocations.
 * @returns {Promise<R[]>}
 */
export async function pMap<T, R>(arr: T[], fn: (item: T, index: number) => Promise<R>, concurrency = 5): Promise<R[]> {
  if (!Array.isArray(arr)) return [];
  if (typeof fn !== 'function') return [];
  const limit = Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : 5;
  if (limit === 1) {
    const results: R[] = [];
    for (let i = 0; i < arr.length; i++) results.push(await fn(arr[i], i));
    return results;
  }
  const results = new Array<R | undefined>(arr.length);
  let index = 0;
  async function worker(): Promise<void> {
    while (index < arr.length) {
      const i = index++;
      results[i] = await fn(arr[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, arr.length) }, () => worker());
  await Promise.all(workers);
  return results as R[];
}

/**
 * Generate a random alphanumeric ID.
 * @param {number} [length=8] Length of the ID.
 * @returns {string}
 */
export function randomId(length = 8): string {
  const len = Math.max(1, Math.floor(Number(length) || 8));
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const max = chars.length;
  let id = '';
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) id += chars[arr[i] % max];
  } else {
    for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * max)];
  }
  return id;
}

/**
 * Alias for {@link randomId}.
 * @returns {string}
 */
export function uid(): string {
  return randomId(8);
}

/**
 * Compose functions left-to-right.
 * @param {...((value: T) => T)} fns
 * @returns {(value: T) => T}
 */
export function seq<T>(...fns: Array<(value: T) => T>): (value: T) => T {
  return (value: T) => fns.reduce((v, fn) => fn(v), value);
}

/**
 * Compose functions right-to-left.
 * @param {...((value: T) => T)} fns
 * @returns {(value: T) => T}
 */
export function flow<T>(...fns: Array<(value: T) => T>): (value: T) => T {
  return (value: T) => fns.reduceRight((v, fn) => fn(v), value);
}

/**
 * Returns a negated predicate function.
 * @param {(...args: any[]) => boolean} predicate
 * @returns {(...args: any[]) => boolean}
 */
export function negate(predicate: (...args: any[]) => boolean): (...args: any[]) => boolean {
  if (typeof predicate !== 'function') throw new TypeError('negate requires a function');
  return function (...args: any[]): boolean {
    return !predicate(...args);
  };
}

/**
 * Identity function — returns its argument unchanged.
 * @template T
 * @param {T} value
 * @returns {T}
 */
export function identity<T>(value: T): T {
  return value;
}

/**
 * Returns a function that always returns the given value.
 * @template T
 * @param {T} value
 * @returns {() => T}
 */
export function constant<T>(value: T): () => T {
  return () => value;
}
