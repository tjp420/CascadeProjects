/**
 * @module url
 */

const SB_API_BASE_KEY = 'sb_api_base';

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
    // Never bridge a localhost/loopback base from a remote production host.
    if (!_isLocalDevHost() && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname)) return false;
    return true;
  }
  catch (_a) { return false; }
}

function _readStoredApiBase() {
  if (typeof localStorage !== 'undefined') {
    try { return localStorage.getItem(SB_API_BASE_KEY); }
    catch (_a) { /* ignore */ }
  }
  return null;
}

function _storeApiBase(value) {
  if (typeof localStorage !== 'undefined' && value) {
    try { localStorage.setItem(SB_API_BASE_KEY, value); }
    catch (_a) { /* ignore */ }
  }
}

function _readHashApiBase() {
  if (typeof location === 'undefined' || !location.hash) return null;
  try {
    const hashParts = location.hash.split('?');
    if (hashParts.length < 2) return null;
    const params = new URLSearchParams(hashParts[hashParts.length - 1]);
    return params.get(SB_API_BASE_KEY);
  }
  catch (_a) { /* ignore */ }
  return null;
}

export function apiBaseUrl() {
  if (typeof window !== 'undefined' && window.location) {
    try {
      const params = new URLSearchParams(window.location.search);
      const override = params.get(SB_API_BASE_KEY) || _readHashApiBase();
      if (override && _isAllowedApiBase(override)) {
        const base = override.replace(/\/api\/?$/, '');
        _storeApiBase(base);
        return base;
      }
    }
    catch (_a) { /* ignore */ }
    // When served from the local data server, prefer same-origin relative paths
    // so a stale stored port (e.g. 4000) does not break calls to the current port.
    if (/^(localhost|127\.0\.0\.1)$/i.test(location.hostname)) {
      return '';
    }
    // On remote hosts ignore any stored localhost sb_api_base; HTTPS pages cannot
    // reach a local HTTP data server due to mixed-content / LAN access restrictions.
  }
  const env = typeof window !== 'undefined' && window.__SIMPLEBEACON_ENV__;
  return (env && env.API_BASE_URL) || '';
}

export function apiUrl(path) {
  const base = apiBaseUrl();
  const p = String(path || '');
  if (base && p.startsWith('/api/')) {
    const suffix = p.slice(4);
    return base.endsWith('/') ? base + suffix.slice(1) : base + suffix;
  }
  return p;
}

export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function getNonce() {
  const arr = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

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

export function isValidUrl(str) {
  if (typeof str !== 'string' || !str) return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
