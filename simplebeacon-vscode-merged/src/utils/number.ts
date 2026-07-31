// simplebeacon-ignore memory-leak — pure number utility functions

/**
 * Clamp a number between a minimum and maximum value.
 * Returns `min` when `val` is not a finite number.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val: number, min: number, max: number): number {
  const num = Number(val);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return NaN;
  if (!Number.isFinite(num)) return min;
  return Math.min(Math.max(num, min), max);
}

/**
 * Format a byte count into a human-readable string (e.g. 1.5 MB).
 * @param {number | null | undefined} bytes Number of bytes.
 * @param {number} [fractionDigits=1] Decimal places.
 * @returns {string}
 */
export function formatBytes(bytes: number | null | undefined, fractionDigits = 1): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const digits = Number.isFinite(fractionDigits) ? Math.max(0, Math.min(20, Math.floor(fractionDigits || 0))) : 1;
  if (bytes < 1) return `${bytes.toFixed(digits)} B`;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const value = Number((bytes / k ** i).toFixed(digits));
  return `${value} ${units[i]}`;
}

/**
 * Format a number with locale separators.
 * @param {number | string | null | undefined} n
 * @returns {string}
 */
export function formatNumber(n: number | string | null | undefined): string {
  if (n == null) return '—';
  const numericCount = Number(n);
  if (!Number.isFinite(numericCount)) return '—';
  return numericCount.toLocaleString();
}

/**
 * Safely parse an integer with a fallback on NaN.
 * @param {unknown} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function safeParseInt(value: unknown, fallback = 0): number {
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Safely parse a float with a fallback on NaN.
 * @param {unknown} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function safeParseFloat(value: unknown, fallback = 0): number {
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Round a number to a given number of decimal places.
 * @param {number} value
 * @param {number} [decimals=0]
 * @returns {number}
 */
export function roundTo(value: number, decimals = 0): number {
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
export function toFixedNumber(value: number, decimals = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  const d = Math.max(0, Math.min(20, Math.floor(Number(decimals) || 0)));
  return parseFloat(n.toFixed(d));
}

/**
 * Check whether a value is a finite number (string or number).
 * @param {unknown} value
 * @returns {boolean}
 */
export function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string') return false;
  const n = Number(value.trim());
  return Number.isFinite(n) && !/^\s*$/.test(value);
}

/**
 * Return a random integer between min and max (inclusive).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function randomInt(min: number, max: number): number {
  const a = Math.ceil(Number(min));
  const b = Math.floor(Number(max));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

/**
 * Sum an array of numbers.
 * @param {number[]} arr
 * @returns {number}
 */
export function sum(arr: number[]): number {
  if (!Array.isArray(arr)) return 0;
  return arr.reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
}

/**
 * Calculate the arithmetic mean of an array of numbers.
 * @param {number[]} arr
 * @returns {number}
 */
export function mean(arr: number[]): number {
  if (!Array.isArray(arr) || arr.length === 0) return NaN;
  return sum(arr) / arr.length;
}

/**
 * Return the minimum value in an array of numbers.
 * @param {number[]} arr
 * @returns {number}
 */
export function min(arr: number[]): number {
  if (!Array.isArray(arr) || arr.length === 0) return NaN;
  return Math.min(...arr.filter((n) => Number.isFinite(n)));
}

/**
 * Return the maximum value in an array of numbers.
 * @param {number[]} arr
 * @returns {number}
 */
export function max(arr: number[]): number {
  if (!Array.isArray(arr) || arr.length === 0) return NaN;
  return Math.max(...arr.filter((n) => Number.isFinite(n)));
}

/**
 * Sum values extracted from an array of objects.
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => number} fn
 * @returns {number}
 */
export function sumBy<T>(arr: T[], fn: (item: T) => number): number {
  if (!Array.isArray(arr) || typeof fn !== 'function') return 0;
  return arr.reduce((acc, item) => {
    const val = fn(item);
    return acc + (Number.isFinite(val) ? val : 0);
  }, 0);
}

/**
 * Calculate the mean of values extracted from an array of objects.
 * @template T
 * @param {T[]} arr
 * @param {(item: T) => number} fn
 * @returns {number}
 */
export function meanBy<T>(arr: T[], fn: (item: T) => number): number {
  if (!Array.isArray(arr) || arr.length === 0) return NaN;
  return sumBy(arr, fn) / arr.length;
}
