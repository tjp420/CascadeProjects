/**
 * @module string
 * String utility helpers for the dashboard.
 */

/**
 * Escape a string for safe HTML text or attribute injection.
 * Handles `null`/`undefined` by returning an empty string.
 * @param {string | null | undefined} str
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
 * Normalize backslashes to forward slashes in a path.
 * @param {string | null | undefined} path
 * @param {{ stripLeadingDot?: boolean; lowercase?: boolean }} [opts]
 * @returns {string}
 */
export function normalizeSlashes(path, opts = {}) {
    let normalized = String(path ?? '').replace(/\\/g, '/');
    if (opts.stripLeadingDot) normalized = normalized.replace(/^\.\//, '');
    if (opts.lowercase) normalized = normalized.toLowerCase();
    return normalized;
}

/**
 * Escape special regex characters so a string can be used literally in a RegExp.
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function escapeRegExp(str) {
    return String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Truncate a string to a maximum length, adding a suffix if trimmed.
 * @param {string | null | undefined} str
 * @param {number} [maxLen=80]
 * @param {string | null | undefined} [suffix='…']
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
 * Capitalize the first character of a string.
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function capitalize(str) {
    const s = String(str ?? '');
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Compute a simple non-cryptographic hash (DJB2) for a string.
 * @param {string | null | undefined} str
 * @returns {number}
 */
export function hash(str) {
    const s = String(str ?? '');
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    }
    return h >>> 0;
}

/**
 * Return the singular or plural form of a word based on a count.
 * @param {number | string} count
 * @param {string} singular
 * @param {string | null | undefined} [plural]
 * @returns {string}
 */
export function pluralize(count, singular, plural) {
    const n = Number(count);
    if (!Number.isFinite(n)) return `${count} ${singular}`;
    const word = n === 1 ? singular : (plural ?? `${singular}s`);
    return `${n} ${word}`;
}

/**
 * Convert a string to kebab-case.
 * @param {string | null | undefined} str
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
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function camelCase(str) {
    return String(str ?? '')
        .replace(/[-_\s]+(.)?/g, (_, ch) => (ch ? ch.toUpperCase() : ''))
        .replace(/^[A-Z]/, ch => ch.toLowerCase());
}

/**
 * Convert a string to snake_case.
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function snakeCase(str) {
    return String(str ?? '')
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
}

/**
 * Remove HTML tags from a string, returning plain text.
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function stripHtml(str) {
    if (str == null || typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '');
}

/**
 * Pad the start of a string to a given length.
 * @param {string | number | null | undefined} str
 * @param {number} len
 * @param {string | null | undefined} [char=' ']
 * @returns {string}
 */
export function padStart(str, len, char = ' ') {
    const s = String(str ?? '');
    const targetLen = Math.max(0, Math.floor(Number(len) || 0));
    const padChar = String(char ?? ' ').slice(0, 1);
    if (s.length >= targetLen) return s;
    const pad = padChar.repeat(targetLen - s.length);
    return pad + s;
}

/**
 * Pad the end of a string to a given length.
 * @param {string | number | null | undefined} str
 * @param {number} len
 * @param {string | null | undefined} [char=' ']
 * @returns {string}
 */
export function padEnd(str, len, char = ' ') {
    const s = String(str ?? '');
    const targetLen = Math.max(0, Math.floor(Number(len) || 0));
    const padChar = String(char ?? ' ').slice(0, 1);
    if (s.length >= targetLen) return s;
    const pad = padChar.repeat(targetLen - s.length);
    return s + pad;
}

/**
 * Trim whitespace from both ends of a string.
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function trim(str) {
    return String(str ?? '').trim();
}

/**
 * Convert a string to lowercase.
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function toLower(str) {
    return String(str ?? '').toLowerCase();
}

/**
 * Convert a string to uppercase.
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function toUpper(str) {
    return String(str ?? '').toUpperCase();
}

/**
 * Check if a string starts with the given prefix.
 * @param {string} prefix
 * @param {string | null | undefined} str
 * @returns {boolean}
 */
export function startsWith(prefix, str) {
    return String(str ?? '').startsWith(prefix);
}

/**
 * Check if a string ends with the given suffix.
 * @param {string} suffix
 * @param {string | null | undefined} str
 * @returns {boolean}
 */
export function endsWith(suffix, str) {
    return String(str ?? '').endsWith(suffix);
}

/**
 * Check if a string contains the given substring.
 * @param {string} substr
 * @param {string | null | undefined} str
 * @returns {boolean}
 */
export function includes(substr, str) {
    return String(str ?? '').includes(substr);
}

/**
 * Split a string by a separator.
 * @param {string | RegExp} sep
 * @param {string | null | undefined} str
 * @returns {string[]}
 */
export function split(sep, str) {
    return String(str ?? '').split(sep);
}

/**
 * Join an array-like or iterable into a string with a separator.
 * @param {string} sep
 * @param {ArrayLike<any> | null | undefined} list
 * @returns {string}
 */
export function join(sep, list) {
    if (list == null || typeof list.length !== 'number') return '';
    return Array.prototype.join.call(list, sep);
}

/**
 * Match a string against a regular expression.
 * @param {RegExp} regex
 * @param {string | null | undefined} str
 * @returns {Array<string> | null}
 */
export function match(regex, str) {
    return String(str ?? '').match(regex);
}

/**
 * Replace matches in a string with a replacement value or function.
 * @param {string | RegExp} pattern
 * @param {string | Function} replacement
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function replace(pattern, replacement, str) {
    return String(str ?? '').replace(pattern, replacement);
}

/**
 * True when the value is `null`, `undefined`, or a whitespace-only string.
 * @param {any} value
 * @returns {boolean}
 */
export function isBlank(value) {
    return value == null || (typeof value === 'string' && value.trim().length === 0);
}

/**
 * Split a string into an array of words.
 * @param {string | null | undefined} str
 * @returns {string[]}
 */
export function words(str) {
    return String(str ?? '').match(/\w+/g) || [];
}

/**
 * Count words in a string.
 * @param {string | null | undefined} str
 * @returns {number}
 */
export function wordCount(str) {
    const matches = String(str ?? '').match(/\w+/g);
    return matches ? matches.length : 0;
}

/**
 * Repeat a string N times.
 * @param {string | null | undefined} str
 * @param {number} count
 * @returns {string}
 */
export function repeat(str, count) {
    const s = String(str ?? '');
    const n = Math.max(0, Math.floor(Number(count) || 0));
    return s.repeat(n);
}

/**
 * Convert a string to Title Case (capitalize first letter of each word).
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function titleCase(str) {
    const s = String(str ?? '');
    return s.toLowerCase().replace(/\b\w/g, ch => ch.toUpperCase());
}

/**
 * Convert a string to a URL-safe slug.
 * @param {string | null | undefined} str
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
 * Reverse a string.
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function reverse(str) {
    return String(str ?? '').split('').reverse().join('');
}

/**
 * Split a string into lines (handles `\n`, `\r\n`, and `\r`).
 * @param {string | null | undefined} str
 * @returns {string[]}
 */
export function splitLines(str) {
    const s = String(str ?? '');
    if (!s) return [];
    return s.split(/\r?\n|\r/);
}

/**
 * Strip ANSI escape codes from a string.
 * @param {string | null | undefined} str
 * @returns {string}
 */
export function stripAnsi(str) {
    return String(str ?? '').replace(/\u001B\[[0-9;]*m/g, '');
}
