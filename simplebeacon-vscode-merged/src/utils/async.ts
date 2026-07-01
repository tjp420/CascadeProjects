// simplebeacon-ignore memory-leak — async utility functions

/**
 * Wait for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms: number): Promise<void> {
  const delay = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Alias for {@link sleep} using common async library naming.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms: number): Promise<void> {
  return sleep(ms);
}

/**
 * Debounce a function call.
 * @param {T} fn Function to debounce.
 * @param {number} [wait=300] Delay in milliseconds.
 * @returns {T & { cancel(): void; flush(): void; pending(): boolean }} Debounced function.
 */
export function debounce<T extends (...args: any[]) => void>(fn: T, wait = 300): T & { cancel(): void; flush(): void; pending(): boolean } {
  if (typeof fn !== 'function') throw new TypeError('debounce requires a function');
  const d = Number.isFinite(wait) && wait > 0 ? wait : 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown = null;
  const debounced = function (this: unknown, ...args: Parameters<T>) {
    lastArgs = args;
    lastThis = this;
    if (timeout !== null) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      const argsToUse = lastArgs;
      const self = lastThis;
      lastArgs = lastThis = null;
      if (argsToUse) {
        fn.apply(self, argsToUse);
      }
    }, d);
  } as T & { cancel(): void; flush(): void; pending(): boolean };
  debounced.cancel = () => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = lastArgs = lastThis = null;
  };
  debounced.flush = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
      const argsToUse = lastArgs;
      const self = lastThis;
      lastArgs = lastThis = null;
      if (argsToUse) {
        fn.apply(self, argsToUse);
      }
    }
  };
  debounced.pending = () => timeout !== null;
  return debounced;
}

/**
 * Debounce a function so it fires on the leading edge and then ignores
 * subsequent calls until the cooldown expires.
 * @param {T} fn Function to debounce.
 * @param {number} [wait=300] Delay in milliseconds.
 * @returns {T & { cancel(): void }} Debounced function with `.cancel()`.
 */
export function debounceLeading<T extends (...args: any[]) => void>(fn: T, wait = 300): T & { cancel(): void; flush(): void; pending(): boolean } {
  if (typeof fn !== 'function') throw new TypeError('debounceLeading requires a function');
  const d = Number.isFinite(wait) && wait > 0 ? wait : 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown = null;
  const debounced = function (this: unknown, ...args: Parameters<T>): void {
    lastArgs = args;
    lastThis = this;
    if (timeout === null) {
      fn.apply(this, args);
    } else {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => { timeout = null; lastArgs = lastThis = null; }, d);
  } as T & { cancel(): void; flush(): void; pending(): boolean };
  debounced.cancel = () => {
    if (timeout !== null) { clearTimeout(timeout); timeout = null; }
    lastArgs = lastThis = null;
  };
  debounced.flush = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
      const argsToUse = lastArgs;
      const self = lastThis;
      lastArgs = lastThis = null;
      if (argsToUse) fn.apply(self, argsToUse);
    }
  };
  debounced.pending = () => timeout !== null;
  return debounced;
}

/**
 * Debounce an async function so repeated calls within the wait window
 * reset the timer. Returns a promise that resolves with the latest result.
 * @param {T} fn Async function to debounce.
 * @param {number} [wait=300] Delay in milliseconds.
 * @returns {T & { cancel(): void; flush(): Promise<ReturnType<T> | undefined>; pending(): boolean }} Debounced async function.
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(fn: T, wait = 300): T & { cancel(): void; flush(): Promise<ReturnType<T> | undefined>; pending(): boolean } {
  if (typeof fn !== 'function') throw new TypeError('debounceAsync requires a function');
  const d = Number.isFinite(wait) && wait > 0 ? wait : 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown = null;
  let pendingPromise: Promise<ReturnType<T>> | null = null;
  let resolvePending: ((value: ReturnType<T>) => void) | null = null;
  let rejectPending: ((reason: unknown) => void) | null = null;

  const debounced = function (this: unknown, ...args: Parameters<T>): Promise<ReturnType<T>> {
    lastArgs = args;
    lastThis = this;
    if (timeout !== null) clearTimeout(timeout);

    if (!pendingPromise) {
      pendingPromise = new Promise<ReturnType<T>>((resolve, reject) => {
        resolvePending = resolve;
        rejectPending = reject;
      });
    }

    timeout = setTimeout(async () => {
      timeout = null;
      const argsToUse = lastArgs;
      const thisToUse = lastThis;
      lastArgs = lastThis = null;
      if (!argsToUse) return;
      try {
        const result = await fn.apply(thisToUse, argsToUse);
        resolvePending?.(result);
      } catch (err) {
        rejectPending?.(err);
      } finally {
        pendingPromise = null;
        resolvePending = null;
        rejectPending = null;
      }
    }, d);

    return pendingPromise;
  } as T & { cancel(): void; flush(): Promise<ReturnType<T> | undefined>; pending(): boolean };

  debounced.cancel = () => {
    if (timeout !== null) clearTimeout(timeout);
    timeout = lastArgs = lastThis = null;
    if (rejectPending) {
      rejectPending(new Error('Debounced call was cancelled'));
      pendingPromise = null;
      resolvePending = null;
      rejectPending = null;
    }
  };

  debounced.flush = async () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
      const argsToUse = lastArgs;
      const thisToUse = lastThis;
      lastArgs = lastThis = null;
      if (!argsToUse) return pendingPromise ?? undefined;
      try {
        const result = await fn.apply(thisToUse, argsToUse);
        resolvePending?.(result);
        return result;
      } catch (err) {
        rejectPending?.(err);
        throw err;
      } finally {
        pendingPromise = null;
        resolvePending = null;
        rejectPending = null;
      }
    }
    return pendingPromise ?? undefined;
  };

  debounced.pending = () => timeout !== null;

  return debounced;
}

/**
 * Wrap a function so it can only be called once.
 * Subsequent calls return the cached result of the first invocation.
 * @param {T} fn Function to wrap.
 * @returns {T}
 */
export function once<T extends (...args: any[]) => any>(fn: T): T {
  if (typeof fn !== 'function') throw new TypeError('once requires a function');
  let called = false;
  let result: ReturnType<T>;
  let error: unknown;
  return function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    if (called) {
      if (error) throw error;
      return result;
    }
    called = true;
    try {
      result = fn.apply(this, args);
      return result;
    } catch (err) {
      error = err;
      throw err;
    }
  } as T;
}

/**
 * Memoize a function so repeated calls with the same arguments
 * return a cached result. Uses JSON serialization for key generation.
 * @param {T} fn Function to memoize.
 * @param {number} [maxSize=1000] Maximum cache entries before LRU eviction.
 * @returns {T & { clear(): void }} Memoized function.
 */
export function memoize<T extends (...args: any[]) => any>(fn: T, maxSize = 1000): T & { clear(): void; readonly size: number; has(...args: Parameters<T>): boolean } {
  if (typeof fn !== 'function') throw new TypeError('memoize requires a function');
  const limit = Number.isFinite(maxSize) && maxSize > 0 ? Math.floor(maxSize) : 1000;
  const cache = new Map<string, ReturnType<T>>();
  const memoized = function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    let key: string;
    try {
      key = JSON.stringify(args, (_k, v) => (v === undefined ? '__memo_undefined__' : v));
    } catch {
      return fn.apply(this, args);
    }
    if (cache.has(key)) {
      const value = cache.get(key)!;
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
  } as T & { clear(): void; readonly size: number; has(...args: Parameters<T>): boolean };
  memoized.clear = () => cache.clear();
  Object.defineProperty(memoized, 'size', { get: () => cache.size });
  memoized.has = (...args: Parameters<T>): boolean => {
    try {
      const key = JSON.stringify(args, (_k, v) => (v === undefined ? '__memo_undefined__' : v));
      return cache.has(key);
    } catch {
      return false;
    }
  };
  return memoized;
}

/**
 * Throttle a function so it executes at most once per `wait` milliseconds.
 * Calls on the leading edge; intermediate calls are ignored until the window expires.
 * Supports a `flush()` method to force immediate execution and `pending()` to check
 * if a trailing call is queued.
 * @param {T} fn Function to throttle.
 * @param {number} [wait=300] Minimum time between invocations in milliseconds.
 * @returns {T & { cancel(): void; flush(): void; pending(): boolean }} Throttled function with control methods.
 */
export function throttle<T extends (...args: any[]) => void>(fn: T, wait = 300): T & { cancel(): void; flush(): void; pending(): boolean } {
  if (typeof fn !== 'function') throw new TypeError('throttle requires a function');
  const cooldown = Number.isFinite(wait) && wait > 0 ? wait : 0;
  let lastTime = 0;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const invoke = () => {
    const args2 = lastArgs;
    const self = lastThis;
    lastArgs = lastThis = null;
    if (!args2) return;
    try {
      fn.apply(self, args2);
      lastTime = Date.now();
    } catch (err) {
      lastTime = 0;
      throw err;
    }
  };

  const throttled = function (this: unknown, ...args: Parameters<T>): void {
    const now = Date.now();
    lastArgs = args;
    lastThis = this;
    if (now - lastTime >= cooldown) {
      if (timer) { clearTimeout(timer); timer = null; }
      invoke();
    } else if (!timer) {
      timer = setTimeout(() => { timer = null; invoke(); }, cooldown - (now - lastTime));
    }
  } as T & { cancel(): void; flush(): void; pending(): boolean };

  throttled.cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    lastArgs = lastThis = null;
    lastTime = 0;
  };

  throttled.flush = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (lastArgs) {
      const args2 = lastArgs;
      const self = lastThis;
      lastArgs = lastThis = null;
      try {
        fn.apply(self, args2);
        lastTime = Date.now();
      } catch (err) {
        lastTime = 0;
        throw err;
      }
    }
  };

  throttled.pending = () => timer !== null;

  return throttled;
}

/**
 * Throttle an async function so it runs at most once per cooldown,
 * and subsequent calls queue to run after the cooldown expires.
 * @template T
 * @param {T} fn Async function to throttle.
 * @param {number} [limit=300] Cooldown in milliseconds.
 * @returns {T & { cancel(): void; flush(): Promise<ReturnType<T> | undefined>; pending(): boolean }} Throttled function.
 */
export function throttleAsync<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  limit = 300
): T & { cancel(): void; flush(): Promise<ReturnType<T> | undefined>; pending(): boolean } {
  if (typeof fn !== 'function') throw new TypeError('throttleAsync requires a function');
  const cooldown = Number.isFinite(limit) && limit > 0 ? limit : 0;
  let inThrottle = false;
  let pendingArgs: Parameters<T> | null = null;
  let pendingThis: unknown | null = null;
  let pendingResolve: ((value: ReturnType<T>) => void) | null = null;
  let pendingReject: ((reason?: any) => void) | null = null;

  const throttled = function (this: unknown, ...args: Parameters<T>): Promise<ReturnType<T>> {
    return new Promise((resolve, reject) => {
      if (inThrottle) {
        if (pendingReject) {
          pendingReject(new Error('Throttled call was superseded'));
        }
        pendingArgs = args;
        pendingThis = this;
        pendingResolve = resolve;
        pendingReject = reject;
        return;
      }
      inThrottle = true;
      fn.apply(this, args).then(
        (value) => {
          setTimeout(() => {
            inThrottle = false;
            if (pendingArgs) {
              const ctx = pendingThis;
              const a = pendingArgs;
              const resolvePending = pendingResolve;
              const rejectPending = pendingReject;
              pendingArgs = null;
              pendingThis = null;
              pendingResolve = null;
              pendingReject = null;
              throttled.apply(ctx, a).then(resolvePending!, rejectPending!);
            }
          }, cooldown);
          resolve(value as ReturnType<T>);
        },
        (err) => {
          inThrottle = false;
          if (pendingReject) {
            pendingReject(err);
            pendingArgs = null;
            pendingThis = null;
            pendingResolve = null;
            pendingReject = null;
          }
          reject(err);
        }
      );
    });
  } as unknown as T & { cancel(): void; flush(): Promise<ReturnType<T> | undefined>; pending(): boolean };

  throttled.cancel = () => {
    inThrottle = false;
    pendingArgs = null;
    pendingThis = null;
    pendingResolve = null;
    pendingReject = null;
  };
  throttled.flush = async () => {
    if (pendingArgs) {
      const ctx = pendingThis;
      const a = pendingArgs;
      const resolvePending = pendingResolve;
      const rejectPending = pendingReject;
      throttled.cancel();
      try {
        const result = await fn.apply(ctx, a);
        resolvePending?.(result);
        return result;
      } catch (err) {
        rejectPending?.(err);
        throw err;
      }
    }
    return undefined;
  };
  throttled.pending = () => pendingArgs !== null;
  return throttled;
}

/**
 * Wrap an async operation with a timeout.
 * Rejects with a timeout error if the promise does not settle in time.
 * @param {Promise<T>} promise Promise to race.
 * @param {number} ms Timeout in milliseconds.
 * @param {string} [message='Operation timed out'] Error message on timeout.
 * @returns {Promise<T>}
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message = 'Operation timed out'): Promise<T> {
  if (promise == null || typeof promise.then !== 'function') {
    return Promise.reject(new TypeError('withTimeout requires a valid Promise'));
  }
  const timeoutMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
  return new Promise<T>((resolve, reject) => {
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

/**
 * Wait until a predicate returns true, polling at the given interval.
 * @param {() => boolean} predicate Function that returns true when ready.
 * @param {number} [intervalMs=100] Polling interval.
 * @param {number} [timeoutMs=5000] Maximum time to wait.
 * @param {string} [message='Timeout waiting for condition'] Error message on timeout.
 * @returns {Promise<void>}
 */
export async function waitFor(
  predicate: () => boolean,
  intervalMs = 100,
  timeoutMs = 5000,
  message = 'Timeout waiting for condition'
): Promise<void> {
  if (typeof predicate !== 'function') throw new TypeError('waitFor expects a predicate function');
  const start = Date.now();
  const interval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 100;
  const limit = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000;
  return new Promise((resolve, reject) => {
    const check = () => {
      try {
        if (predicate()) {
          resolve();
          return;
        }
      } catch (err) {
        reject(err);
        return;
      }
      if (Date.now() - start >= limit) {
        reject(new Error(message));
        return;
      }
      setTimeout(check, interval);
    };
    check();
  });
}

/**
 * Repeatedly call `fn` every `intervalMs` until it returns a truthy value or `timeoutMs` expires.
 * @template T
 * @param {() => T | Promise<T>} fn Condition to poll.
 * @param {number} intervalMs Polling interval in milliseconds.
 * @param {number} timeoutMs Maximum time to wait in milliseconds.
 * @returns {Promise<T | undefined>} The truthy result, or `undefined` on timeout.
 */
export async function poll<T>(fn: () => T | Promise<T>, intervalMs = 500, timeoutMs = 10000): Promise<T | undefined> {
  if (typeof fn !== 'function') return undefined;
  const interval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 500;
  const deadline = Date.now() + (Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 10000);
  while (Date.now() < deadline) {
    const result = await fn();
    if (result) return result;
    await sleep(interval);
  }
  return undefined;
}

/**
 * Wait until an async predicate returns true, polling at the given interval.
 * @param {() => Promise<boolean>} predicate Async function that returns true when ready.
 * @param {number} [intervalMs=100] Polling interval.
 * @param {number} [timeoutMs=5000] Maximum time to wait.
 * @param {string} [message='Timeout waiting for condition'] Error message on timeout.
 * @returns {Promise<void>}
 */
export async function waitForAsync(
  predicate: () => Promise<boolean>,
  intervalMs = 100,
  timeoutMs = 5000,
  message = 'Timeout waiting for condition'
): Promise<void> {
  if (typeof predicate !== 'function') throw new TypeError('waitForAsync expects a predicate function');
  const start = Date.now();
  const interval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 100;
  const limit = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000;
  while (Date.now() - start < limit) {
    try {
      if (await predicate()) return;
    } catch (err) {
      throw err;
    }
    await sleep(interval);
  }
  throw new Error(message);
}

/**
 * Memoize an async function so repeated calls with the same arguments
 * return a cached resolved promise. Uses JSON serialization for key generation.
 * @template T
 * @param {T} fn Async function to memoize.
 * @param {number} [maxSize=100] Maximum cache entries before LRU eviction.
 * @returns {T & { clear(): void; readonly size: number; has(...args: Parameters<T>): boolean }} Memoized async function.
 */
export function memoizeAsync<T extends (...args: any[]) => Promise<any>>(fn: T, maxSize = 100): T & { clear(): void; readonly size: number; has(...args: Parameters<T>): boolean } {
  if (typeof fn !== 'function') throw new TypeError('memoizeAsync requires a function');
  const limit = Number.isFinite(maxSize) && maxSize > 0 ? Math.floor(maxSize) : 100;
  const cache = new Map<string, Promise<ReturnType<T>>>();
  const memoized = async function (this: unknown, ...args: Parameters<T>): Promise<ReturnType<T>> {
    let key: string;
    try {
      key = JSON.stringify(args, (_k, v) => (v === undefined ? '__memo_undefined__' : v));
    } catch {
      return await fn.apply(this, args);
    }
    if (cache.has(key)) {
      const value = cache.get(key)!;
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
  } as T & { clear(): void; readonly size: number; has(...args: Parameters<T>): boolean };
  memoized.clear = () => cache.clear();
  Object.defineProperty(memoized, 'size', { get: () => cache.size });
  memoized.has = (...args: Parameters<T>): boolean => {
    try {
      const key = JSON.stringify(args, (_k, v) => (v === undefined ? '__memo_undefined__' : v));
      return cache.has(key);
    } catch {
      return false;
    }
  };
  return memoized;
}

/**
 * Retry an async operation with exponential backoff.
 * @param {() => Promise<T>} fn Async function to retry.
 * @param {number} [retries=3] Maximum retry attempts.
 * @param {number} [delayMs=200] Initial delay between retries in milliseconds.
 * @param {number} [backoff=2] Multiplier for delay after each failure.
 * @param {number} [maxDelayMs=30000] Maximum delay cap in milliseconds.
 * @param {(err: unknown) => boolean} [shouldRetry] Optional predicate to decide whether an error is retryable.
 * @returns {Promise<T>}
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 200,
  backoff = 2,
  maxDelayMs = 30000,
  shouldRetry?: (err: unknown) => boolean
): Promise<T> {
  if (typeof fn !== 'function') {
    throw new TypeError('retry expects a function');
  }
  const maxAttempts = Math.max(0, Number.isFinite(retries) ? Math.floor(retries) : 0);
  let lastErr: unknown;
  let wait = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;
  const mult = Number.isFinite(backoff) && backoff > 0 ? backoff : 1;
  const cap = Number.isFinite(maxDelayMs) && maxDelayMs > 0 ? maxDelayMs : 30000;
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        const retryable = typeof shouldRetry === 'function' ? shouldRetry(err) : shouldRetry !== false;
        if (retryable) {
          await sleep(wait);
          wait = Math.min(wait * mult, cap);
        } else {
          break;
        }
      } else {
        break;
      }
    }
  }
  throw lastErr;
}

/**
 * Run an array of async functions in parallel with a concurrency limit.
 * @template T, R
 * @param {(item: T) => Promise<R>} fn Function to apply to each item.
 * @param {T[]} items Array of items.
 * @param {number} [concurrency=Infinity] Maximum parallel executions.
 * @returns {Promise<R[]>}
 */
export async function parallel<T, R>(fn: (item: T) => Promise<R>, items: T[], concurrency = Infinity): Promise<R[]> {
  if (!Array.isArray(items)) return [];
  if (!Number.isFinite(concurrency) || concurrency < 1) return Promise.all(items.map((item) => fn(item)));
  const results: R[] = new Array(items.length);
  let index = 0;
  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }
  const workers: Promise<void>[] = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

/**
 * Run an array of async functions sequentially.
 * @template T, R
 * @param {(item: T) => Promise<R>} fn Function to apply to each item.
 * @param {T[]} items Array of items.
 * @returns {Promise<R[]>}
 */
export async function series<T, R>(fn: (item: T) => Promise<R>, items: T[]): Promise<R[]> {
  if (!Array.isArray(items)) return [];
  const results: R[] = [];
  for (const item of items) {
    results.push(await fn(item));
  }
  return results;
}

/**
 * Run an array of async functions in a waterfall: each receives
 * the result of the previous. The first receives the initial value.
 * @template T
 * @param {T} initial Starting value.
 * @param {((prev: T) => Promise<T>)[]} fns Array of transform functions.
 * @returns {Promise<T>}
 */
export async function waterfall<T>(initial: T, fns: ((prev: T) => Promise<T>)[]): Promise<T> {
  if (!Array.isArray(fns)) return initial;
  let result = initial;
  for (const fn of fns) {
    result = await fn(result);
  }
  return result;
}

/**
 * Wrap a promise so it rejects if it doesn't settle within `ms`.
 * Alias for `withTimeout` with a simpler name.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} [message='Operation timed out']
 * @returns {Promise<T>}
 */
export function timeout<T>(promise: Promise<T>, ms: number, message = 'Operation timed out'): Promise<T> {
  return withTimeout(promise, ms, message);
}

/**
 * Retry with exponential backoff and jitter. Simpler interface than retry().
 * @template T
 * @param {() => Promise<T>} fn
 * @param {number} [maxRetries=3]
 * @param {number} [baseDelay=200]
 * @returns {Promise<T>}
 */
export async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 200): Promise<T> {
  const retries = Math.max(0, Number.isFinite(maxRetries) ? Math.floor(maxRetries) : 0);
  const delay = Number.isFinite(baseDelay) && baseDelay > 0 ? baseDelay : 200;
  let lastErr: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < retries) {
        const jitter = Math.random() * 0.5 + 0.75; // 0.75–1.25x jitter
        await sleep(Math.min(delay * Math.pow(2, i) * jitter, 30000));
      }
    }
  }
  throw lastErr;
}
