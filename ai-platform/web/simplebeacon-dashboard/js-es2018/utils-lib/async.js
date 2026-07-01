/**
 * async utilities.
 */


/**
 * Debounce a function call.
 * @param {(...args: any[]) => any} fn
 * @param {number} [wait=300]
 * @returns {((...args: any[]) => any) & {cancel:()=>void,flush:()=>void,pending:()=>boolean}}
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
 * Throttle a function call.
 * @param {(...args: any[]) => any} fn
 * @param {number} [limit=300]
 * @returns {((...args: any[]) => any) & {cancel:()=>void,flush:()=>void,pending:()=>boolean}}
 */
export function throttle(fn, limit = 300) {
    if (typeof fn !== 'function') throw new TypeError('throttle requires a function');
    const cooldown = Number.isFinite(limit) && limit > 0 ? limit : 0;
    let inThrottle = false;
    let pending = null;
    let pendingThis = null;
    let timer = null;
    const invoke = () => {
        const args2 = pending;
        const self = pendingThis;
        pending = pendingThis = null;
        inThrottle = true;
        try {
            fn.apply(self, args2);
        } catch (err) {
            inThrottle = false;
            if (timer) { clearTimeout(timer); timer = null; }
            throw err;
        }
    };
    const throttled = function (...args) {
        if (!inThrottle) {
            pending = args;
            pendingThis = this;
            invoke();
            timer = setTimeout(() => {
                inThrottle = false;
                timer = null;
                if (pending !== null) {
                    const pendingArgs = pending;
                    const pendingSelf = pendingThis;
                    pending = pendingThis = null;
                    throttled.apply(pendingSelf, pendingArgs);
                }
            }, cooldown);
        } else {
            pending = args;
            pendingThis = this;
        }
    };
    throttled.cancel = () => {
        inThrottle = false;
        if (timer) { clearTimeout(timer); timer = null; }
        pending = pendingThis = null;
    };
    throttled.flush = () => {
        if (timer) { clearTimeout(timer); timer = null; }
        if (pending !== null) {
            inThrottle = true;
            const args2 = pending;
            const self = pendingThis;
            pending = pendingThis = null;
            try {
                fn.apply(self, args2);
            } catch (err) {
                inThrottle = false;
                if (timer) { clearTimeout(timer); timer = null; }
                throw err;
            }
            timer = setTimeout(() => { inThrottle = false; timer = null; }, cooldown);
        }
    };
    throttled.pending = () => timer !== null;
    return throttled;
}


/**
 * Wrap a function so it can only be called once.
 * Subsequent calls return the result of the first invocation.
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
 * Wait for a given number of milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    const delay = Number.isFinite(ms) && ms > 0 ? ms : 0;
    return new Promise(resolve => setTimeout(resolve, delay));
}


/**
 * Memoize a function so repeated calls with the same arguments
 * return a cached result. Uses a simple JSON key for serialization.
 * @param {(...args: any[]) => any} fn
 * @param {number} [maxSize=1000] Maximum number of cached entries.
 * @returns {((...args: any[]) => any) & {clear:()=>void}} Memoized function with `.clear()` method.
 */
export function memoize(fn, maxSize = 1000) {
    if (typeof fn !== 'function') throw new TypeError('memoize requires a function');
    const limit = Number.isFinite(maxSize) && maxSize > 0 ? Math.floor(maxSize) : 1000;
    const cache = new Map();
    const memoized = function (...args) {
        let key;
        try {
            key = JSON.stringify(args, (_k, v) => (v === undefined ? '__memo_undefined__' : v));
        } catch {
            return fn.apply(this, args);
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
    memoized.has = (key) => {
        if (key === undefined) return false;
        let k;
        try {
            k = JSON.stringify([key], (_k, v) => (v === undefined ? '__memo_undefined__' : v));
        } catch {
            return false;
        }
        return cache.has(k);
    };
    return memoized;
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
    if (typeof fn !== 'function') throw new TypeError('retry expects a function');
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
 * Debounce an async function so repeated calls within the wait window
 * reset the timer. Returns a promise that resolves with the latest result.
 * @param {(...args: any[]) => Promise<any>} fn Async function to debounce.
 * @param {number} [wait=300] Delay in milliseconds.
 * @returns {((...args: any[]) => Promise<any>) & {cancel:()=>void,flush:()=>Promise<any>,pending:()=>boolean}} Debounced async function with `.cancel()`, `.flush()`, and `.pending()`.
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
 * Debounce a function so it fires on the leading edge and then ignores
 * subsequent calls until the cooldown expires.
 * @param {(...args: any[]) => any} fn Function to debounce.
 * @param {number} [wait=300] Delay in milliseconds.
 * @returns {((...args: any[]) => any) & {cancel:()=>void}} Debounced function with `.cancel()` method.
 */
export function debounceLeading(fn, wait = 300) {
    if (typeof fn !== 'function') throw new TypeError('debounceLeading requires a function');
    const delay = Number.isFinite(wait) && wait > 0 ? wait : 0;
    let timeout = null;
    const debounced = function (...args) {
        if (timeout === null) {
            fn.apply(this, args);
        } else {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => { timeout = null; }, delay);
    };
    debounced.cancel = () => {
        if (timeout !== null) { clearTimeout(timeout); timeout = null; }
    };
    return debounced;
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
 * Parallel map with optional concurrency limit.
 * @template T, R
 * @param {T[]} array
 * @param {(item: T, index: number) => Promise<R>} mapper
 * @param {number} [concurrency=Infinity]
 * @returns {Promise<R[]>}
 */
export async function pMap(array, mapper, concurrency = Infinity) {
    if (!Array.isArray(array)) return [];
    if (typeof mapper !== 'function') throw new TypeError('pMap expects a function');
    const limit = Number.isFinite(concurrency) && concurrency > 0 ? Math.floor(concurrency) : Infinity;
    if (limit === Infinity) return Promise.all(array.map(mapper));
    const results = [];
    let index = 0;
    let active = 0;
    return new Promise((resolve, reject) => {
        function next() {
            if (index >= array.length) {
                if (active === 0) resolve(results);
                return;
            }
            const i = index++;
            active++;
            Promise.resolve(mapper(array[i], i)).then((value) => {
                results[i] = value;
                active--;
                next();
            }, reject);
        }
        for (let j = 0; j < limit && j < array.length; j++) next();
    });
}


/**
 * Memoize an async function so repeated calls with the same arguments
 * return a cached promise.
 * @param {(...args: any[]) => Promise<any>} fn Async function to memoize.
 * @param {(...args: any[]) => any} [resolver] Optional function to generate a cache key from arguments.
 * @returns {((...args: any[]) => Promise<any>) & {clear:()=>void, size: number, has:(key: any)=>boolean}}
 */
export function memoizeAsync(fn, resolver) {
    if (typeof fn !== 'function') throw new TypeError('memoizeAsync expects a function');
    const cache = new Map();
    const memoized = function (...args) {
        const key = typeof resolver === 'function' ? resolver.apply(this, args) : JSON.stringify(args);
        if (cache.has(key)) return cache.get(key);
        const promise = fn.apply(this, args).catch((err) => {
            cache.delete(key);
            throw err;
        });
        cache.set(key, promise);
        return promise;
    };
    memoized.clear = () => cache.clear();
    Object.defineProperty(memoized, 'size', { get: () => cache.size });
    memoized.has = (key) => cache.has(key);
    return memoized;
}


/**
 * Poll a predicate until it returns truthy or times out.
 * @template T
 * @param {() => T} fn Predicate to poll.
 * @param {number} intervalMs Interval between polls.
 * @param {number} [timeoutMs=30000] Total timeout.
 * @returns {Promise<T>}
 */
export function poll(fn, intervalMs, timeoutMs = 30000) {
    if (typeof fn !== 'function') throw new TypeError('poll expects a function');
    const interval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 1000;
    const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000;
    const start = Date.now();
    return new Promise((resolve, reject) => {
        function tick() {
            try {
                const result = fn();
                if (result) return resolve(result);
            } catch (err) {
                return reject(err);
            }
            if (Date.now() - start > timeout) {
                return reject(new Error('Poll timed out'));
            }
            setTimeout(tick, interval);
        }
        tick();
    });
}


/**
 * Wait until a predicate returns truthy.
 * @param {() => boolean} predicate
 * @param {number} [intervalMs=100]
 * @param {number} [timeoutMs=30000]
 * @returns {Promise<void>}
 */
export function waitForAsync(predicate, intervalMs = 100, timeoutMs = 30000) {
    if (typeof predicate !== 'function') throw new TypeError('waitForAsync expects a function');
    const interval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 100;
    const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000;
    const start = Date.now();
    return new Promise((resolve, reject) => {
        function tick() {
            try {
                if (predicate()) return resolve();
            } catch (err) {
                return reject(err);
            }
            if (Date.now() - start > timeout) {
                return reject(new Error('waitForAsync timed out'));
            }
            setTimeout(tick, interval);
        }
        tick();
    });
}


/**
 * Throttle an async function so it runs at most once per wait window.
 * @param {(...args: any[]) => Promise<any>} fn Async function to throttle.
 * @param {number} [wait=300] Delay in milliseconds.
 * @returns {((...args: any[]) => Promise<any>) & {cancel:()=>void, flush:()=>Promise<any>, pending:()=>boolean}}
 */
export function throttleAsync(fn, wait = 300) {
    if (typeof fn !== 'function') throw new TypeError('throttleAsync requires a function');
    const delay = Number.isFinite(wait) && wait > 0 ? wait : 0;
    let timeout = null;
    let lastArgs = null;
    let lastThis = null;
    let pendingPromise = null;
    let resolvePending = null;
    let rejectPending = null;
    const throttled = function (...args) {
        lastArgs = args;
        lastThis = this;
        if (timeout !== null) return pendingPromise;
        if (!pendingPromise) {
            pendingPromise = new Promise((resolve, reject) => {
                resolvePending = resolve;
                rejectPending = reject;
            });
        }
        const invoke = async () => {
            timeout = null;
            const argsToUse = lastArgs;
            const self = lastThis;
            lastArgs = lastThis = null;
            try {
                const result = await fn.apply(self, argsToUse);
                resolvePending?.(result);
            } catch (err) {
                rejectPending?.(err);
            } finally {
                pendingPromise = null;
                resolvePending = null;
                rejectPending = null;
            }
        };
        invoke();
        timeout = setTimeout(() => {
            timeout = null;
            if (lastArgs) throttled.apply(lastThis, lastArgs);
        }, delay);
        return pendingPromise;
    };
    throttled.cancel = () => {
        if (timeout !== null) { clearTimeout(timeout); timeout = null; }
        lastArgs = lastThis = null;
        if (rejectPending) {
            rejectPending(new Error('Throttled call was cancelled'));
            pendingPromise = null;
            resolvePending = null;
            rejectPending = null;
        }
    };
    throttled.flush = async () => {
        if (timeout !== null) { clearTimeout(timeout); timeout = null; }
        if (lastArgs) {
            const argsToUse = lastArgs;
            const self = lastThis;
            lastArgs = lastThis = null;
            try {
                const result = await fn.apply(self, argsToUse);
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
    throttled.pending = () => timeout !== null || pendingPromise !== null;
    return throttled;
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

