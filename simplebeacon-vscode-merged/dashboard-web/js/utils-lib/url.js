/**
 * Get the dashboard API base URL from a meta tag or fall back to relative root.
 * @returns {string}
 */
const SB_API_BASE_KEY = 'sb_api_base';
const SB_NOTIFY_BASE_KEY = 'sb_notify_base';

function _normalizeApiBase(value) {
  if (!value) return '';
  return String(value).replace(/\/api\/?$/, '');
}

function _isLocalDevHost() {
  if (typeof location === 'undefined') return false;
  return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname);
}
function _isAllowedApiBase(value) {
  if (!value) return false;
  try {
    const url = new URL(value, location.href);
    // HTTPS pages cannot call a local HTTP data server (mixed-content / LAN access).
    if (location.protocol === 'https:' && url.protocol === 'http:') return false;
    // Never bridge a localhost/loopback data server from a remote or non-local host.
    if (!_isLocalDevHost() && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname)) return false;
    return true;
  }
  catch (_a) { return false; }
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
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const override = params.get(SB_API_BASE_KEY) || params.get(SB_NOTIFY_BASE_KEY);
    if (override && _isAllowedApiBase(override)) {
      const normalized = _normalizeApiBase(override);
      _storeApiBase(normalized);
      if (params.get(SB_NOTIFY_BASE_KEY)) {
        _storeNotifyBase(String(params.get(SB_NOTIFY_BASE_KEY)).replace(/\/+$/, ''));
      }
      return normalized;
    }
  }
  catch (_a) {
    return null;
  }
  return null;
}

export function apiBaseUrl() {
  if (typeof document !== 'undefined') {
    const fromQuery = _readEmbedApiBaseFromQuery();
    if (fromQuery) {
      _storeApiBase(fromQuery);
      return fromQuery;
    }
    const stored = _readStoredApiBase();
    if (stored && _isAllowedApiBase(stored)) return stored;
    const meta = document.querySelector('meta[name="api-base-url"]');
    if (meta) return meta.getAttribute('content') || '';
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
  if (!segment) return base || '/';
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
export async function fetchWithTimeout(url, ...args) {
  const target = String(url || '');
  const opts = (args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) ? args[0] : {};
  const timeoutMs = Number.isFinite(args[1]) && args[1] > 0 ? args[1] : 10000;
  const retryCfg = { count: 0, delay: 1000, maxDelay: 30000, ...(args[2] && typeof args[2] === 'object' && !Array.isArray(args[2]) ? args[2] : {}) };

  const attempt = async (attemptNum) => {
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

/**
 * Parse a query string into a plain object.
 * @param {string} queryString Query string (with or without leading `?`).
 * @returns {Record<string, string | string[]>} Parsed key-value pairs.
 */
export function parseQueryString(queryString) {
  if (typeof queryString !== 'string') return {};
  const qs = queryString.startsWith('?') ? queryString.slice(1) : queryString;
  const result = {};
  if (!qs) return result;
  for (const pair of qs.split('&')) {
    const eqIdx = pair.indexOf('=');
    const rawKey = eqIdx >= 0 ? pair.slice(0, eqIdx) : pair;
    const rawValue = eqIdx >= 0 ? pair.slice(eqIdx + 1) : '';
    if (!rawKey) continue;
    let key, value;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      key = rawKey;
      value = rawValue;
    }
    if (Object.hasOwn(result, key)) {
      if (Array.isArray(result[key])) result[key].push(value);
      else result[key] = [result[key], value];
    } else {
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
  if (!params || typeof params !== 'object') return '';
  const pairs = [];
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '') continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v != null && v !== '') pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
      }
    } else {
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
  if (typeof window === 'undefined' || !window.location || !key) return null;
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
  if (typeof window === 'undefined' || !window.location || !key) {
    return typeof window !== 'undefined' ? window.location?.href || '' : '';
  }
  const url = new URL(window.location.href);
  if (value == null || value === '') {
    url.searchParams.delete(key);
  } else {
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
  if (!qs) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${qs}`;
}

/**
 * Check whether a string is a valid absolute URL.
 * @param {string} str
 * @returns {boolean}
 */
export function isValidUrl(str) {
  if (typeof str !== 'string' || !str) return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Check if a string looks like a URL.
 * @param {string} str
 * @returns {boolean}
 */
export function isUrl(str) {
  if (typeof str !== 'string') return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
