// simplebeacon-ignore redos
/**
 * Size, duration, rate, and number formatting utilities.
 * @module format
 */

const sizes = require('./sizes.cjs');

/** Additional time constants (milliseconds). */
const FIVE_SECONDS_MS = 5000;
const TEN_SECONDS_MS = 10_000;
const FIFTEEN_SECONDS_MS = 15_000;
const ONE_HALF_HOUR_MS = 1_800_000;
const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Parse a human-readable size string into bytes.
 * Supported units: B, KB, MB, GB, TB (case-insensitive).
 * @param {string} sizeStr
 * @returns {number}
 * @throws {Error} If the format is invalid.
 */
function parseSize(sizeStr) {
  if (typeof sizeStr !== 'string') throw new Error('Invalid size format');
  const match = sizeStr.trim().match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
  if (!match) throw new Error('Invalid size format');
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  const multiplier = {
    B: 1,
    KB: sizes.BYTES_PER_KB,
    MB: sizes.BYTES_PER_MB,
    GB: sizes.BYTES_PER_GB,
    TB: sizes.BYTES_PER_TB
  }[unit];
  return value * multiplier;
}

/**
 * Format bytes into a human-readable string.
 * @param {number} bytes
 * @param {number} [precision=1] Decimal places.
 * @returns {string}
 */
function formatSize(bytes, precision = 1) {
  if (typeof bytes !== 'number' || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let idx = 0;
  while (size >= sizes.BYTES_PER_KB && idx < units.length - 1) {
    size /= sizes.BYTES_PER_KB;
    idx++;
  }
  return `${size.toFixed(precision)} ${units[idx]}`;
}

/**
 * Parse a duration string (e.g. "1h", "30m", "2d") into milliseconds.
 * @param {string} str
 * @returns {number}
 * @throws {Error} If the format is invalid.
 */
function parseDuration(str) {
  if (typeof str !== 'string') throw new Error('Invalid duration format');
  const match = str.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/i);
  if (!match) throw new Error('Invalid duration format');
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * multipliers[unit];
}

/**
 * Format milliseconds into a human-readable duration string.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (typeof ms !== 'number' || ms < 0) return '0ms';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60_000) % 60;
  const hours = Math.floor(ms / 3_600_000);
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && hours === 0) parts.push(`${seconds}s`);
  return parts.join(' ') || '0ms';
}

/**
 * Format a number with locale separators.
 * @param {number|null|undefined} n
 * @returns {string}
 */
function formatNumber(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString();
}

/**
 * Format a number as a percentage string.
 * @param {number|null|undefined} value
 * @param {number} [digits=1]
 * @returns {string}
 */
function formatPercent(value, digits = 1) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—%';
  const d = Number.isFinite(digits) ? Math.max(0, Math.min(20, Math.floor(digits))) : 1;
  const pct = num <= 1 ? num * 100 : num;
  return `${pct.toFixed(d)}%`;
}

/**
 * Parse a rate string (e.g. "100/min", "10/s") into {count, windowMs}.
 * @param {string} rateStr
 * @returns {{count:number, windowMs:number}}
 * @throws {Error} If the format is invalid.
 */
function parseRate(rateStr) {
  if (typeof rateStr !== 'string') throw new Error('Invalid rate format');
  const match = rateStr.trim().match(/^(\d+)\/(s|m|h|d)$/i);
  if (!match) throw new Error('Invalid rate format');
  const count = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const windowMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return { count, windowMs };
}

/**
 * Format a rate limit object back into a human-readable string.
 * @param {number} count
 * @param {number} windowMs
 * @returns {string}
 */
function formatRate(count, windowMs) {
  const c = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  if (c === 0) return '0/s';
  if (windowMs >= 86_400_000) return `${c}/d`;
  if (windowMs >= 3_600_000) return `${c}/h`;
  if (windowMs >= 60_000) return `${c}/m`;
  return `${c}/s`;
}

/**
 * Check whether a rate limit has been exceeded.
 * @param {number} count Max allowed requests in the window.
 * @param {number} windowMs Time window in milliseconds.
 * @param {number[]} timestamps Array of request timestamps (sorted ascending recommended).
 * @returns {{allowed:boolean, remaining:number, resetMs:number}}
 */
function checkRateLimit(count, windowMs, timestamps) {
  const limit = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  const window = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 1000;
  const now = Date.now();
  const cutoff = now - window;
  const recent = Array.isArray(timestamps)
    ? timestamps.filter((t) => Number.isFinite(t) && t > cutoff)
    : [];
  const allowed = recent.length < limit;
  const remaining = Math.max(0, limit - recent.length);
  const oldest = recent.length > 0 ? recent[0] : now;
  const resetMs = Math.max(0, (oldest + window) - now);
  return { allowed, remaining, resetMs };
}

/**
 * Convenience wrapper: return true if the rate limit has NOT been exceeded.
 * @param {number} count
 * @param {number} windowMs
 * @param {number[]} timestamps
 * @returns {boolean}
 */
function isWithinRateLimit(count, windowMs, timestamps) {
  return checkRateLimit(count, windowMs, timestamps).allowed;
}

/**
 * Parse a JSON body-size limit from env or fallback.
 * @param {string|number} [raw='10mb']
 * @returns {string}
 */
function safeJsonLimit(raw = '10mb') {
  if (typeof raw === 'string' && /^\d+(?:kb|mb|gb)?$/i.test(raw)) return raw;
  if (Number.isFinite(Number(raw)) && Number(raw) > 0) return String(raw);
  return '10mb';
}

module.exports = Object.freeze({
  FIVE_SECONDS_MS,
  TEN_SECONDS_MS,
  FIFTEEN_SECONDS_MS,
  ONE_HALF_HOUR_MS,
  ONE_MONTH_MS,
  parseSize,
  formatSize,
  parseDuration,
  formatDuration,
  formatNumber,
  formatPercent,
  parseRate,
  formatRate,
  checkRateLimit,
  isWithinRateLimit,
  safeJsonLimit
});
