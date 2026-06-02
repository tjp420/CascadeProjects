/**
 * Redis configuration for Phase 2 snapshot caching.
 */

const logger = require('../lib/app-logger.cjs');

function parseRedisUrl(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        return {
            url,
            host: parsed.hostname,
            port: Number(parsed.port || 6379),
            db: parsed.pathname ? Number(parsed.pathname.replace('/', '') || 0) : 0
        };
    } catch (error) {
        logger.warn('[Redis] Invalid REDIS_URL:', error.message);
        return null;
    }
}

function getRedisConfig(overrides = {}) {
    const url = overrides.url || process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    return {
        url,
        keyPrefix: process.env.REDIS_KEY_PREFIX || 'cascade:',
        defaultTtlSeconds: Number(process.env.REDIS_SNAPSHOT_TTL_SECONDS || 300)
    };
}

function isRedisEnabled() {
    return process.env.ENABLE_REDIS === 'true'
        || Boolean(process.env.REDIS_URL)
        || process.env.REDIS_HOST != null;
}

module.exports = {
    parseRedisUrl,
    getRedisConfig,
    isRedisEnabled
};
