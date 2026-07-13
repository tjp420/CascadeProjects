/**
 * @module url
 */

export function apiBaseUrl() {
    // Extension can pass a local API base when the dashboard is loaded from the static website.
    if (typeof window !== 'undefined' && window.location && window.location.search) {
        try {
            const params = new URLSearchParams(window.location.search);
            const override = params.get('sb_api_base');
            if (override) return override;
        }
        catch (_a) { /* ignore */ }
    }
    const env = typeof window !== 'undefined' && window.__SIMPLEBEACON_ENV__;
    return (env && env.API_BASE_URL) || '';
}

export function apiUrl(path) {
    const base = apiBaseUrl();
    const p = String(path || '');
    if (base && p.startsWith('/api/')) {
        const suffix = p.slice(4);
        return base.endsWith('/') ? base + suffix.slice(1) : base + suffix;
    }
    return p;
}

export function isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function getNonce() {
    const arr = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(arr);
    }
    else {
        for (let i = 0; i < arr.length; i++)
            arr[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

export function parseQueryString(queryString) {
    if (typeof queryString !== 'string')
        return {};
    const qs = queryString.startsWith('?') ? queryString.slice(1) : queryString;
    const result = {};
    if (!qs)
        return result;
    for (const pair of qs.split('&')) {
        const eqIdx = pair.indexOf('=');
        const rawKey = eqIdx >= 0 ? pair.slice(0, eqIdx) : pair;
        const rawValue = eqIdx >= 0 ? pair.slice(eqIdx + 1) : '';
        if (!rawKey)
            continue;
        let key, value;
        try {
            key = decodeURIComponent(rawKey.replace(/\+/g, ' '));
            value = decodeURIComponent(rawValue.replace(/\+/g, ' '));
        }
        catch (_a) {
            key = rawKey;
            value = rawValue;
        }
        if (Object.hasOwn(result, key)) {
            if (Array.isArray(result[key]))
                result[key].push(value);
            else
                result[key] = [result[key], value];
        }
        else {
            result[key] = value;
        }
    }
    return result;
}

export function stringifyQueryString(params) {
    if (!params || typeof params !== 'object')
        return '';
    const pairs = [];
    for (const [key, value] of Object.entries(params)) {
        if (value == null || value === '')
            continue;
        if (Array.isArray(value)) {
            for (const v of value) {
                if (v != null && v !== '')
                    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
            }
        }
        else {
            pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
        }
    }
    return pairs.join('&');
}

export function isValidUrl(str) {
    if (typeof str !== 'string' || !str)
        return false;
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    }
    catch (_a) {
        return false;
    }
}
