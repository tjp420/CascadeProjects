/**
 * number utilities.
 */


/**
 * Parse a string as an integer, returning a fallback on failure.
 * @param {string|number} str
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function safeParseInt(str, fallback = 0) {
    if (typeof str === 'number') return Number.isFinite(str) ? Math.floor(str) : fallback;
    if (typeof str !== 'string') return fallback;
    const parsed = Number.parseInt(str, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}


/**
 * Parse a string as a float, returning a fallback on failure.
 * @param {string|number} str
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function safeParseFloat(str, fallback = 0) {
    if (typeof str === 'number') return Number.isFinite(str) ? str : fallback;
    if (typeof str !== 'string') return fallback;
    const parsed = Number.parseFloat(str);
    return Number.isFinite(parsed) ? parsed : fallback;
}


/**
 * Clamp a number between min and max.
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

