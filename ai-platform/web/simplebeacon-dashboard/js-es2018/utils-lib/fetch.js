/**
 * fetch utilities.
 */

/**
 * Fetch with timeout and optional retry.
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
    const attempt = async (attemptNum) => {
        const controller = new AbortController();
        let cleanup = null;
        if (opts.signal && typeof opts.signal.addEventListener === 'function') {
            if (opts.signal.aborted) {
                throw new Error('Request aborted by caller');
            }
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
                    await new Promise(r => setTimeout(r, backoff));
                    return attempt(attemptNum + 1);
                }
            }
            return res;
        } catch (err) {
            if (err.name === 'AbortError') {
                if (opts.signal?.aborted) {
                    throw new Error('Request aborted by caller');
                }
                throw new Error(`Request timed out — is the server running? (${target})`);
            }
            if (retryCfg.count > 0 && attemptNum < retryCfg.count) {
                const backoff = Math.min(retryCfg.delay * Math.pow(2, attemptNum), retryCfg.maxDelay);
                await new Promise(r => setTimeout(r, backoff));
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

