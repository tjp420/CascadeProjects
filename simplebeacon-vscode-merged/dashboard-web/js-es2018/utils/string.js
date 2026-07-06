/**
 * @module string
 */

export function escapeHtml(str) {
    if (str == null)
        return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/`/g, '&#x60;')
        .replace(/=/g, '&#x3D;');
}

export function normalizeSlashes(path, opts = {}) {
    let normalized = String(path || '').replace(/\\/g, '/');
    if (opts.stripLeadingDot)
        normalized = normalized.replace(/^\.\//, '');
    if (opts.lowercase)
        normalized = normalized.toLowerCase();
    return normalized;
}

export function escapeRegExp(str) {
    return String(str !== null && str !== void 0 ? str : '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function truncate(str, maxLen = 80, suffix = '…') {
    const s = String(str !== null && str !== void 0 ? str : '');
    const limit = Number.isFinite(maxLen) && maxLen > 0 ? Math.floor(maxLen) : 80;
    if (s.length <= limit)
        return s;
    const endLen = Math.max(0, limit - String(suffix !== null && suffix !== void 0 ? suffix : '…').length);
    return s.slice(0, endLen) + String(suffix !== null && suffix !== void 0 ? suffix : '…');
}

export function capitalize(str) {
    const s = String(str !== null && str !== void 0 ? str : '');
    if (!s)
        return s;
    return s[0].toUpperCase() + s.slice(1);
}

export function hash(str) {
    const s = String(str !== null && str !== void 0 ? str : '');
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    }
    return h >>> 0;
}

export function pluralize(count, singular, plural) {
    const n = Number(count);
    if (!Number.isFinite(n))
        return `${count} ${singular}`;
    const word = n === 1 ? singular : (plural !== null && plural !== void 0 ? plural : `${singular}s`);
    return `${n} ${word}`;
}

export function kebabCase(str) {
    return String(str !== null && str !== void 0 ? str : '')
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
}

export function camelCase(str) {
    return String(str !== null && str !== void 0 ? str : '')
        .replace(/[-_\s]+(.)?/g, (_, ch) => (ch ? ch.toUpperCase() : ''))
        .replace(/^[A-Z]/, ch => ch.toLowerCase());
}

export function snakeCase(str) {
    return String(str !== null && str !== void 0 ? str : '')
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
}

export function stripHtml(str) {
    return String(str !== null && str !== void 0 ? str : '').replace(/<[^>]*>/g, '');
}

export function padStart(str, len, char = ' ') {
    const s = String(str);
    const targetLen = Math.max(0, Math.floor(Number(len) || 0));
    const padChar = String(char || ' ').slice(0, 1);
    if (s.length >= targetLen)
        return s;
    const pad = padChar.repeat(targetLen - s.length);
    return pad + s;
}

export function padEnd(str, len, char = ' ') {
    const s = String(str);
    const targetLen = Math.max(0, Math.floor(Number(len) || 0));
    const padChar = String(char || ' ').slice(0, 1);
    if (s.length >= targetLen)
        return s;
    const pad = padChar.repeat(targetLen - s.length);
    return s + pad;
}
