/**
 * Format a number with locale separators.
 * @param {number|string|null|undefined} n
 * @returns {string}
 */
export function formatNumber(n) {
  if (n == null) return '—';
  const numericCount = Number(n);
  if (!Number.isFinite(numericCount)) return '—';
  return numericCount.toLocaleString();
}

/**
 * Format a value as a percentage string.
 * @param {number|string|null|undefined} value
 * @param {number} [fractionDigits=1]
 * @returns {string}
 */
export function formatPercent(value, fractionDigits = 1) {
  if (value == null || value === '') return '—';
  const str = String(value).trim();
  if (str.endsWith('%')) return str;
  const num = Number(str);
  if (!Number.isFinite(num)) return '—';
  const digits = Number.isFinite(fractionDigits)
    ? Math.max(0, Math.min(20, Math.floor(Number(fractionDigits) || 0)))
    : 1;
  return `${num.toFixed(digits)}%`;
}

/**
 * Format bytes to a human-readable string.
 * @param {number} bytes
 * @param {number} [decimals=2] Digits after the decimal point.
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const digits = Number.isFinite(decimals) ? Math.max(0, Math.min(20, Math.floor(Number(decimals) || 0))) : 2;
  if (bytes < 1) return `${bytes.toFixed(digits)} B`;
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / k ** i).toFixed(digits)} ${sizes[i]}`;
}

/**
 * Clamp a number between a minimum and maximum value.
 * @param {number|string} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  const num = Number(val);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return NaN;
  return Number.isFinite(num) ? Math.min(Math.max(num, min), max) : min;
}

/**
 * Round a number to a given number of decimal places.
 * @param {number} value
 * @param {number} [decimals=0]
 * @returns {number}
 */
export function roundTo(value, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  const d = Math.max(0, Math.min(20, Math.floor(Number(decimals) || 0)));
  const mult = Math.pow(10, d);
  return Math.round((n + Number.EPSILON) * mult) / mult;
}

/**
 * Like `Number.prototype.toFixed` but returns a number instead of a string.
 * @param {number} value
 * @param {number} [decimals=0]
 * @returns {number}
 */
export function toFixedNumber(value, decimals = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  const d = Math.max(0, Math.min(20, Math.floor(Number(decimals) || 0)));
  return parseFloat(n.toFixed(d));
}

/**
 * Format a millisecond duration into a human-readable string.
 * @param {number} ms — duration in milliseconds
 * @returns {string}
 */
export function formatDuration(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${remMinutes}m`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (days < 7) return `${days}d ${remHours}h`;
  const weeks = Math.floor(days / 7);
  const remDays = days % 7;
  if (weeks < 4) return `${weeks}w ${remDays}d`;
  const months = Math.floor(days / 30);
  const remDaysAfterMonths = days % 30;
  if (months < 12) return `${months}mo ${remDaysAfterMonths}d`;
  const years = Math.floor(days / 365);
  const remMonths = Math.floor((days % 365) / 30);
  return `${years}y ${remMonths}mo`;
}

/**
 * Sum numeric values in an array, or extract a key from objects.
 * @param {number[]|Object[]} arr
 * @param {(item:any)=>number} [keyFn]
 * @returns {number}
 */
export function sum(arr, keyFn) {
  if (!Array.isArray(arr)) return 0;
  let total = 0;
  for (const item of arr) {
    const val = typeof keyFn === 'function' ? keyFn(item) : item;
    const n = Number(val);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

/**
 * Calculate the arithmetic mean of numeric values.
 * @param {number[]|Object[]} arr
 * @param {(item:any)=>number} [keyFn]
 * @returns {number}
 */
export function mean(arr, keyFn) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  return sum(arr, keyFn) / arr.length;
}

/**
 * Return the item with the maximum key value.
 * @template T
 * @param {T[]} arr
 * @param {(item:T)=>number} keyFn
 * @returns {T | undefined}
 */
export function maxBy(arr, keyFn) {
  if (!Array.isArray(arr) || arr.length === 0 || typeof keyFn !== 'function') return undefined;
  let maxItem = arr[0];
  let maxVal = keyFn(maxItem);
  for (let i = 1; i < arr.length; i++) {
    const val = keyFn(arr[i]);
    if (val > maxVal) {
      maxVal = val;
      maxItem = arr[i];
    }
  }
  return maxItem;
}

/**
 * Return the item with the minimum key value.
 * @template T
 * @param {T[]} arr
 * @param {(item:T)=>number} keyFn
 * @returns {T | undefined}
 */
export function minBy(arr, keyFn) {
  if (!Array.isArray(arr) || arr.length === 0 || typeof keyFn !== 'function') return undefined;
  let minItem = arr[0];
  let minVal = keyFn(minItem);
  for (let i = 1; i < arr.length; i++) {
    const val = keyFn(arr[i]);
    if (val < minVal) {
      minVal = val;
      minItem = arr[i];
    }
  }
  return minItem;
}

/**
 * Safely parse an integer with a fallback on NaN.
 * @param {unknown} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function safeParseInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Safely parse a float with a fallback on NaN.
 * @param {unknown} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function safeParseFloat(value, fallback = 0) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Return a random number between `min` and `max` (inclusive).
 * If `floating` is true, returns a float.
 * @param {number} [min=0]
 * @param {number} [max=1]
 * @param {boolean} [floating=false]
 * @returns {number}
 */
export function random(min, max, floating) {
  const lo = min === undefined ? 0 : Number(min) || 0;
  const hi = max === undefined ? 1 : Number(max) || 1;
  const r = Math.random() * (hi - lo) + lo;
  return floating ? r : Math.floor(r);
}

/**
 * Generate a random alphanumeric ID.
 * @param {number} [length=8] Length of the ID.
 * @returns {string}
 */
export function randomId(length = 8) {
  const len = Math.max(1, Math.floor(Number(length) || 8));
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const max = chars.length;
  let id = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    for (let i = 0; i < len; i++) id += chars[arr[i] % max];
  } else {
    for (let i = 0; i < len; i++) id += chars[Math.floor(Math.random() * max)];
  }
  return id;
}

/**
 * Alias for {@link randomId}.
 * @returns {string}
 */
export function uid() {
  return randomId(8);
}
