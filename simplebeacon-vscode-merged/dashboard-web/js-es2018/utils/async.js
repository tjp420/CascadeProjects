/**
 * @module async
 */

export function debounce(fn, ms = 300) {
    if (typeof fn !== 'function')
        throw new TypeError('debounce requires a function');
    const delay = Number.isFinite(ms) && ms > 0 ? ms : 0;
    let timer;
    let lastArgs;
    let lastThis;
    const debounced = function (...args) {
        lastArgs = args;
        lastThis = this;
        clearTimeout(timer);
        timer = setTimeout(() => {
            timer = undefined;
            const argsToUse = lastArgs;
            const self = lastThis;
            lastArgs = lastThis = undefined;
            if (argsToUse !== undefined) {
                fn.apply(self, argsToUse);
            }
        }, delay);
    };
    debounced.cancel = () => {
        clearTimeout(timer);
        timer = lastArgs = lastThis = undefined;
    };
    debounced.flush = () => {
        if (timer !== undefined) {
            clearTimeout(timer);
            timer = undefined;
            const argsToUse = lastArgs;
            const self = lastThis;
            lastArgs = lastThis = undefined;
            if (argsToUse !== undefined) {
                fn.apply(self, argsToUse);
            }
        }
    };
    debounced.pending = () => timer !== undefined;
    return debounced;
}

export function sleep(ms) {
    const delay = Number.isFinite(ms) && ms > 0 ? ms : 0;
    return new Promise(resolve => setTimeout(resolve, delay));
}

export function once(fn) {
    if (typeof fn !== 'function')
        throw new TypeError('once requires a function');
    let called = false;
    let result;
    let error;
    return function (...args) {
        if (called) {
            if (error)
                throw error;
            return result;
        }
        called = true;
        try {
            result = fn.apply(this, args);
            return result;
        }
        catch (err) {
            error = err;
            throw err;
        }
    };
}

export function memoize(fn, maxSize = 1000) {
    if (typeof fn !== 'function')
        throw new TypeError('memoize requires a function');
    const limit = Number.isFinite(maxSize) && maxSize > 0 ? Math.floor(maxSize) : 1000;
    const cache = new Map();
    const memoized = function (...args) {
        let key;
        try {
            key = _makeMemoKey(args);
        }
        catch (_a) {
            return fn.apply(this, args);
        }
        if (cache.has(key)) {
            // Promote to most-recently-used
            const value = cache.get(key);
            cache.delete(key);
            cache.set(key, value);
            return value;
        }
        const result = fn.apply(this, args);
        cache.set(key, result);
        if (cache.size > limit) {
            const oldest = cache.keys().next().value;
            if (oldest)
                cache.delete(oldest);
        }
        return result;
    };
    memoized.clear = () => cache.clear();
    Object.defineProperty(memoized, 'size', { get: () => cache.size });
    memoized.has = (...args) => {
        try {
            return cache.has(_makeMemoKey(args));
        }
        catch (_a) {
            return false;
        }
    };
    return memoized;
}

export function throttle(fn, wait = 300) {
    if (typeof fn !== 'function')
        throw new TypeError('throttle requires a function');
    const cooldown = Number.isFinite(wait) && wait > 0 ? wait : 0;
    let lastTime = 0;
    let lastArgs = null;
    let lastThis = null;
    let timer = null;
    const invoke = () => {
        lastTime = Date.now();
        const args = lastArgs;
        const self = lastThis;
        lastArgs = lastThis = null;
        fn.apply(self, args);
    };
    const throttled = function (...args) {
        const now = Date.now();
        lastArgs = args;
        lastThis = this;
        if (now - lastTime >= cooldown) {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            invoke();
        }
        else if (!timer) {
            timer = setTimeout(() => { timer = null; invoke(); }, cooldown - (now - lastTime));
        }
    };
    throttled.cancel = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        lastArgs = lastThis = null;
        lastTime = 0;
    };
    throttled.flush = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        if (lastArgs !== null) {
            lastTime = Date.now();
            const args2 = lastArgs;
            const self = lastThis;
            lastArgs = lastThis = null;
            fn.apply(self, args2);
        }
    };
    throttled.pending = () => timer !== null;
    return throttled;
}

export function debounceAsync(fn, wait = 300) {
    if (typeof fn !== 'function')
        throw new TypeError('debounceAsync requires a function');
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
        if (timeout !== null)
            clearTimeout(timeout);
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
                resolvePending === null || resolvePending === void 0 ? void 0 : resolvePending(result);
            }
            catch (err) {
                rejectPending === null || rejectPending === void 0 ? void 0 : rejectPending(err);
            }
            finally {
                pendingPromise = null;
                resolvePending = null;
                rejectPending = null;
            }
        }, delay);
        return pendingPromise;
    };
    debounced.cancel = () => {
        if (timeout !== null)
            clearTimeout(timeout);
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
            if (argsToUse === null)
                return pendingPromise !== null && pendingPromise !== void 0 ? pendingPromise : undefined;
            try {
                const result = await fn.apply(thisToUse, argsToUse);
                resolvePending === null || resolvePending === void 0 ? void 0 : resolvePending(result);
                return result;
            }
            catch (err) {
                rejectPending === null || rejectPending === void 0 ? void 0 : rejectPending(err);
                throw err;
            }
            finally {
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

export function withTimeout(promise, ms, message = 'Operation timed out') {
    if (!promise || typeof promise.then !== 'function') {
        return Promise.reject(new TypeError('withTimeout requires a valid Promise'));
    }
    const timeoutMs = Number.isFinite(ms) && ms > 0 ? ms : 0;
    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (!settled)
                reject(new Error(message));
        }, timeoutMs);
        promise.then((value) => { settled = true; clearTimeout(timer); resolve(value); }, (err) => { settled = true; clearTimeout(timer); reject(err); });
    });
}

export function delay(ms) {
    return sleep(ms);
}

export function seq(...fns) {
    return (value) => fns.reduce((v, fn) => fn(v), value);
}

export function flow(...fns) {
    return (value) => fns.reduceRight((v, fn) => fn(v), value);
}

export function negate(predicate) {
    if (typeof predicate !== 'function')
        throw new TypeError('negate requires a function');
    return function (...args) {
        return !predicate(...args);
    };
}

export function debounceLeading(fn, wait = 300) {
    if (typeof fn !== 'function')
        throw new TypeError('debounceLeading requires a function');
    const delay = Number.isFinite(wait) && wait > 0 ? wait : 0;
    let timeout = null;
    let lastArgs = null;
    let lastThis = null;
    const debounced = function (...args) {
        lastArgs = args;
        lastThis = this;
        if (timeout === null) {
            fn.apply(this, args);
        }
        else {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => { timeout = null; lastArgs = lastThis = null; }, delay);
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
            if (argsToUse !== null)
                fn.apply(self, argsToUse);
        }
    };
    debounced.pending = () => timeout !== null;
    return debounced;
}

export function tryFn(fn, ...args) {
    try {
        return { ok: true, value: fn(...args) };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
}

export function memoizeAsync(fn, maxSize = 100) {
    if (typeof fn !== 'function')
        throw new TypeError('memoizeAsync requires a function');
    const limit = Number.isFinite(maxSize) && maxSize > 0 ? Math.floor(maxSize) : 100;
    const cache = new Map();
    const memoized = async function (...args) {
        let key;
        try {
            key = _makeMemoKey(args);
        }
        catch (_a) {
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
            if (oldest)
                cache.delete(oldest);
        }
        return result;
    };
    memoized.clear = () => cache.clear();
    Object.defineProperty(memoized, 'size', { get: () => cache.size });
    memoized.has = (...args) => {
        try {
            return cache.has(_makeMemoKey(args));
        }
        catch (_a) {
            return false;
        }
    };
    return memoized;
}

export function throttleAsync(fn, limit = 300) {
    if (typeof fn !== 'function')
        throw new TypeError('throttleAsync requires a function');
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
            }
            catch (err) {
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
        }
        else {
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
            }
            catch (err) {
                inThrottle = false;
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                throw err;
            }
            timer = setTimeout(() => { inThrottle = false; timer = null; }, cooldown);
        }
    };
    throttled.pending = () => pendingArgs !== null;
    return throttled;
}
