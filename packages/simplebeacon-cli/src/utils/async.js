/**
 * Async utility functions.
 */

/**
 * Wrap a Promise with a timeout.
 * @param {Promise} promise
 * @param {number} ms
 * @param {string} [message='Operation timed out']
 * @returns {Promise}
 */
function withTimeout(promise, ms, message = 'Operation timed out') {
    if (promise == null || typeof promise.then !== 'function') {
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

/**
 * Retry an async function with exponential backoff.
 * @param {Function} fn
 * @param {number} [retries=3]
 * @param {number} [delayMs=200]
 * @returns {Promise}
 */
async function retry(fn, retries = 3, delayMs = 200) {
    if (typeof fn !== 'function') throw new TypeError('retry expects a function');
    const maxAttempts = Math.max(0, Number.isFinite(retries) ? Math.floor(retries) : 0);
    let lastErr;
    let wait = Number.isFinite(delayMs) && delayMs > 0 ? delayMs : 0;
    for (let attempt = 0; attempt <= maxAttempts; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (attempt < maxAttempts) {
                await sleep(wait);
                wait *= 2;
            }
        }
    }
    throw lastErr;
}

function sleep(ms) {
    const delay = Number.isFinite(ms) && ms > 0 ? ms : 0;
    return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Debounce a function so it only runs after `waitMs` of inactivity.
 * @param {Function} fn
 * @param {number} waitMs
 * @param {boolean} [immediate=false] Invoke on the leading edge.
 * @returns {Function} Debounced function with `.cancel()` and `.flush()` methods.
 */
function debounce(fn, waitMs, immediate = false) {
    if (typeof fn !== 'function') throw new TypeError('debounce expects a function');
    let timeout;
    let lastArgs;
    let lastThis;
    let result;
    function later() {
        timeout = null;
        if (!immediate) result = fn.apply(lastThis, lastArgs);
    }
    const debounced = function (...args) {
        lastThis = this;
        lastArgs = args;
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, waitMs);
        if (callNow) result = fn.apply(lastThis, lastArgs);
        return result;
    };
    debounced.cancel = () => { clearTimeout(timeout); timeout = null; };
    debounced.flush = () => {
        if (timeout) { clearTimeout(timeout); timeout = null; result = fn.apply(lastThis, lastArgs); }
        return result;
    };
    return debounced;
}

/**
 * Wrap a function so it only runs once. Subsequent calls return the first result.
 * @param {Function} fn
 * @returns {Function}
 */
function once(fn) {
    if (typeof fn !== 'function') throw new TypeError('once expects a function');
    let called = false;
    let result;
    return function (...args) {
        if (!called) { called = true; result = fn.apply(this, args); }
        return result;
    };
}

module.exports = { withTimeout, retry, debounce, once, sleep };
