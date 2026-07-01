/**
 * url utilities.
 */


/**
 * Check whether a string is a valid absolute URL.
 * @param {string} str
 * @returns {boolean}
 */
export function isValidUrl(str) {
    if (typeof str !== 'string') return false;
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}


/**
 * Parse a query string into a plain object.
 * @param {string} queryString Query string (with or without leading `?`).
 * @returns {Record<string, string>} Parsed key-value pairs.
 */
export function parseQueryString(queryString) {
    if (typeof queryString !== 'string') return {};
    const qs = queryString.startsWith('?') ? queryString.slice(1) : queryString;
    const result = {};
    if (!qs) return result;
    for (const pair of qs.split('&')) {
        const [rawKey, rawValue] = pair.split('=');
        if (!rawKey) continue;
        const key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
        const value = rawValue !== undefined ? decodeURIComponent(rawValue.replace(/\+/g, ' ')) : '';
        result[key] = value;
    }
    return result;
}


/**
 * Build a query string from a plain object.
 * @param {Record<string, string|number|boolean|null|undefined>} params
 * @returns {string} Query string without leading `?`.
 */
export function stringifyQueryString(params) {
    if (!params || typeof params !== 'object') return '';
    const pairs = [];
    for (const [key, value] of Object.entries(params)) {
        if (value == null || value === '') continue;
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
    }
    return pairs.join('&');
}

