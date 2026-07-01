/**
 * number utilities.
 */


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
 * Check whether a value is within a range (start inclusive, end exclusive).
 * @param {number} value
 * @param {number} start
 * @param {number} [end]
 * @returns {boolean}
 */
export function inRange(value, start, end) {
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  const s = Number(start);
  const e = end === undefined ? s : Number(end);
  const lo = Math.min(s, e);
  const hi = Math.max(s, e);
  return n >= lo && n < hi;
}


/**
 * Round a number to a given number of decimal places.
 * @param {number} value
 * @param {number} [decimals=0]
 * @returns {number}
 */
export function roundTo(value, decimals) {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  const d = Math.max(0, Math.min(20, Math.floor(Number(decimals) || 0)));
  const mult = Math.pow(10, d);
  return Math.round((n + Number.EPSILON) * mult) / mult;
}


/**
 * Safely parse an integer with a fallback on NaN.
 * @param {any} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function safeParseInt(value, fallback = 0) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}


/**
 * Safely parse a float with a fallback on NaN.
 * @param {any} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function safeParseFloat(value, fallback = 0) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
}

