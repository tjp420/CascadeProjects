// SPDX-License-Identifier: MIT
/**
 * Redis configuration for Phase 2 snapshot caching.
 *
 * @license MIT
 */

const logger = require('../lib/app-logger.cjs');

const constants = require('./constants.cjs');
const DEFAULT_REDIS_PORT = constants.REDIS_PORT;
const DEFAULT_KEY_PREFIX = 'cascade:';
const DEFAULT_TTL_SECONDS = constants.TIMEOUT_5S / constants.MS_PER_SECOND;

/**
 * Parse a Redis connection URL into component parts.
 * @param {string} url - Redis connection URL.
 * @returns {{url:string,host:string,port:number,db:number}|null}
 */
function parseRedisUrl(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        return {
            url,
            host: parsed.hostname,
            port: Number(parsed.port || DEFAULT_REDIS_PORT),
            db: parsed.pathname ? Number(parsed.pathname.replace('/', '') || 0) : 0
        };
    } catch (error) {
        logger.warn('[Redis] Invalid REDIS_URL:', error.message);
        return null;
    }
}

/**
 * Build the Redis configuration object.
 * @param {{url?:string}} [overrides={}] - Runtime overrides.
 * @returns {{url:string,keyPrefix:string,defaultTtlSeconds:number}}
 */
function getRedisConfig(overrides = {}) {
    const url = overrides.url || process.env.REDIS_URL;
    if (!url) {
        logger.warn('[Redis] REDIS_URL is not set — snapshot caching disabled. Set REDIS_URL or ENABLE_REDIS=false to suppress this warning.');
    }
    return {
        url: url || '',
        keyPrefix: process.env.REDIS_KEY_PREFIX || DEFAULT_KEY_PREFIX,
        defaultTtlSeconds: Number(process.env.REDIS_SNAPSHOT_TTL_SECONDS || DEFAULT_TTL_SECONDS)
    };
}

/**
 * Determine whether Redis caching is enabled via environment.
 * @returns {boolean}
 */
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
