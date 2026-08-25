/**
 * Split a string into an array of words.
 * @param {string} str
 * @returns {string[]}
 */
export function words(str) {
  return String(str ?? '').match(/\w+/g) || [];
}

/**
 * Repeat a string N times.
 * @param {string} str
 * @param {number} count
 * @returns {string}
 */
export function repeat(str, count) {
  const s = String(str ?? '');
  const n = Math.max(0, Math.floor(Number(count) || 0));
  return s.repeat(n);
}

/**
 * Convert a string to Title Case.
 * @param {string} str
 * @returns {string}
 */
export function titleCase(str) {
  return String(str ?? '')
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, (ch) => ch.toUpperCase());
}

/**
 * Convert a string to a URL-safe slug.
 * @param {string} str
 * @returns {string}
 */
export function slugify(str) {
  return String(str ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
