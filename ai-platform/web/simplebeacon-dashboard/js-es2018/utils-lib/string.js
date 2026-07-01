/**
 * string utilities.
 */

/**
 * Escape special regex characters in a string so it can be used literally in a RegExp.
 * @param {string} str
 * @returns {string}
 */
export function escapeRegExp(str) {
    return String(str ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


/**
 * True when the value is null, undefined, or a whitespace-only string.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isBlank(value) {
    return value == null || (typeof value === 'string' && value.trim().length === 0);
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
 * Return the singular or plural form of a word based on count.
 * @param {number} count
 * @param {string} singular Form used when count === 1.
 * @param {string} [plural] Form used otherwise (defaults to singular + 's').
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

