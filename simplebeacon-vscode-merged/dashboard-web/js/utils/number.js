/**
 * @module number
 */

/**
 * Format number.
 * @param {number|string|null|undefined} n
 * @returns {string}
 */
export function formatNumber(n) {
  if (n == null) return '—';
  const numericCount = Number(n);
  if (!Number.isFinite(numericCount)) return '—';
  return numericCount.toLocaleString();
}

export function formatPercent(value, fractionDigits = 1) {
  if (value == null || value === '') return '—';
  const str = String(value).trim();
  if (str.endsWith('%')) return str;
  const num = Number(str);
  if (!Number.isFinite(num)) return '—';
  return `${num.toFixed(_clampFractionDigits(fractionDigits, 1))}%`;
}

/**
 * Format bytes to human-readable string.
 * @param {number} bytes
 * @param {number} [decimals=2] Digits after the decimal point.
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const digits = _clampFractionDigits(decimals, 2);
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
  const months = Math.floor(days / 30.44);
  const remWeeks = Math.floor((days % 30.44) / 7);
  if (months < 12) return `${months}mo ${remWeeks}w`;
  const years = Math.floor(days / 365.25);
  const remMonths = Math.floor((days % 365.25) / 30.44);
  return `${years}y ${remMonths}mo`;
}

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

export function uid() { return randomId(8); }

export function safeParseInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function safeParseFloat(value, fallback = 0) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

export function random(min, max, floating) {
  const lo = min === undefined ? 0 : Number(min) || 0;
  const hi = max === undefined ? 1 : Number(max) || 1;
  const r = Math.random() * (hi - lo) + lo;
  return floating ? r : Math.floor(r);
}

export function maxBy(arr, iteratee) {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  if (typeof iteratee !== 'function') return arr[0];
  let maxItem = arr[0];
  let maxVal = iteratee(maxItem);
  for (let i = 1; i < arr.length; i++) {
    const val = iteratee(arr[i]);
    if (val > maxVal) { maxVal = val; maxItem = arr[i]; }
  }
  return maxItem;
}

export function minBy(arr, iteratee) {
  if (!Array.isArray(arr) || arr.length === 0) return undefined;
  if (typeof iteratee !== 'function') return arr[0];
  let minItem = arr[0];
  let minVal = iteratee(minItem);
  for (let i = 1; i < arr.length; i++) {
    const val = iteratee(arr[i]);
    if (val < minVal) { minVal = val; minItem = arr[i]; }
  }
  return minItem;
}

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

export function mean(arr, keyFn) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  return sum(arr, keyFn) / arr.length;
}
