/**
 * Wait for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    const delay = Number.isFinite(ms) && ms > 0 ? ms : 0;
    return new Promise(resolve => setTimeout(resolve, delay));
}
/**
 * Alias for {@link sleep} using common async library naming.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function delay(ms) {
    return sleep(ms);
}
/**
 * Retry an async operation with exponential backoff.
 * @template T
 * @param {() => Promise<T>} fn
 * @param {number} [retries=3]
 * @param {number} [delayMs=200]
 * @param {number} [backoff=2]
 * @param {number} [maxDelayMs=30000]
 * @param {(err: Error) => boolean} [shouldRetry] Optional predicate to decide whether an error is retryable.
 * @returns {Promise<T>}
 */
export async function retry(fn, retries = 3, delayMs = 200, backoff = 2, maxDelayMs = 30000, shouldRetry) {
    if (typeof fn !== 'function') {
        throw new TypeError('retry expects a function');
    }
    const maxAttempts = Math.max(0, Number.isFinite(retries) ? Math.floor(retries) : 0);
    let lastErr;
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
 * Debounce a function call.
 * @param {(...args: any[]) => void} fn
 * @param {number} [wait=300]
 * @returns {((...args: any[]) => void) & {cancel:()=>void,flush:()=>void,pending:()=>boolean}}
 */
export function debounce(fn, wait = 300) {
    if (typeof fn !== 'function') throw new TypeError('debounce requires a function');
    const delay = Number.isFinite(wait) && wait > 0 ? wait : 0;
    let timeout = null;
    let lastArgs = null;
    let lastThis = null;
    const debounced = function (...args) {
        lastArgs = args;
        lastThis = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            timeout = null;
            const argsToUse = lastArgs;
            const self = lastThis;
            lastArgs = lastThis = null;
            if (argsToUse) {
                fn.apply(self, argsToUse);
            }
        }, delay);
    };
    debounced.cancel = () => {
        clearTimeout(timeout);
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
 * Debounce an async function so repeated calls within the wait window
 * reset the timer. Returns a promise that resolves with the latest result.
 * @param {(...args: any[]) => Promise<any>} fn Async function to debounce.
 * @param {number} [wait=300] Delay in milliseconds.
 * @returns {((...args: any[]) => Promise<any>) & {cancel:()=>void,flush:()=>Promise<any>,pending:()=>boolean}}
 */
export function debounceAsync(fn, wait = 300) {
    if (typeof fn !== 'function') throw new TypeError('debounceAsync requires a function');
    const delay = Number.isFinite(wait) && wait > 0 ? wait : 0;
    let timeout = null;
    let lastArgs = null;
    let lastThis = null;
    let pendingPromise = null;
    let resolvePending = null;
    let rejectPending = null;
    const debounced = function (...args) {
        lastArgs = args;
        lastThis = this;
        if (timeout !== null) clearTimeout(timeout);
        if (!pendingPromise) {
            pendingPromise = new Promise((resolve, reject) => {
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
                resolvePending === null || resolvePending === void 0 ? void 0 : resolvePending(result);
            } catch (err) {
                rejectPending === null || rejectPending === void 0 ? void 0 : rejectPending(err);
            } finally {
                pendingPromise = null;
                resolvePending = null;
                rejectPending = null;
            }
        }, delay);
        return pendingPromise;
    };
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
            try {
                const result = await fn.apply(thisToUse, argsToUse);
                resolvePending === null || resolvePending === void 0 ? void 0 : resolvePending(result);
                return result;
            } catch (err) {
                rejectPending === null || rejectPending === void 0 ? void 0 : rejectPending(err);
                throw err;
            } finally {
                pendingPromise = null;
                resolvePending = null;
                rejectPending = null;
            }
        }
        return pendingPromise !== null && pendingPromise !== void 0 ? pendingPromise : undefined;
    };
    debounced.pending = () => timeout !== null;
    return debounced;
}
/**
 * Debounce a function so it fires on the leading edge and then ignores
 * subsequent calls until the cooldown expires.
 * @param {(...args: any[]) => void} fn Function to debounce.
 * @param {number} [wait=300] Delay in milliseconds.
 * @returns {((...args: any[]) => void) & {cancel:()=>void,flush:()=>void,pending:()=>boolean}} Debounced function with `.cancel()` method.
 */
export function debounceLeading(fn, wait = 300) {
    if (typeof fn !== 'function') throw new TypeError('debounceLeading requires a function');
    const delay = Number.isFinite(wait) && wait > 0 ? wait : 0;
    let timeout = null;
    let lastArgs = null;
    let lastThis = null;
    const debounced = function (...args) {
        lastArgs = args;
        lastThis = this;
        if (timeout === null) {
            fn.apply(this, args);
        } else {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            timeout = null;
            lastArgs = lastThis = null;
        }, delay);
    };
    debounced.cancel = () => {
        if (timeout !== null) {
            clearTimeout(timeout);
            timeout = null;
        }
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
 * Throttle a function so it executes at most once per `limit` ms.
 * @param {(...args: any[]) => void} fn
 * @param {number} [limit=300]
 * @returns {((...args: any[]) => void) & {cancel:()=>void,flush:()=>void,pending:()=>boolean}}
 */
export function throttle(fn, limit = 300) {
    if (typeof fn !== 'function') throw new TypeError('throttle requires a function');
    const cooldown = Number.isFinite(limit) && limit > 0 ? limit : 0;
    let inThrottle = false;
    let pendingArgs = null;
    let pendingThis = null;
    let timer = null;
    const invoke = () => {
        const args2 = pendingArgs;
        const self = pendingThis;
        pendingArgs = pendingThis = null;
        if (!args2) return;
        inThrottle = true;
        try {
            fn.apply(self, args2);
        } catch (err) {
            inThrottle = false;
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            throw err;
        }
    };
    const throttled = function (...args) {
        if (!inThrottle) {
            pendingArgs = args;
            pendingThis = this;
            invoke();
            timer = setTimeout(() => {
                inThrottle = false;
                timer = null;
                if (pendingArgs !== null) {
                    throttled.apply(pendingThis, pendingArgs);
                }
            }, cooldown);
        } else {
            pendingArgs = args;
            pendingThis = this;
        }
    };
    throttled.cancel = () => {
        inThrottle = false;
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        pendingArgs = pendingThis = null;
    };
    throttled.flush = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        if (pendingArgs !== null) {
            inThrottle = true;
            const args2 = pendingArgs;
            const self = pendingThis;
            pendingArgs = pendingThis = null;
            try {
                fn.apply(self, args2);
            } catch (err) {
                inThrottle = false;
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                throw err;
            }
            timer = setTimeout(() => {
                inThrottle = false;
                timer = null;
            }, cooldown);
        }
    };
    throttled.pending = () => pendingArgs !== null;
    return throttled;
}
/**
 * Throttle an async function so it executes at most once per `limit` milliseconds.
 * @param {(...args: any[]) => Promise<any>} fn Async function to throttle.
 * @param {number} [limit=300] Minimum time between invocations in milliseconds.
 * @returns {((...args: any[]) => Promise<any>) & {cancel:()=>void,flush:()=>Promise<any>,pending:()=>boolean}} Throttled function.
 */
export function throttleAsync(fn, limit = 300) {
    if (typeof fn !== 'function') throw new TypeError('throttleAsync requires a function');
    const cooldown = Number.isFinite(limit) && limit > 0 ? limit : 0;
    let inThrottle = false;
    let pendingArgs = null;
    let pendingThis = null;
    let timer = null;
    const throttled = async function (...args) {
        if (!inThrottle) {
            inThrottle = true;
            try {
                await fn.apply(this, args);
            } catch (err) {
                inThrottle = false;
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                throw err;
            }
            timer = setTimeout(() => {
                inThrottle = false;
                timer = null;
                if (pendingArgs !== null) {
                    const args2 = pendingArgs;
                    const self = pendingThis;
                    pendingArgs = pendingThis = null;
                    throttled.apply(self, args2);
                }
            }, cooldown);
        } else {
            pendingArgs = args;
            pendingThis = this;
        }
    };
    throttled.cancel = () => {
        inThrottle = false;
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        pendingArgs = pendingThis = null;
    };
    throttled.flush = async () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        if (pendingArgs !== null) {
            inThrottle = true;
            const args2 = pendingArgs;
            const self = pendingThis;
            pendingArgs = pendingThis = null;
            try {
                await fn.apply(self, args2);
            } catch (err) {
                inThrottle = false;
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                throw err;
            }
            timer = setTimeout(() => {
                inThrottle = false;
                timer = null;
            }, cooldown);
        }
    };
    throttled.pending = () => pendingArgs !== null;
    return throttled;
}
/**
 * Wrap a function so it can only be called once.
 * @param {(...args: any[]) => any} fn
 * @returns {(...args: any[]) => any}
 */
export function once(fn) {
    if (typeof fn !== 'function') throw new TypeError('once requires a function');
    let called = false;
    let result;
    let error;
    return function (...args) {
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
    };
}
/**
 * Memoize a function with an LRU cache.
 * @param {(...args: any[]) => any} fn
 * @param {number} [maxSize=1000]
 * @returns {((...args: any[]) => any) & {clear:()=>void}}
 */
export function memoize(fn, maxSize = 1000) {
    if (typeof fn !== 'function') throw new TypeError('memoize requires a function');
    const limit = Number.isFinite(maxSize) && maxSize > 0 ? Math.floor(maxSize) : 1000;
    const cache = new Map();
    const memoized = function (...args) {
        let key;
        try {
            key = JSON.stringify(args, (_k, v) => (v === undefined ? '__memo_undefined__' : v));
        } catch (_a) {
            return fn.apply(this, args);
        }
        if (cache.has(key)) {
            const value = cache.get(key);
            cache.delete(key);
            cache.set(key, value);
            return value;
        }
        const result = fn.apply(this, args);
        if (cache.size >= limit) {
            const oldest = cache.keys().next().value;
            if (oldest) cache.delete(oldest);
        }
        cache.set(key, result);
        return result;
    };
    memoized.clear = () => cache.clear();
    Object.defineProperty(memoized, 'size', { get: () => cache.size });
    memoized.has = (...args) => {
        try {
            const key = JSON.stringify(args, (_k, v) => (v === undefined ? '__memo_undefined__' : v));
            return cache.has(key);
        } catch (_a) {
            return false;
        }
    };
    return memoized;
}
/**
 * Memoize an async function so repeated calls with the same arguments
 * return a cached resolved promise.
 * @param {(...args: any[]) => Promise<any>} fn Async function to memoize.
 * @param {number} [maxSize=100] Maximum cache entries before LRU eviction.
 * @returns {((...args: any[]) => Promise<any>) & {clear: ()=>void; size: number; has: (...args: any[])=>boolean}} Memoized async function.
 */
export function memoizeAsync(fn, maxSize = 100) {
    if (typeof fn !== 'function') throw new TypeError('memoizeAsync requires a function');
    const limit = Number.isFinite(maxSize) && maxSize > 0 ? Math.floor(maxSize) : 100;
    const cache = new Map();
    const memoized = async function (...args) {
        let key;
        try {
            key = JSON.stringify(args, (_k, v) => (v === undefined ? '__memo_undefined__' : v));
        } catch (_a) {
            return await fn.apply(this, args);
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
        } catch (_a) {
            return false;
        }
    };
    return memoized;
}
/**
 * Wrap a Promise with a timeout. Rejects if the promise doesn't settle in time.
 * @template T
 * @param {Promise<T>} promise Promise to race.
 * @param {number} ms Timeout in milliseconds.
 * @param {string} [message='Operation timed out'] Error message on timeout.
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, message = 'Operation timed out') {
    if (!promise || typeof promise.then !== 'function') {
        return Promise.reject(new TypeError('withTimeout requires a valid Promise'));
    }
    const timeoutMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        (async () => {
            try {
                const value = await promise;
                clearTimeout(timer);
                resolve(value);
            } catch (err) {
                clearTimeout(timer);
                reject(err);
            }
        })();
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
export async function poll(fn, intervalMs = 500, timeoutMs = 10000) {
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
    predicate,
    intervalMs = 100,
    timeoutMs = 5000,
    message = 'Timeout waiting for condition'
) {
    if (typeof predicate !== 'function') throw new TypeError('waitForAsync expects a predicate function');
    const start = Date.now();
    const interval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 100;
    const limit = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000;
    while (Date.now() - start < limit) {
        if (await predicate()) return;
        await sleep(interval);
    }
    throw new Error(message);
}
/**
 * Map over an array with a concurrency limit.
 * @template T, R
 * @param {T[]} arr Array to map.
 * @param {(item: T, index: number) => Promise<R>} fn Async mapper.
 * @param {number} [concurrency=5] Maximum parallel invocations.
 * @returns {Promise<R[]>}
 */
export async function pMap(arr, fn, concurrency = 5) {
    if (!Array.isArray(arr)) return [];
    if (typeof fn !== 'function') return [];
    const limit = Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : 5;
    if (limit === 1) {
        const results = [];
        for (let i = 0; i < arr.length; i++) results.push(await fn(arr[i], i));
        return results;
    }
    const results = new Array(arr.length);
    let index = 0;
    async function worker() {
        while (index < arr.length) {
            const i = index++;
            results[i] = await fn(arr[i], i);
        }
    }
    const workers = Array.from({ length: Math.min(limit, arr.length) }, () => worker());
    await Promise.all(workers);
    return results;
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
 * Compose functions left-to-right.
 * @param {...((...args: any[]) => any)} fns
 * @returns {(...args: any[]) => any}
 */
export function seq(...fns) {
    return value => fns.reduce((v, fn) => fn(v), value);
}
/**
 * Compose functions right-to-left.
 * @param {...((...args: any[]) => any)} fns
 * @returns {(...args: any[]) => any}
 */
export function flow(...fns) {
    return value => fns.reduceRight((v, fn) => fn(v), value);
}
/**
 * Returns a negated predicate function.
 * @param {(...args: any[]) => boolean} predicate
 * @returns {(...args: any[]) => boolean}
 */
export function negate(predicate) {
    if (typeof predicate !== 'function') throw new TypeError('negate requires a function');
    return function (...args) {
        return !predicate(...args);
    };
}
