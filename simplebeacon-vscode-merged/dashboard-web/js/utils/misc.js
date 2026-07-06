/**
 * @module misc
 */

export function assertNever(value, message = 'Unexpected value') {
  const display = typeof value === 'string' ? value : (() => { try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  } })();
  throw new Error(`${message}: ${display}`);
}

export function parseJsonSafe(text, fallback = null) {
  if (text == null) return fallback;
  try {
    return JSON.parse(String(text));
  } catch {
    return fallback;
  }
}

export async function parseResponseJson(res, fallback = null) {
  if (!res || !res.ok) return fallback ?? {};
  const contentType = String(res.headers?.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) return fallback ?? {};
  let text;
  try { text = await res.text(); } catch { return fallback ?? {}; }
  if (!text) return fallback ?? {};
  try {
    return JSON.parse(text);
  } catch {
    return fallback ?? {};
  }
}

export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function prefersDarkMode() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function isEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  const ta = typeof a;
  const tb = typeof b;
  if (ta !== tb) return false;
  if (ta !== 'object') return false;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return a.source === b.source && a.flags === b.flags;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (!Object.hasOwn(b, k)) return false;
    if (!isEqual(a[k], b[k])) return false;
  }
  return true;
}

export function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

export function findIndex(arr, predicate) {
  if (!Array.isArray(arr) || typeof predicate !== 'function') return -1;
  for (let i = 0; i < arr.length; i++) {
    if (predicate(arr[i])) return i;
  }
  return -1;
}
