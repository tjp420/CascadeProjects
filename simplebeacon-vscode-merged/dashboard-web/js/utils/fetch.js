/**
 * @module fetch
 */

/**
 * Fetch a URL with a timeout and optional exponential-backoff retry.
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [ms=10000]
 * @param {{count?:number,delay?:number,maxDelay?:number}} [retry]
 * @returns {Promise<Response>}
 */
export async function fetchWithTimeout(url, options = {}, ms = 10000, retry = { count: 0, delay: 1000, maxDelay: 30000 }) {
  const target = String(url || '');
  const opts = (options && typeof options === 'object' && !Array.isArray(options)) ? options : {};
  const timeoutMs = Number.isFinite(ms) && ms > 0 ? ms : 10000;
  const retryCfg = { count: 0, delay: 1000, maxDelay: 30000, ...(retry && typeof retry === 'object' && !Array.isArray(retry) ? retry : {}) };

  const sleep = (n) => new Promise(r => setTimeout(r, n));

  const attempt = async (attemptNum) => {
    const controller = new AbortController();
    let cleanup = null;
    if (opts.signal && typeof opts.signal.addEventListener === 'function') {
      if (opts.signal.aborted) throw new Error('Request aborted by caller');
      const onAbort = () => controller.abort();
      opts.signal.addEventListener('abort', onAbort, { once: true });
      cleanup = () => opts.signal.removeEventListener('abort', onAbort);
    }
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(target, { ...opts, signal: controller.signal });
      if (!res.ok) {
        const shouldRetry = retryCfg.count > 0 && attemptNum < retryCfg.count && res.status >= 500;
        if (shouldRetry) {
          const backoff = Math.min(retryCfg.delay * Math.pow(2, attemptNum), retryCfg.maxDelay);
          await sleep(backoff);
          return attempt(attemptNum + 1);
        }
        if (opts.acceptNon2xx !== true) {
          throw new Error(`HTTP ${res.status}${res.statusText ? ' ' + res.statusText : ''} — ${target}`);
        }
      }
      return res;
    } catch (err) {
      if (err.name === 'AbortError') {
        if (opts.signal?.aborted) throw new Error('Request aborted by caller');
        throw new Error(`Request timed out — is the server running? (${target})`);
      }
      if (retryCfg.count > 0 && attemptNum < retryCfg.count) {
        const backoff = Math.min(retryCfg.delay * Math.pow(2, attemptNum), retryCfg.maxDelay);
        await sleep(backoff);
        return attempt(attemptNum + 1);
      }
      throw err;
    } finally {
      clearTimeout(timer);
      if (cleanup) cleanup();
    }
  };
  return attempt(0);
}

/**
 * Wait until an async predicate returns true, polling at the given interval.
 * @param {() => Promise<boolean>} predicate
 * @param {number} [intervalMs=100]
 * @param {number} [timeoutMs=5000]
 * @param {string} [message='Timeout waiting for condition']
 * @returns {Promise<void>}
 */
export async function waitForAsync(predicate, intervalMs = 100, timeoutMs = 5000, message = 'Timeout waiting for condition') {
  if (typeof predicate !== 'function') throw new TypeError('waitForAsync expects a predicate function');
  const start = Date.now();
  const interval = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 100;
  const limit = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 5000;
  const sleep = (n) => new Promise(r => setTimeout(r, n));
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
