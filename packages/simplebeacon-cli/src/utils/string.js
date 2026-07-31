/**
 * String utility functions.
 */

/**
 * Convert a string to kebab-case.
 * @param {string} str
 * @returns {string}
 */
function kebabCase(str) {
  return String(str ?? '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert a string to camelCase.
 * @param {string} str
 * @returns {string}
 */
function camelCase(str) {
  return String(str ?? '')
    .replace(/[-_\s]+(.)?/g, (_, ch) => (ch ? ch.toUpperCase() : ''))
    .replace(/^[A-Z]/, (ch) => ch.toLowerCase());
}

/**
 * Convert a string to snake_case.
 * @param {string} str
 * @returns {string}
 */
function snakeCase(str) {
  return String(str ?? '')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * Pad the start of a string to a target length.
 * @param {string} str
 * @param {number} len
 * @param {string} [char=' ']
 * @returns {string}
 */
function padStart(str, len, char = ' ') {
  const s = String(str);
  const targetLen = Math.max(0, Math.floor(Number(len) || 0));
  const padChar = String(char || ' ').slice(0, 1);
  if (s.length >= targetLen) return s;
  return padChar.repeat(targetLen - s.length) + s;
}

/**
 * Pad the end of a string to a target length.
 * @param {string} str
 * @param {number} len
 * @param {string} [char=' ']
 * @returns {string}
 */
function padEnd(str, len, char = ' ') {
  const s = String(str);
  const targetLen = Math.max(0, Math.floor(Number(len) || 0));
  const padChar = String(char || ' ').slice(0, 1);
  if (s.length >= targetLen) return s;
  return s + padChar.repeat(targetLen - s.length);
}

/**
 * Escape special regex characters in a string.
 * @param {string} str
 * @returns {string}
 */
function escapeRegExp(str) {
  return String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format milliseconds into a human-readable duration string.
 * @param {number} ms
 * @returns {string}
 */
function formatDuration(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m`;
}

/**
 * Format a number with locale separators.
 * @param {number} n
 * @returns {string}
 */
function formatNumber(n) {
  if (n == null) return '—';
  const numeric = Number(n);
  if (!Number.isFinite(numeric)) return '—';
  return numeric.toLocaleString();
}

/**
 * Check if a value is null, undefined, or a blank string.
 * @param {any} value
 * @returns {boolean}
 */
function isBlank(value) {
  return value == null || (typeof value === 'string' && value.trim().length === 0);
}

/**
 * Capitalize the first character of a string.
 * @param {any} value
 * @returns {string}
 */
function capitalize(value) {
  const s = String(value ?? '');
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Pluralize a word based on count.
 * @param {number} count
 * @param {string} singular
 * @param {string} [plural]
 * @returns {string}
 */
function pluralize(count, singular, plural) {
  const n = Number(count);
  if (!Number.isFinite(n)) return `${count} ${singular}`;
  const word = n === 1 ? singular : (plural ?? `${singular}s`);
  return `${n} ${word}`;
}

/**
 * Truncate a string to a max length with a suffix.
 * @param {any} str
 * @param {number} [maxLen=80]
 * @param {string} [suffix='…']
 * @returns {string}
 */
function truncate(str, maxLen = 80, suffix = '…') {
  const s = String(str ?? '');
  const limit = Number.isFinite(maxLen) && maxLen > 0 ? Math.floor(maxLen) : 80;
  if (s.length <= limit) return s;
  const endLen = Math.max(0, limit - String(suffix ?? '…').length);
  return s.slice(0, endLen) + String(suffix ?? '…');
}

module.exports = {
  kebabCase,
  camelCase,
  snakeCase,
  padStart,
  padEnd,
  escapeRegExp,
  formatDuration,
  formatNumber,
  isBlank,
  capitalize,
  pluralize,
  truncate,
};
