// simplebeacon-ignore test-coverage
/**
 * Optional Redis cache for dashboard snapshot payloads.
 */

const { createClient } = require('redis');
const { getRedisConfig, isRedisEnabled } = require('../config/redis.cjs');
const logger = require('./app-logger.cjs');

const SNAPSHOT_PREFIX = 'dashboard:snapshot:';

/**
 * Snapshot cache key.
 * @param {any} key
 * @param {any} prefix
 * @returns {any}
 */
function snapshotCacheKey(key, prefix) {
    return `${prefix}${SNAPSHOT_PREFIX}${key}`;
}

/**
 * Create redis connection.
 * @returns {any}
 */
async function createRedisConnection() {
    if (!isRedisEnabled()) {
        return { redis: null, status: 'disabled' };
    }

    const config = getRedisConfig();
    const client = createClient({ url: config.url });

    client.on('error', (error) => {
        logger.warn('[Redis] Client error:', error.message);
    });

    try {
        await client.connect();
        const pong = await client.ping();
        if (pong !== 'PONG') {
            await client.quit();
            return { redis: null, status: 'unavailable', error: 'Unexpected PING response' };
        }
        return { redis: client, status: 'connected', config };
    } catch (error) {
        logger.warn('[Phase2] Redis connection failed:', error.message);
        try {
            await client.quit();
        } catch {
            /* ignore */
        }
        return { redis: null, status: 'unavailable', error: error.message };
    }
}

/**
 * Get cached snapshot.
 * @param {Array} redis
 * @param {any} key
 * @param {Object} config
 * @returns {any}
 */
async function getCachedSnapshot(redis, key, config = getRedisConfig()) {
    if (!redis) return null;
    try {
        const raw = await redis.get(snapshotCacheKey(key, config.keyPrefix));
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        logger.warn(`[Redis] Cache read failed for ${key}:`, error.message);
        return null;
    }
}

/**
 * Set cached snapshot.
 * @param {Array} redis
 * @param {any} key
 * @param {any} payload
 * @param {Object} config
 * @returns {any}
 */
async function setCachedSnapshot(redis, key, payload, config = getRedisConfig()) {
    if (!redis || payload == null) return;
    try {
        await redis.set(
            snapshotCacheKey(key, config.keyPrefix),
            JSON.stringify(payload),
            { EX: config.defaultTtlSeconds }
        );
    } catch (error) {
        logger.warn(`[Redis] Cache write failed for ${key}:`, error.message);
    }
}

/**
 * Invalidate snapshot cache.
 * @param {Array} redis
 * @param {any} key
 * @param {Object} config
 * @returns {any}
 */
async function invalidateSnapshotCache(redis, key, config = getRedisConfig()) {
    if (!redis) return;
    try {
        await redis.del(snapshotCacheKey(key, config.keyPrefix));
    } catch (error) {
        logger.warn(`[Redis] Cache invalidate failed for ${key}:`, error.message);
    }
}

/**
 * Invalidate all snapshot caches.
 * @param {Array} redis
 * @param {Object} config
 * @returns {any}
 */
async function invalidateAllSnapshotCaches(redis, config = getRedisConfig()) {
    if (!redis) return 0;
    try {
        const pattern = `${config.keyPrefix}${SNAPSHOT_PREFIX}*`;
        const keys = [];
        let cursor = '0';
        do {
            const reply = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = reply.cursor ?? reply[0];
            const batch = reply.keys ?? reply[1] ?? [];
            if (Array.isArray(batch)) keys.push(...batch);
        } while (cursor !== '0');
        if (keys.length) {
            await redis.del(keys);
        }
        return keys.length;
    } catch (error) {
        logger.warn('[Redis] Cache flush failed:', error.message);
        return 0;
    }
}

/**
 * Redis health check.
 * @param {Array} redis
 * @returns {any}
 */
async function redisHealthCheck(redis) {
    if (!redis) {
        return { status: 'disabled', timestamp: new Date().toISOString() };
    }
    try {
        const pong = await redis.ping();
        return {
            status: pong === 'PONG' ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Close redis.
 * @param {Array} redis
 * @returns {any}
 */
async function closeRedis(redis) {
    if (!redis) return;
    try {
        await redis.quit();
    } catch {
        /* ignore */
    }
}

module.exports = {
    SNAPSHOT_PREFIX,
    snapshotCacheKey,
    createRedisConnection,
    getCachedSnapshot,
    setCachedSnapshot,
    invalidateSnapshotCache,
    invalidateAllSnapshotCaches,
    redisHealthCheck,
    closeRedis
};
