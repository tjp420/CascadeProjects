/**
 * url utilities.
 */


/**
 * API base URL — uses injected `window.__SIMPLEBEACON_ENV__` when
 * served by the data server; falls back to relative paths in standalone / proxy mode.
 * @returns {string}
 */
export function apiBaseUrl() {
  const env = typeof window !== 'undefined' && window.__SIMPLEBEACON_ENV__;
  return (env && env.API_BASE_URL) || '';
}


/**
 * Resolve an API path to a full URL using the configured base.
 * @param {string} path
 * @returns {string}
 */
export function apiUrl(path) {
  const base = apiBaseUrl();
  const p = String(path || '');
  if (base && p.startsWith('/api/')) {
    const suffix = p.slice(4);
    return base.endsWith('/') ? base + suffix.slice(1) : base + suffix;
  }
  return p;
}


/**
 * Parse a query string into a plain object.
 * @param {string} queryString Query string (with or without leading `?`).
 * @returns {Record<string, string>} Parsed key-value pairs.
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
    const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    const value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
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
 * Check whether a string is a valid absolute URL.
 * @param {string} str
 * @returns {boolean}
 */
export function isValidUrl(str) {
  if (typeof str !== 'string' || !str) return false;
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

