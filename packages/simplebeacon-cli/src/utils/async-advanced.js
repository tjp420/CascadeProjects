/**
 * Advanced async utility helpers.
 * @module utils/async-advanced
 */

/**
 * Debounce an async function. Returns a promise that resolves/rejects
 * with the result of the last invocation within the wait window.
 * @param {Function} fn
 * @param {number} waitMs
 * @returns {Function}
 */
function debounceAsync(fn, waitMs = 300) {
  let timer = null;
  let pending = [];
  return function (...args) {
    return new Promise((resolve, reject) => {
      if (timer) clearTimeout(timer);
      pending.push({ resolve, reject });
      timer = setTimeout(async () => {
        const current = pending;
        pending = [];
        timer = null;
        try {
          const result = await fn.apply(this, args);
          for (const p of current) p.resolve(result);
        } catch (err) {
          for (const p of current) p.reject(err);
        }
      }, waitMs);
    });
  };
}

/**
 * Throttle an async function so it runs at most once per limit window.
 * @param {Function} fn
 * @param {number} limitMs
 * @returns {Function}
 */
function throttleAsync(fn, limitMs = 300) {
  let last = 0;
  let pending = null;
  return async function (...args) {
    const now = Date.now();
    if (now - last >= limitMs) {
      last = now;
      return fn.apply(this, args);
    }
    if (!pending) {
      pending = new Promise((resolve) => {
        const delay = limitMs - (now - last);
        setTimeout(() => {
          last = Date.now();
          pending = null;
          resolve(fn.apply(this, args));
        }, delay);
      });
    }
    return pending;
  };
}

/**
 * LRU-cached async memoization.
 * @param {Function} fn
 * @param {number} [maxSize=128]
 * @returns {Function}
 */
function memoizeAsync(fn, maxSize = 128) {
  const cache = new Map();
  return async function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      const val = cache.get(key);
      cache.delete(key);
      cache.set(key, val);
      return val;
    }
    const result = await fn.apply(this, args);
    if (cache.size >= maxSize) {
      const first = cache.keys().next().value;
      cache.delete(first);
    }
    cache.set(key, result);
    return result;
  };
}

/**
 * Retry an async function with exponential backoff.
 * @param {Function} fn Function to retry.
 * @param {Object} [opts]
 * @param {number} [opts.retries=3] Max retry attempts.
 * @param {number} [opts.delayMs=1000] Initial delay.
 * @param {number} [opts.backoff=2] Backoff multiplier.
 * @param {number} [opts.maxDelayMs=30000] Max delay cap.
 * @param {Function} [opts.shouldRetry] Predicate to determine if error is retriable.
 * @returns {Promise<any>}
 */
async function retry(fn, opts = {}) {
  const {
    retries = 3,
    delayMs = 1000,
    backoff = 2,
    maxDelayMs = 30000,
    shouldRetry = () => true,
  } = opts;
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= retries || !shouldRetry(err)) throw err;
      const wait = Math.min(delayMs * Math.pow(backoff, attempt), maxDelayMs);
      await new Promise((r) => setTimeout(r, wait));
      attempt++;
    }
  }
}

/**
 * Race a promise against a timeout.
 * @param {Promise<any>} promise
 * @param {number} ms
 * @param {string} [message='Operation timed out']
 * @returns {Promise<any>}
 */
async function withTimeout(promise, ms, message = 'Operation timed out') {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Promise-based sleep.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  debounceAsync,
  throttleAsync,
  memoizeAsync,
};
