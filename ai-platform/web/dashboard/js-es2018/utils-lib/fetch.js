/**
 * @module fetch
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
    const sleep = (n) => new Promise(r => setTimeout(r, n));
    const attempt = async (attemptNum) => {
        var _a;
        const controller = new AbortController();
        let cleanup = null;
        if (opts.signal && typeof opts.signal.addEventListener === 'function') {
            if (opts.signal.aborted)
                throw new Error('Request aborted by caller');
            const onAbort = () => controller.abort();
            opts.signal.addEventListener('abort', onAbort, { once: true });
            cleanup = () => opts.signal.removeEventListener('abort', onAbort);
        }
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
            try {
                const targetUrl = new URL(target, typeof location !== 'undefined' ? location.href : undefined);
                if (typeof location !== 'undefined' && opts && opts.credentials === 'include' && targetUrl.origin !== location.origin) {
                    opts = { ...opts, credentials: 'omit' };
                }
            }
            catch (_c) { /* ignore */ }
            const res = await fetch(target, { ...opts, signal: controller.signal });
            if (!res.ok) {
                const shouldRetry = retryCfg.count > 0 && attemptNum < retryCfg.count && res.status >= 500;
                if (shouldRetry) {
                    const backoff = Math.min(retryCfg.delay * Math.pow(2, attemptNum), retryCfg.maxDelay);
                    await sleep(backoff);
                    return attempt(attemptNum + 1);
                }
            }
            return res;
        }
        catch (err) {
            if (err.name === 'AbortError') {
                if ((_a = opts.signal) === null || _a === void 0 ? void 0 : _a.aborted)
                    throw new Error('Request aborted by caller');
                throw new Error(`Request timed out — is the server running? (${target})`);
            }
            if (retryCfg.count > 0 && attemptNum < retryCfg.count) {
                const backoff = Math.min(retryCfg.delay * Math.pow(2, attemptNum), retryCfg.maxDelay);
                await sleep(backoff);
                return attempt(attemptNum + 1);
            }
            throw err;
        }
        finally {
            clearTimeout(timer);
            if (cleanup)
                cleanup();
        }
    };
    return attempt(0);
}
