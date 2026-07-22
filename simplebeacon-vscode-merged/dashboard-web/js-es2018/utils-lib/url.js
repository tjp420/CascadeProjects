/**
 * Get the dashboard API base URL from a meta tag or fall back to relative root.
 * @returns {string}
 */
const SB_API_BASE_KEY = 'sb_api_base';
const SB_NOTIFY_BASE_KEY = 'sb_notify_base';

function _normalizeApiBase(value) {
    if (!value)
        return '';
    return String(value).replace(/\/api\/?$/, '');
}

function _isLocalDevHost() {
    if (typeof location === 'undefined') return false;
    return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname);
}
function _isLoopbackHost(hostname) {
    return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(String(hostname || ''));
}
function _isAllowedApiBase(value) {
    if (!value) return false;
    try {
        const url = new URL(value, location.href);
        const isLoopback = _isLoopbackHost(url.hostname);
        // HTTPS pages cannot call a local HTTP data server (mixed-content / LAN access).
        if (!isLoopback && location.protocol === 'https:' && url.protocol === 'http:') return false;
        // Extension bridge: VS Code opens the hosted dashboard with loopback sb_api_base.
        if (!_isLocalDevHost() && isLoopback) {
            try {
                const params = new URLSearchParams(location.search || '');
                if (params.get(SB_API_BASE_KEY) || params.get(SB_NOTIFY_BASE_KEY))
                    return true;
            }
            catch (_b) { /* ignore */ }
            try {
                if (typeof sessionStorage !== 'undefined'
                    && (sessionStorage.getItem(SB_API_BASE_KEY) || sessionStorage.getItem(SB_NOTIFY_BASE_KEY))) {
                    return true;
                }
            }
            catch (_c) { /* ignore */ }
            return false;
        }
        return true;
    }
    catch (_a) { return false; }
}

/** Persist VS Code extension bridge params for hosted dashboard routes (Ollama proxy, notify). */
export function persistExtensionBridge(apiBase, options = {}) {
    if (typeof window === 'undefined' || !apiBase)
        return false;
    const raw = String(apiBase).replace(/\/+$/, '');
    // Normalize to host root without trailing `/api`
    const hostRoot = raw.replace(/\/api\/?$/i, '');
    const apiUrl = hostRoot.endsWith('/') ? `${hostRoot}api` : `${hostRoot}/api`;
    if (!_isAllowedApiBase(apiUrl))
        return false;
    if (_isLocalDevHost() && typeof location !== 'undefined' && location.protocol === 'http:') {
        try {
            if (new URL(apiUrl).port === '4000')
                return false;
        }
        catch (_port) { /* ignore */ }
    }
    // Store canonical host root (no trailing `/api`)
    _storeApiBase(hostRoot);
    _storeNotifyBase(hostRoot);
    window.__SB_BRIDGE_HOST__ = hostRoot;
    if (options.websiteMode !== false && typeof sessionStorage !== 'undefined') {
        try {
            sessionStorage.setItem('sb_website_mode', '1');
        }
        catch (_a) { /* ignore */ }
    }
    if (options.updateUrl !== false) {
        try {
            const url = new URL(window.location.href);
            // Persist the host root (no trailing `/api`) in the URL to keep storage consistent.
            url.searchParams.set(SB_API_BASE_KEY, hostRoot);
            url.searchParams.set(SB_NOTIFY_BASE_KEY, hostRoot);
            url.searchParams.set('sb_website_mode', '1');
            if (!url.searchParams.has('sb_parent_urlbar'))
                url.searchParams.set('sb_parent_urlbar', '1');
            window.history.replaceState({}, '', url.toString());
        }
        catch (_b) { /* ignore */ }
    }
    return true;
}

/** Drop stale extension bridge state when the local data server is unreachable. */
export function clearExtensionBridge(options = {}) {
    if (typeof sessionStorage !== 'undefined') {
        try {
            sessionStorage.removeItem(SB_API_BASE_KEY);
            sessionStorage.removeItem(SB_NOTIFY_BASE_KEY);
        }
        catch (_a) { /* ignore */ }
    }
    if (typeof window !== 'undefined') {
        try {
            delete window.__SB_BRIDGE_HOST__;
        }
        catch (_b) { /* ignore */ }
    }
    if (options.updateUrl !== false && typeof window !== 'undefined') {
        try {
            const url = new URL(window.location.href);
            [SB_API_BASE_KEY, SB_NOTIFY_BASE_KEY, 'sb_website_mode', 'sb_parent_urlbar'].forEach((key) => {
                url.searchParams.delete(key);
            });
            window.history.replaceState({}, '', url.toString());
        }
        catch (_c) { /* ignore */ }
    }
}

function _readStoredApiBase() {
    if (typeof sessionStorage !== 'undefined') {
        try {
            return sessionStorage.getItem(SB_API_BASE_KEY);
        }
        catch (_a) { /* ignore */ }
    }
    return null;
}

function _storeApiBase(value) {
    if (typeof sessionStorage !== 'undefined' && value) {
        try {
            sessionStorage.setItem(SB_API_BASE_KEY, value);
        }
        catch (_a) { /* ignore */ }
    }
}

function _storeNotifyBase(value) {
    if (typeof sessionStorage !== 'undefined' && value) {
        try {
            sessionStorage.setItem(SB_NOTIFY_BASE_KEY, value);
        }
        catch (_a) { /* ignore */ }
    }
}

function _readEmbedApiBaseFromQuery() {
    if (typeof window === 'undefined')
        return null;
    try {
        const params = new URLSearchParams(window.location.search);
        const override = params.get(SB_API_BASE_KEY) || params.get(SB_NOTIFY_BASE_KEY);
        if (override) {
            // Normalize into host root without trailing `/api`
            const raw = String(override).replace(/\/+$/, '');
            const hostRoot = raw.replace(/\/api\/?$/i, '');
            const apiUrl = hostRoot.endsWith('/') ? `${hostRoot}api` : `${hostRoot}/api`;
            if (_isAllowedApiBase(apiUrl)) {
                _storeApiBase(hostRoot);
                if (params.get(SB_NOTIFY_BASE_KEY)) {
                    _storeNotifyBase(String(params.get(SB_NOTIFY_BASE_KEY)).replace(/\/+$/, '').replace(/\/api\/?$/i, ''));
                }
                return hostRoot;
            }
        }
    }
    catch (_a) {
        return null;
    }
    return null;
}

export function apiBaseUrl() {
    if (typeof document !== 'undefined') {
        // Runtime config injected by the API server or extension bridge.
        if (typeof window !== 'undefined') {
            const env = window.__SIMPLEBEACON_ENV__ || {};
            const envBase = env.API_BASE_URL || env.DASHBOARD_BASE_URL || window.__SB_API_HOST__ || '';
            if (envBase && _isAllowedApiBase(envBase)) {
                return _normalizeApiBase(envBase);
            }
        }
        // Extension can pass a local API base when the dashboard is loaded from the static website.
        const fromQuery = _readEmbedApiBaseFromQuery();
        if (fromQuery) {
            _storeApiBase(fromQuery);
            return fromQuery;
        }
        const stored = _readStoredApiBase();
        if (stored && _isAllowedApiBase(stored))
            return stored;
        const meta = document.querySelector('meta[name="api-base-url"]');
        if (meta) {
            const metaBase = meta.getAttribute('content') || '';
            if (metaBase) return _normalizeApiBase(metaBase);
        }
    }
    if (typeof location !== 'undefined') {
        const host = location.hostname;
        if (host === 'simplebeacon.ai') {
            return location.origin;
        }
        // Cloudflare Pages previews and other non-local/custom domains talk to the production API.
        if (!/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host) && !host.endsWith('.onrender.com')) {
            return 'https://simplebeacon.ai';
        }
    }
    return '/';
}
/**
 * Build a full API URL from a path segment.
 * @param {string} path
 * @returns {string}
 */
export function apiUrl(path) {
    const base = apiBaseUrl().replace(/\/+$/, '');
    const segment = String(path || '').replace(/^\/+/, '');
    if (!segment)
        return base || '/';
    return `${base}/${segment}`;
}
/**
 * Fetch with timeout and caller abort support.
 * Distinguishes between caller-initiated abort and timeout expiry.
 * @param {string} url
 * @param {RequestInit} [options]
 * @param {number} [ms=10000] Timeout in milliseconds.
 * @param {{count?:number,delay?:number,maxDelay?:number}} [retry] Retry config.
 * @returns {Promise<Response>}
 */
// simplebeacon-ignore mega-params — backward-compatible fetch wrapper with timeout and retry
export async function fetchWithTimeout(url, options = {}, ms = 10000, retry = { count: 0, delay: 1000, maxDelay: 30000 }) {
    const target = String(url || '');
    const opts = (options && typeof options === 'object' && !Array.isArray(options)) ? options : {};
    const timeoutMs = Number.isFinite(ms) && ms > 0 ? ms : 10000;
    const retryCfg = { count: 0, delay: 1000, maxDelay: 30000, ...(retry && typeof retry === 'object' && !Array.isArray(retry) ? retry : {}) };
    const attempt = async (attemptNum) => {
        var _a;
        const controller = new AbortController();
        let timer;
        let cleanup = null;
        try {
            if (opts.signal && typeof opts.signal.addEventListener === 'function') {
                if (opts.signal.aborted) {
                    throw new Error('Request aborted by caller');
                }
                const onAbort = () => controller.abort();
                opts.signal.addEventListener('abort', onAbort, { once: true });
                cleanup = () => opts.signal.removeEventListener('abort', onAbort);
            }
            timer = setTimeout(() => controller.abort(), timeoutMs);
            const res = await fetch(target, { ...opts, signal: controller.signal });
            if (!res.ok) {
                const shouldRetry = retryCfg.count > 0 && attemptNum < retryCfg.count && res.status >= 500;
                if (shouldRetry) {
                    const backoff = Math.min(retryCfg.delay * Math.pow(2, attemptNum), retryCfg.maxDelay);
                    await new Promise(r => setTimeout(r, backoff));
                    return attempt(attemptNum + 1);
                }
                if (opts.acceptNon2xx !== true) {
                    throw new Error(`HTTP ${res.status}${res.statusText ? ' ' + res.statusText : ''} — ${target}`);
                }
            }
            return res;
        }
        catch (err) {
            if (err.name === 'AbortError') {
                if ((_a = opts.signal) === null || _a === void 0 ? void 0 : _a.aborted) {
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
        }
        finally {
            clearTimeout(timer);
            if (cleanup)
                cleanup();
        }
    };
    return attempt(0);
}
/**
 * Parse a query string into a plain object.
 * @param {string} queryString Query string (with or without leading `?`).
 * @returns {Record<string, string | string[]>} Parsed key-value pairs.
 */
export function parseQueryString(queryString) {
    if (typeof queryString !== 'string')
        return {};
    const qs = queryString.startsWith('?') ? queryString.slice(1) : queryString;
    const result = {};
    if (!qs)
        return result;
    for (const pair of qs.split('&')) {
        const eqIdx = pair.indexOf('=');
        const rawKey = eqIdx >= 0 ? pair.slice(0, eqIdx) : pair;
        const rawValue = eqIdx >= 0 ? pair.slice(eqIdx + 1) : '';
        if (!rawKey)
            continue;
        let key, value;
        try {
            key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
            value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
        }
        catch (_a) {
            key = rawKey;
            value = rawValue;
        }
        if (Object.hasOwn(result, key)) {
            if (Array.isArray(result[key]))
                result[key].push(value);
            else
                result[key] = [result[key], value];
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
/**
 * Build a query string from a plain object.
 * @param {Record<string, string|number|boolean|null|undefined>} params
 * @returns {string} Query string without leading `?`.
 */
export function stringifyQueryString(params) {
    if (!params || typeof params !== 'object')
        return '';
    const pairs = [];
    for (const [key, value] of Object.entries(params)) {
        if (value == null || value === '')
            continue;
        if (Array.isArray(value)) {
            for (const v of value) {
                if (v != null && v !== '')
                    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
            }
        }
        else {
            pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
    }
    return pairs.join('&');
}
/**
 * Get a single query parameter value from the current window URL.
 * @param {string} key
 * @returns {string|null}
 */
export function getQueryParam(key) {
    if (typeof window === 'undefined' || !window.location || !key)
        return null;
    const params = new URLSearchParams(window.location.search);
    return params.has(key) ? params.get(key) : null;
}
/**
 * Return the current URL with a query parameter added or updated.
 * @param {string} key
 * @param {string} value
 * @returns {string}
 */
export function setQueryParam(key, value) {
    var _a;
    if (typeof window === 'undefined' || !window.location || !key) {
        return typeof window !== 'undefined' ? ((_a = window.location) === null || _a === void 0 ? void 0 : _a.href) || '' : '';
    }
    const url = new URL(window.location.href);
    if (value == null || value === '') {
        url.searchParams.delete(key);
    }
    else {
        url.searchParams.set(key, String(value));
    }
    return url.toString();
}
/**
 * Build a URL string from a base path and an object of query params.
 * @param {string} base
 * @param {Record<string, string|number|boolean|null|undefined>} params
 * @returns {string}
 */
export function buildUrl(base, params) {
    const qs = stringifyQueryString(params);
    if (!qs)
        return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}${qs}`;
}
/**
 * Check whether a string is a valid absolute URL.
 * @param {string} str
 * @returns {boolean}
 */
export function isValidUrl(str) {
    if (typeof str !== 'string' || !str)
        return false;
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch (_a) {
        return false;
    }
}
/** Check if a string looks like a URL.
 * @param {string} str
 * @returns {boolean}
 */
export function isUrl(str) {
    if (typeof str !== 'string')
        return false;
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch (_a) {
        return false;
    }
}
