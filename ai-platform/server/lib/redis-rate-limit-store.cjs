// simplebeacon-ignore eval-danger: client.eval() is the ioredis method for Redis EVAL (Lua scripts), not JavaScript eval()
'use strict';

/**
 * Redis-backed store for express-rate-limit v8.
 *
 * Implements the Store interface (increment/decrement/resetKey/resetAll/get)
 * using ioredis with a fixed-window counter strategy. Each rate-limit key
 * gets its own Redis key with a TTL equal to the window duration, so counters
 * auto-expire without manual cleanup.
 *
 * Behavior:
 * - When Redis is available, rate limit state is shared across all processes
 *   that connect to the same Redis instance (multi-instance deployments).
 * - When Redis is unavailable (connection fails, ioredis not installed, or
 *   ENABLE_REDIS_RATE_LIMIT=false), createRedisStore() returns null and
 *   express-rate-limit falls back to its default in-memory store.
 * - During a Redis outage mid-request, increment() fails open (returns
 *   counter=0) to avoid blocking all API traffic.
 *
 * Env vars:
 * - REDIS_URL / REDIS — Redis connection URL (default: redis://127.0.0.1:6379)
 * - ENABLE_REDIS_RATE_LIMIT — Set to 'false' to disable Redis rate limiting
 * - REDIS_RATE_LIMIT_PREFIX — Key prefix (default: 'ratelimit:')
 *
 * @module redis-rate-limit-store
 */

const logger = require('./app-logger.cjs');

const KEY_PREFIX = process.env.REDIS_RATE_LIMIT_PREFIX || 'ratelimit:';
const REDIS_RETRY_BASE_MS = Number(process.env.REDIS_RETRY_BASE_MS) || 1000;
const REDIS_RETRY_MAX_MS = Number(process.env.REDIS_RETRY_MAX_MS) || 30000;

// Lua script for atomic increment + TTL set on first increment
// Returns: {count, resetTimeMs}
const INCREMENT_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local count = redis.call('INCR', key)
if count == 1 then
  redis.call('PEXPIRE', key, windowMs)
end
local pttl = redis.call('PTTL', key)
if pttl < 0 then
  pttl = windowMs
end
return {count, now + pttl}
`;

/**
 * RedisStore — implements express-rate-limit v8 Store interface.
 */
class RedisStore {
  /**
   * @param {object} options
   * @param {import('ioredis').default} options.client — Connected ioredis client
   * @param {string} [options.prefix] — Key prefix
   */
  constructor(options) {
    this.client = options.client;
    this.prefix = options.prefix || KEY_PREFIX;
    this._resetAllRequested = false;
  }

  /**
   * Build the full Redis key for a rate-limit key.
   * @param {string} key
   * @returns {string}
   */
  _fullKey(key) {
    return `${this.prefix}${key}`;
  }

  /**
   * Increment the counter for a key.
   * Implements express-rate-limit Store.increment().
   * @param {string} key
   * @param {object} options — express-rate-limit options (windowMs)
   * @returns {Promise<{counter: number, resetTime: Date}>}
   */
  async increment(key, options) {
    const now = Date.now();
    const windowMs = options?.windowMs || 60000;
    const fullKey = this._fullKey(key);
    try {
      const result = await this.client.eval(
        INCREMENT_SCRIPT,
        1,
        fullKey,
        now,
        windowMs
      );
      const counter = Number(result[0]) || 0;
      const resetTimeMs = Number(result[1]) || (now + windowMs);
      return { counter, resetTime: new Date(resetTimeMs) };
    } catch (err) {
      console.error('redis-rate-limit-store.cjs error:', err);
      // Fail open — allow the request during Redis outage
      logger.warn('[RedisStore] increment failed, failing open:', err.message);
      return { counter: 0, resetTime: new Date(now + windowMs) };
    }
  }

  /**
   * Decrement the counter for a key.
   * Used by express-rate-limit when skipSuccessfulRequests or skipFailedRequests is set.
   * @param {string} key
   * @param {object} options
   * @returns {Promise<void>}
   */
  async decrement(key, options) {
    const fullKey = this._fullKey(key);
    try {
      await this.client.decr(fullKey);
    } catch (err) {
      logger.warn('[RedisStore] decrement failed:', err.message);
    }
  }

  /**
   * Reset the counter for a specific key.
   * @param {string} key
   * @returns {Promise<void>}
   */
  async resetKey(key) {
    const fullKey = this._fullKey(key);
    try {
      await this.client.del(fullKey);
    } catch (err) {
      logger.warn('[RedisStore] resetKey failed:', err.message);
    }
  }

  /**
   * Reset all rate-limit keys (test utility).
   * Uses SCAN to find keys with the prefix and deletes them.
   * @returns {Promise<void>}
   */
  async resetAll() {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(
          cursor, 'MATCH', `${this.prefix}*`, 'COUNT', 100
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      logger.warn('[RedisStore] resetAll failed:', err.message);
    }
  }

  /**
   * Get the current counter and reset time for a key (test utility).
   * @param {string} key
   * @returns {Promise<{counter: number, resetTime: Date}|undefined>}
   */
  async get(key) {
    const fullKey = this._fullKey(key);
    try {
      const counter = await this.client.get(fullKey);
      if (counter === null) return undefined;
      const pttl = await this.client.pttl(fullKey);
      const resetTimeMs = Date.now() + (pttl > 0 ? pttl : 0);
      return { counter: Number(counter), resetTime: new Date(resetTimeMs) };
    } catch (err) {
      logger.warn('[RedisStore] get failed:', err.message);
      return undefined;
    }
  }

  /**
   * Graceful shutdown — close the Redis connection.
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      if (this.client) {
        await this.client.quit();
      }
    } catch (err) {
      try { this.client.disconnect(); } catch { /* ignore */ }
    }
  }
}

// Singleton state — only one Redis connection per process
let storeInstance = null;
let initAttempted = false;
let redisErrorUntil = 0;
let redisRetryAttempt = 0;

function isRateLimitRedisEnabled() {
  if (process.env.ENABLE_REDIS_RATE_LIMIT === 'false') return false;
  if (!process.env.REDIS_URL && !process.env.REDIS && !process.env.REDIS_HOST) return false;
  return true;
}

function markRedisError() {
  redisRetryAttempt++;
  const delay = Math.min(REDIS_RETRY_BASE_MS * Math.pow(2, redisRetryAttempt - 1), REDIS_RETRY_MAX_MS);
  redisErrorUntil = Date.now() + delay;
}

function markRedisSuccess() {
  redisRetryAttempt = 0;
  redisErrorUntil = 0;
}

/**
 * Create or return the singleton RedisStore instance.
 * Returns null if Redis is unavailable, disabled, or connection fails.
 * @returns {RedisStore|null}
 */
function getRedisStore() {
  if (initAttempted) return storeInstance;
  initAttempted = true;

  if (!isRateLimitRedisEnabled()) {
    logger.info('[RedisStore] Redis rate limiting disabled (ENABLE_REDIS_RATE_LIMIT=false or no REDIS_URL)');
    return null;
  }

  // Check for Redis outage backoff
  if (redisErrorUntil > 0 && Date.now() < redisErrorUntil) {
    return null;
  }

  try {
    const IORedis = require('ioredis');
    const url = process.env.REDIS_URL || process.env.REDIS || 'redis://127.0.0.1:6379';
    const client = new IORedis(url, {
      retryStrategy: (times) => Math.min(times * REDIS_RETRY_BASE_MS, REDIS_RETRY_MAX_MS),
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      connectTimeout: 5000,
    });

    client.on('error', (err) => {
      markRedisError();
      logger.warn('[RedisStore] Redis error:', err.message);
    });

    client.on('connect', () => {
      markRedisSuccess();
      logger.info('[RedisStore] Connected to Redis for distributed rate limiting');
    });

    storeInstance = new RedisStore({ client, prefix: KEY_PREFIX });
    return storeInstance;
  } catch (err) {
    markRedisError();
    logger.warn('[RedisStore] Failed to initialize Redis store, using in-memory fallback:', err.message);
    return null;
  }
}

/**
 * Reset the singleton (test utility).
 * Closes the connection and clears cached state.
 */
async function resetRedisStore() {
  if (storeInstance) {
    await storeInstance.shutdown();
  }
  storeInstance = null;
  initAttempted = false;
  redisErrorUntil = 0;
  redisRetryAttempt = 0;
}

module.exports = {
  RedisStore,
  getRedisStore,
  resetRedisStore,
  isRateLimitRedisEnabled,
  _debug: {
    markRedisError,
    markRedisSuccess,
    getInitAttempted: () => initAttempted,
    getStoreInstance: () => storeInstance,
  },
};
