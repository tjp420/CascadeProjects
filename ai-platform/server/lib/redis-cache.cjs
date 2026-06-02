/**
 * Optional Redis cache for dashboard snapshot payloads.
 */

const { createClient } = require('redis');
const { getRedisConfig, isRedisEnabled } = require('../config/redis');
const logger = require('./app-logger');

const SNAPSHOT_PREFIX = 'dashboard:snapshot:';

function snapshotCacheKey(key, prefix) {
    return `${prefix}${SNAPSHOT_PREFIX}${key}`;
}

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

async function invalidateSnapshotCache(redis, key, config = getRedisConfig()) {
    if (!redis) return;
    try {
        await redis.del(snapshotCacheKey(key, config.keyPrefix));
    } catch (error) {
        logger.warn(`[Redis] Cache invalidate failed for ${key}:`, error.message);
    }
}

async function invalidateAllSnapshotCaches(redis, config = getRedisConfig()) {
    if (!redis) return 0;
    try {
        const pattern = `${config.keyPrefix}${SNAPSHOT_PREFIX}*`;
        const keys = await redis.keys(pattern);
        if (keys.length) {
            await redis.del(keys);
        }
        return keys.length;
    } catch (error) {
        logger.warn('[Redis] Cache flush failed:', error.message);
        return 0;
    }
}

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
