/**
 * Environment-driven CORS — no wide-open defaults in production.
 *
 * Canonical CORS configuration shared across all SimpleBeacon servers:
 * - ai-platform/server/index.cjs (via require)
 * - ai-platform/simplebeacon-server.cjs (via require)
 * - api-server/server.cjs (via copied lib/cors-config.cjs)
 *
 * Reads env vars in priority order:
 *   CORS_ORIGINS > CORS_ORIGIN > ALLOWED_ORIGIN > PUBLIC_URL
 */

/**
 * Parse origin list.
 * @param {any} raw
 * @returns {string[]}
 */
function parseOriginList(raw) {
    return String(raw || '')
        .split(',')
        .map(entry => entry.trim())
        .filter(Boolean);
}

/**
 * Normalize PUBLIC_URL into an origin URL.
 * @param {string} url
 * @returns {string}
 */
function normalizePublicUrl(url) {
    if (!url) return '';
    return url.startsWith('http') ? url : 'https://' + url;
}

// Preview/deploy platform origin patterns — always allowed in production
const PAGES_PREVIEW_REGEX = /^https:\/\/(?:[a-z0-9-]+\.)?simplebeacon\.pages\.dev$/;
const RENDER_REGEX = /^https:\/\/[a-z0-9-]+\.onrender\.com$/;
const NETLIFY_REGEX = /^https:\/\/[a-z0-9-]+\.netlify\.app$/;

/**
 * Build the complete set of allowed origins from env vars and overrides.
 * @param {{devFallbackOrigin?:string, defaultOrigin?:string, extraOrigins?:string[]}} [overrides]
 * @returns {string[]} Array of allowed origin strings.
 */
function resolveAllowedOrigins(overrides = {}) {
    const raw =
        process.env.CORS_ORIGINS ||
        process.env.CORS_ORIGIN ||
        process.env.ALLOWED_ORIGIN ||
        overrides.devFallbackOrigin ||
        overrides.defaultOrigin ||
        '';
    const origins = parseOriginList(raw);

    // Add PUBLIC_URL as an allowed origin if set
    const publicUrl = normalizePublicUrl(process.env.PUBLIC_URL || process.env.PUBLIC_APP_URL);
    if (publicUrl) origins.push(publicUrl);

    // Add any extra origins from overrides
    if (Array.isArray(overrides.extraOrigins)) {
        origins.push(...overrides.extraOrigins);
    }

    return [...new Set(origins.filter(Boolean))];
}

/**
 * Check if an origin is allowed — standalone function for manual header use.
 * @param {string} origin
 * @param {{devFallbackOrigin?:string, defaultOrigin?:string, extraOrigins?:string[]}} [overrides]
 * @returns {boolean}
 */
function isAllowedOrigin(origin, overrides = {}) {
    const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

    if (!isProduction) return true;
    if (!origin) return true;

    const origins = resolveAllowedOrigins(overrides);
    if (origins.includes(origin)) return true;
    if (origins.includes('*')) return false; // reject wide-open wildcard in production

    return PAGES_PREVIEW_REGEX.test(origin) || RENDER_REGEX.test(origin) || NETLIFY_REGEX.test(origin);
}

/**
 * Resolve cors options for the `cors` middleware.
 * @param {{devFallbackOrigin?:string, defaultOrigin?:string, extraOrigins?:string[], allowedHeaders?:string[]}} [overrides]
 * @returns {any}
 */
function resolveCorsOptions(overrides = {}) {
    function isAllowedCorsOrigin(origin, callback) {
        if (isAllowedOrigin(origin, overrides)) {
            callback(null, origin || true);
        } else {
            callback(null, false);
        }
    }

    const { devFallbackOrigin, defaultOrigin, extraOrigins, ...restOverrides } = overrides;
    return {
        origin: isAllowedCorsOrigin,
        credentials: true,
        allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Token-Password', 'X-SimpleBeacon-Bridge-Token'],
        methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        maxAge: 86400,
        ...restOverrides
    };
}

module.exports = {
    parseOriginList,
    resolveAllowedOrigins,
    isAllowedOrigin,
    resolveCorsOptions,
    PAGES_PREVIEW_REGEX,
    RENDER_REGEX,
    NETLIFY_REGEX
};
