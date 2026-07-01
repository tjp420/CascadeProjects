// simplebeacon-ignore memory-leak — pure network/url utility functions

/**
 * Check whether a string is a valid absolute URL.
 * @param {string} str
 * @returns {boolean}
 */
export function isValidUrl(str: string): boolean {
  if (typeof str !== 'string' || !str) return false;
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a query string into a plain object.
 * Duplicate keys are collected into arrays.
 * @param {string} queryString Query string (with or without leading `?`).
 * @returns {Record<string, string | string[]>} Parsed key-value pairs.
 */
export function parseQueryString(queryString: string): Record<string, string | string[]> {
  if (typeof queryString !== 'string') return {};
  const qs = queryString.startsWith('?') ? queryString.slice(1) : queryString;
  const result: Record<string, string | string[]> = {};
  if (!qs) return result;
  for (const pair of qs.split('&')) {
    const eqIdx = pair.indexOf('=');
    const rawKey = eqIdx >= 0 ? pair.slice(0, eqIdx) : pair;
    const rawValue = eqIdx >= 0 ? pair.slice(eqIdx + 1) : '';
    if (!rawKey) continue;
    let key: string;
    let value: string;
    try {
      key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
      value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
    } catch {
      key = rawKey;
      value = rawValue;
    }
    if (Object.hasOwn(result, key)) {
      if (Array.isArray(result[key])) (result[key] as string[]).push(value);
      else result[key] = [result[key] as string, value];
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Build a query string from a plain object.
 * Array values are serialized with duplicate keys.
 * @param {Record<string, any>} params Key-value pairs to encode.
 * @returns {string} Query string without leading `?`.
 */
export function stringifyQueryString(params: Record<string, unknown>): string {
  if (!params || typeof params !== 'object') return '';
  const pairs: string[] = [];
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
 * Build a URL from a base and query params.
 * @param {string} base
 * @param {Record<string, unknown>} params
 * @returns {string}
 */
export function buildUrl(base: string, params: Record<string, unknown>): string {
  const qs = stringifyQueryString(params);
  if (!qs) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${qs}`;
}

/**
 * Resolve a relative URL against a base URL.
 * @param {string} base
 * @param {string} relative
 * @returns {string}
 */
export function resolveUrl(base: string, relative: string): string {
  try {
    return new URL(relative, base).toString();
  } catch {
    return relative;
  }
}
