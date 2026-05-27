/**
 * Environment-driven CORS — no wide-open defaults in production.
 */

function parseOriginList(raw) {
    return String(raw || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
}

function resolveCorsOptions(overrides = {}) {
    const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    const raw = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || overrides.defaultOrigin || '';
    const origins = parseOriginList(raw);

    if (origins.length === 0) {
        if (isProduction) {
            return {
                origin: false,
                credentials: false,
                ...overrides
            };
        }
        return {
            origin: overrides.devFallbackOrigin || 'http://localhost:3000',
            credentials: true,
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
