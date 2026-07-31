/**
 * True when the value is null, undefined, or a whitespace-only string.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isBlank(value) {
  return value == null || (typeof value === 'string' && value.trim().length === 0);
}
/**
 * Validate that a string looks like an email address.
 * @param {string} str
 * @returns {boolean}
 */
export function isEmail(str) {
  if (typeof str !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
}
/**
 * Check whether a value is a finite number (string or number).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNumeric(value) {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string') return false;
  const n = Number(value.trim());
  return Number.isFinite(n) && !/^\s*$/.test(value);
}
/**
 * Check whether a value is a safe integer.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isInteger(value) {
  if (typeof value === 'number') return Number.isInteger(value);
  if (typeof value !== 'string') return false;
  const n = Number(value.trim());
  return Number.isSafeInteger(n);
}
/**
 * Check if a string looks like a URL.
 * @param {string} str
 * @returns {boolean}
 */
export function isUrl(str) {
  if (typeof str !== 'string') return false;
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch (_a) {
    return false;
  }
}
/**
 * Validate a hex color string (#rrggbb or #rgb).
 * @param {string} str
 * @returns {boolean}
 */
export function isHexColor(str) {
  return typeof str === 'string' && /^#([0-9a-fA-F]{3}){1,2}$/.test(str.trim());
}
/**
 * True for null, undefined, '', empty array, or object with no keys.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEmpty(value) {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}
/**
 * No-op function. Useful as a default for optional callbacks.
 * @returns {void}
 */
export function noop() {}
/**
 * Type guard: returns true if the value is neither null nor undefined.
 * @template T
 * @param {T | null | undefined} value
 * @returns {value is T}
 */
export function isDefined(value) {
  return value !== null && value !== undefined;
}
/**
 * Exhaustiveness checker. Throws at runtime if an unexpected value is encountered.
 * @param {never} value
 * @param {string} [message]
 * @returns {never}
 */
export function assertNever(value, message = 'Unexpected value') {
  const display =
    typeof value === 'string'
      ? value
      : (() => {
          try {
            return JSON.stringify(value);
          } catch (_a) {
            return String(value);
          }
        })();
  throw new Error(`${message}: ${display}`);
}
/**
 * Safely parse a JSON string, returning a fallback on failure.
 * @template T
 * @param {string} text
 * @param {T} fallback
 * @returns {T}
 */
export function parseJsonSafe(text, fallback = null) {
  if (text == null) return fallback;
  try {
    return JSON.parse(String(text));
  } catch (_a) {
    return fallback;
  }
}
/**
 * Safely parse JSON from a fetch Response, returning a fallback on failure.
 * @param {Response} res
 * @param {any} fallback
 * @returns {Promise<any>}
 */
export async function parseResponseJson(res, fallback = null) {
  var _a;
  const contentType = String(
    ((_a = res.headers) === null || _a === void 0 ? void 0 : _a.get('content-type')) || ''
  ).toLowerCase();
  if (!contentType.includes('application/json')) return fallback !== null && fallback !== void 0 ? fallback : {};
  const text = await res.text();
  if (!text) return fallback !== null && fallback !== void 0 ? fallback : {};
  try {
    return JSON.parse(text);
  } catch (_b) {
    return fallback !== null && fallback !== void 0 ? fallback : {};
  }
}
/**
 * Check whether the browser appears to be online.
 * @returns {boolean}
 */
export function isOnline() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
/**
 * Check whether the code is running inside a VS Code webview.
 * @returns {boolean}
 */
export function isVSCodeWebview() {
  return typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function';
}
/**
 * Check whether the code is running outside a VS Code webview (standalone browser).
 * @returns {boolean}
 */
export function isStandalone() {
  return !isVSCodeWebview();
}
/**
 * Safely acquire the VS Code API object, or null if unavailable.
 * @returns {any|null}
 */
export function getVSCodeApi() {
  if (typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function') {
    try {
      return window.acquireVsCodeApi();
    } catch (_a) {
      return null;
    }
  }
  return null;
}
/** @returns {string} Hex-encoded 16-byte random string.
 */
export function getNonce() {
  const arr = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}
/** Type guard: value is null.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNull(value) {
  return value === null;
}
/** Type guard: value is undefined.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isUndefined(value) {
  return value === undefined;
}
/** Type guard: value is null or undefined.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNil(value) {
  return value == null;
}
/** Type guard: value is a symbol.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSymbol(value) {
  return typeof value === 'symbol';
}
/** Type guard: value is a Map.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isMap(value) {
  return value instanceof Map;
}
/** Type guard: value is a Set.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSet(value) {
  return value instanceof Set;
}
