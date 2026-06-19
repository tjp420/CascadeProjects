/**
 * Environment-driven CORS — no wide-open defaults in production.
 */

/**
 * Parse origin list.
 * @param {any} raw
 * @returns {any}
 */
function parseOriginList(raw) {
    return String(raw || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

/**
 * Resolve cors options.
 * @param {Array} overrides
 * @returns {any}
 */
function resolveCorsOptions(overrides = {}) {
    const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    const raw = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || overrides.defaultOrigin || '';
    const origins = parseOriginList(raw);

    if (!isProduction) {
        // Development: mirror any origin regardless of env vars
        return {
            origin: true,
            credentials: true,
            ...overrides
        };
    }

    if (origins.length === 0) {
        return {
            origin: false,
            credentials: false,
            ...overrides
        };
    }

    if (origins.includes('*')) {
        if (isProduction) {
            throw new Error(
                'CORS_ORIGIN(S) must not be "*" in production. Set explicit allowed origins.'
            );
        }
        return { origin: true, credentials: true, ...overrides };
    }

    return {
        origin: origins,
        credentials: true,
        ...overrides
    };
}

module.exports = {
    parseOriginList,
    resolveCorsOptions
};
