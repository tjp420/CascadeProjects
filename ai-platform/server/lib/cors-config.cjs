/**
 * Environment-driven CORS — no wide-open defaults in production.
 */

/**
 * Parse origin list.
 * @param {any} raw
 * @returns {string[]}
 */
function parseOriginList(raw) {
    return String(raw || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

const PAGES_PREVIEW_ORIGIN_REGEX = /^https:\/\/(?:[a-z0-9-]+\.)?simplebeacon\.pages\.dev$/i;
const RENDER_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+\.onrender\.com$/i;
const NETLIFY_ORIGIN_REGEX = /^https:\/\/[a-z0-9-]+\.netlify\.app$/i;

/**
 * Normalize an origin-like value for comparison.
 * @param {unknown} value
 * @returns {string}
 */
function normalizeOrigin(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}

/**
 * Build a matcher from an allowlist entry.
 * Supports exact origins, wildcard subdomains (https://*.example.com), and localhost:*.
 * @param {string} entry
 * @returns {(origin: string) => boolean}
 */
function createOriginMatcher(entry) {
    const normalized = normalizeOrigin(entry);
    if (!normalized) return () => false;

    if (/^https?:\/\/(?:localhost|127\.0\.0\.1):\*$/i.test(normalized)) {
        const prefix = normalized.slice(0, -1);
        return (origin) => normalizeOrigin(origin).toLowerCase().startsWith(prefix.toLowerCase());
    }

    if (/^https?:\/\/\*\./i.test(normalized)) {
        const suffix = normalized.replace(/^https?:\/\/\*\./i, '').toLowerCase();
        const isHttps = normalized.toLowerCase().startsWith('https://');
        return (origin) => {
            const candidate = normalizeOrigin(origin).toLowerCase();
            if (!candidate) return false;
            if (isHttps && !candidate.startsWith('https://')) return false;
            if (!isHttps && !candidate.startsWith('http://')) return false;
            const host = candidate.replace(/^https?:\/\//, '');
            return host.endsWith(`.${suffix}`);
        };
    }

    const exact = normalized.toLowerCase();
    return (origin) => normalizeOrigin(origin).toLowerCase() === exact;
}

/**
 * Determine whether a request origin is allowed.
 * @param {string|undefined|null} origin
 * @param {{isProduction?: boolean, origins?: string[]}} [options]
 * @returns {boolean}
 */
function isAllowedCorsOrigin(origin, options = {}) {
    const isProduction = options.isProduction === true;
    const requestedOrigin = normalizeOrigin(origin);
    const origins = Array.isArray(options.origins) ? options.origins.map(normalizeOrigin).filter(Boolean) : [];

    if (!isProduction) {
        return true;
    }
    if (!requestedOrigin) {
        return true;
    }
    if (origins.includes('*')) {
        // Reject explicit wildcard in production to avoid accidental wide-open CORS.
        return false;
    }
    if (origins.some((candidate) => createOriginMatcher(candidate)(requestedOrigin))) {
        return true;
    }

    return PAGES_PREVIEW_ORIGIN_REGEX.test(requestedOrigin)
        || RENDER_ORIGIN_REGEX.test(requestedOrigin)
        || NETLIFY_ORIGIN_REGEX.test(requestedOrigin);
}

/**
 * Resolve cors options.
 * @param {Array} overrides
 * @returns {any}
 */
function resolveCorsOptions(overrides = {}) {
    const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    const raw = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || overrides.devFallbackOrigin || overrides.defaultOrigin || '';
    const origins = parseOriginList(raw);

    function validateCorsOrigin(origin, callback) {
        const allowed = isAllowedCorsOrigin(origin, { isProduction, origins });
        return callback(null, allowed);
    }

    const { devFallbackOrigin, defaultOrigin, ...restOverrides } = overrides;
    return {
        origin: validateCorsOrigin,
        credentials: true,
        allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Token-Password'],
        ...restOverrides
    };
}

module.exports = {
    parseOriginList,
    normalizeOrigin,
    isAllowedCorsOrigin,
    resolveCorsOptions
};
