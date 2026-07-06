/**
 * @module string
 */

/**
 * Escape HTML special characters for safe injection into DOM or attributes.
 * @param {string|null|undefined} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;');
}

/**
 * Normalize backslashes to forward slashes.
 * @param {string} path
 * @param {Object} [opts]
 * @param {boolean} [opts.stripLeadingDot=false] Strip leading `./`.
 * @param {boolean} [opts.lowercase=false] Convert to lowercase.
 * @returns {string}
 */
export function normalizeSlashes(path, opts = {}) {
  let normalized = String(path || '').replace(/\\/g, '/');
  if (opts.stripLeadingDot) normalized = normalized.replace(/^\.\//, '');
  if (opts.lowercase) normalized = normalized.toLowerCase();
  return normalized;
}

/**
 * Escape special regex characters in a string so it can be used literally in a RegExp.
 * @param {string} str
 * @returns {string}
 */
export function escapeRegExp(str) {
  return String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Truncate a string to a maximum length, adding an ellipsis if trimmed.
 * @param {string} str
 * @param {number} [maxLen=80]
 * @param {string} [suffix='…']
 * @returns {string}
 */
export function truncate(str, maxLen = 80, suffix = '…') {
  const s = String(str ?? '');
  const limit = Number.isFinite(maxLen) && maxLen > 0 ? Math.floor(maxLen) : 80;
  if (s.length <= limit) return s;
  const endLen = Math.max(0, limit - String(suffix ?? '…').length);
  return s.slice(0, endLen) + String(suffix ?? '…');
}

/**
 * Capitalize the first letter of a string.
 * @param {string} str
 * @returns {string}
 */
export function capitalize(str) {
  const s = String(str ?? '');
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1);
}

/**
 * Convert a string to kebab-case.
 * @param {string} str
 * @returns {string}
 */
export function kebabCase(str) {
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
export function camelCase(str) {
  return String(str ?? '')
    .replace(/[-_\s]+(.)?/g, (_, ch) => (ch ? ch.toUpperCase() : ''))
    .replace(/^[A-Z]/, ch => ch.toLowerCase());
}

/**
 * Convert a string to snake_case.
 * @param {string} str
 * @returns {string}
 */
export function snakeCase(str) {
  return String(str ?? '')
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * Remove HTML tags from a string.
 * @param {string} str
 * @returns {string}
 */
export function stripHtml(str) {
  return String(str ?? '').replace(/<[^>]*>/g, '');
}

/**
 * Pad the start of a string to a given length.
 * @param {string|number} str
 * @param {number} len
 * @param {string} [char=' ']
 * @returns {string}
 */
export function padStart(str, len, char = ' ') {
  const s = String(str);
  const targetLen = Math.max(0, Math.floor(Number(len) || 0));
  const padChar = String(char || ' ').slice(0, 1);
  if (s.length >= targetLen) return s;
  const pad = padChar.repeat(targetLen - s.length);
  return pad + s;
}

/**
 * Pad the end of a string to a given length.
 * @param {string|number} str
 * @param {number} len
 * @param {string} [char=' ']
 * @returns {string}
 */
export function padEnd(str, len, char = ' ') {
  const s = String(str);
  const targetLen = Math.max(0, Math.floor(Number(len) || 0));
  const padChar = String(char || ' ').slice(0, 1);
  if (s.length >= targetLen) return s;
  const pad = padChar.repeat(targetLen - s.length);
  return s + pad;
}

export function hash(str) {
  const s = String(str ?? '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export function pluralize(count, singular, plural) {
  const n = Number(count);
  if (!Number.isFinite(n)) return `${count} ${singular}`;
  const word = n === 1 ? singular : (plural ?? `${singular}s`);
  return `${n} ${word}`;
}
