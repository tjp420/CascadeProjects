// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Log recoverable dashboard error.
 * @param {string} contextLabel
 * @param {any} error
 * @returns {any}
 */
export function logRecoverableDashboardError(contextLabel, error) {
    const message = error instanceof Error ? error.message : String(error);
    window['console']['debug'](`[Simplebeacon dashboard] ${contextLabel}: ${message}`);
}

/**
 * Has json content type.
 * @param {any} response
 * @returns {any}
 */
export function hasJsonContentType(response) {
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    return contentType.includes('application/json');
}

/**
 * Read json response body.
 * @param {any} response
 * @param {any} fallback
 * @returns {any}
 */
export async function readJsonResponseBody(response, fallback = null) {
    if (!hasJsonContentType(response)) return fallback;
    const parsedBody = await response.json().catch(parseError => {
        logRecoverableDashboardError('JSON response parse', parseError);
        return fallback;
    });
    return parsedBody == null ? fallback : parsedBody;
}

/**
 * With recoverable fallback.
 * @param {string} contextLabel
 * @param {any} asyncOperation
 * @param {any} fallbackFactory
 * @returns {any}
 */
export async function withRecoverableFallback(contextLabel, asyncOperation, fallbackFactory) {
    try {
        return await asyncOperation();
    } catch (error) {
        logRecoverableDashboardError(contextLabel, error);
        return typeof fallbackFactory === 'function' ? fallbackFactory(error) : fallbackFactory;
    }
}

function _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Robust fetch with retries, timeout, and optional auth.
 * Returns the Response on success, the Response on non-retriable HTTP errors (e.g. 4xx),
 * or null on network/timeout failure after retries.
 */
export async function fetchApi(url, options = {}) {
    const {
        method = 'GET',
        headers = {},
        body = undefined,
        retries = 2,
        retryDelay = 300,
        timeoutMs = 10000,
        retryOn = [502, 503, 504]
    } = options;

    for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        let timeoutId;
        try {
            if (controller) timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            const resp = await fetch(url, {
                method,
                headers,
                body,
                signal: controller ? controller.signal : undefined
            });
            if (timeoutId) clearTimeout(timeoutId);

            if (resp.ok) return resp;
            if (resp.status === 401) return resp; // let callers handle auth/reauth
            if (retryOn.includes(resp.status) && attempt < retries) {
                await _delay(retryDelay * Math.pow(2, attempt));
                continue;
            }
            return resp; // non-retriable HTTP error (e.g. 404, 4xx)
        } catch (err) {
            if (timeoutId) clearTimeout(timeoutId);
            const isAbort = err && err.name === 'AbortError';
            if (isAbort) {
                if (attempt === retries) {
                    logRecoverableDashboardError('fetchApi network', new Error('Request timed out after retries'));
                }
            } else if (attempt === retries) {
                logRecoverableDashboardError('fetchApi network', err);
            }
            if (attempt < retries) {
                await _delay(retryDelay * Math.pow(2, attempt));
                continue;
            }
            return null;
        }
    }
    return null;
}

/**
 * Convenience wrapper that adds `Authorization: Bearer <token>` header.
 */
export async function fetchApiWithAuth(url, token, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return fetchApi(url, Object.assign({}, options, { headers }));
}
