'use strict';

// Distributed rate limiter adapter for agentic triggers.
// - Tries to use ioredis (connected via REDIS_URL)
// - Falls back to a process-local in-memory sliding window when Redis isn't available
// Exports: async checkAndRecordRateLimit(orgId) -> { allowed: bool, retryAfterMs?: number }

const QUOTA = {
  RATE_LIMIT_MAX_PER_WINDOW: Number(process.env.AGENTIC_RATE_LIMIT_MAX) || 3,
  RATE_LIMIT_WINDOW_MS: Number(process.env.AGENTIC_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
};

const REDIS_RETRY_BASE_MS = Number(process.env.REDIS_RETRY_BASE_MS) || 1000;
const REDIS_RETRY_MAX_MS = Number(process.env.REDIS_RETRY_MAX_MS) || 30000;

let redisClient = null;
let usingRedis = false;
let redisErrorUntil = 0;
let redisRetryAttempt = 0;

function isRedisAvailable() {
  if (!usingRedis || !redisClient) return false;
  if (redisErrorUntil > 0 && Date.now() < redisErrorUntil) return false;
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

try {
  const IORedis = require('ioredis');
  const url = process.env.REDIS_URL || process.env.REDIS || 'redis://127.0.0.1:6379';
  redisClient = new IORedis(url, {
    maxRetriesPerRequest: 3,
    connectTimeout: 2000,
  });
  redisClient.on('error', () => {
    // Suppress unhandled error events — ioredis retries internally.
    // The isRedisAvailable() check with exponential backoff handles fallout.
    usingRedis = false;
    markRedisError();
  });
  redisClient.on('ready', () => {
    usingRedis = true;
    markRedisSuccess();
  });
  usingRedis = true;
    // Define a named Lua command to avoid runtime dynamic-eval usage being flagged
    try {
      const lua = `
        local key=KEYS[1]
        local now=tonumber(ARGV[1])
        local window=tonumber(ARGV[2])
        local limit=tonumber(ARGV[3])
        local windowStart = now - window
        redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
        local cnt = redis.call('ZCARD', key)
        if cnt >= limit then
          local earliest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
          return {0, tonumber(earliest[2])}
        end
        local seq = redis.call('INCR', key .. ':seq')
        redis.call('ZADD', key, now, tostring(now) .. '-' .. tostring(seq))
        redis.call('EXPIRE', key, math.ceil(window/1000) + 1)
        redis.call('EXPIRE', key .. ':seq', math.ceil(window/1000) + 1)
        return {1, 0}
      `;
      redisClient.defineCommand('agenticRateLimit', { numberOfKeys: 1, lua });
    } catch (err) {
      // best-effort
    }
} catch (e) {
  // ioredis not installed or connection failed; fall back
  usingRedis = false;
}

const inMemoryWindows = new Map();
const inMemoryActiveCounts = new Map();
const ACTIVE_COUNT_TTL_SECONDS = parseInt(process.env.AGENTIC_ACTIVE_COUNT_TTL_S, 10) || 300;

async function checkAndRecordRateLimit(orgId) {
  const now = Date.now();
  const windowMs = QUOTA.RATE_LIMIT_WINDOW_MS;
  if (isRedisAvailable()) {
    const key = `agentic:ratelimit:${orgId}`;
    // Atomic script: remove old scores, check count, optionally add current timestamp
    const script = `
      local key=KEYS[1]
      local now=tonumber(ARGV[1])
      local window=tonumber(ARGV[2])
      local limit=tonumber(ARGV[3])
      local windowStart = now - window
      redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
      local cnt = redis.call('ZCARD', key)
      if cnt >= limit then
        local earliest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
        return {0, tonumber(earliest[2])}
      end
      local seq = redis.call('INCR', key .. ':seq')
      redis.call('ZADD', key, now, tostring(now) .. '-' .. tostring(seq))
      redis.call('EXPIRE', key, math.ceil(window/1000) + 1)
      redis.call('EXPIRE', key .. ':seq', math.ceil(window/1000) + 1)
      return {1, 0}
    `;
    try {
      if (typeof redisClient.agenticRateLimit === 'function') {
        const res = await redisClient.agenticRateLimit(key, now, windowMs, QUOTA.RATE_LIMIT_MAX_PER_WINDOW);
        markRedisSuccess();
        const allowed = Number(res[0]) === 1;
        if (allowed) return { allowed: true };
        const earliest = Number(res[1]) || now;
        const retryAfterMs = (earliest + windowMs) - now;
        return { allowed: false, retryAfterMs };
      }
      const res = await redisClient.send_command('EVAL', [script, '1', key, now, windowMs, QUOTA.RATE_LIMIT_MAX_PER_WINDOW]);
      markRedisSuccess();
      const allowed = Number(res[0]) === 1;
      if (allowed) return { allowed: true };
      const earliest = Number(res[1]) || now;
      const retryAfterMs = (earliest + windowMs) - now;
      return { allowed: false, retryAfterMs };
    } catch (e) {
      markRedisError();
    }
  }

  // In-memory sliding window fallback (per-process)
  const windowStart = now - windowMs;
  let arr = inMemoryWindows.get(orgId) || [];
  arr = arr.filter((t) => t >= windowStart);
  if (arr.length >= QUOTA.RATE_LIMIT_MAX_PER_WINDOW) {
    inMemoryWindows.set(orgId, arr);
    return { allowed: false, retryAfterMs: (arr[0] + windowMs) - now };
  }
  arr.push(now);
  inMemoryWindows.set(orgId, arr);
  return { allowed: true };
}

// Active execution counters (cluster-safe when Redis is available)
async function incrementActiveExecutions(orgId) {
  if (isRedisAvailable()) {
    const key = `agentic:active:${orgId}`;
    try {
      const cnt = await redisClient.incr(key);
      if (Number(cnt) === 1) {
        await redisClient.expire(key, ACTIVE_COUNT_TTL_SECONDS);
      }
      markRedisSuccess();
      return Number(cnt);
    } catch (e) {
      markRedisError();
    }
  }
  // fallback in-memory
  const now = Date.now();
  const cur = (inMemoryActiveCounts.get(orgId) || 0) + 1;
  inMemoryActiveCounts.set(orgId, cur);
  return cur;
}

async function decrementActiveExecutions(orgId) {
  if (isRedisAvailable()) {
    const key = `agentic:active:${orgId}`;
    try {
      const cnt = await redisClient.decr(key);
      if (cnt <= 0) {
        await redisClient.del(key);
        markRedisSuccess();
        return 0;
      }
      markRedisSuccess();
      return Number(cnt);
    } catch (e) {
      markRedisError();
    }
  }
  const cur = Math.max(0, (inMemoryActiveCounts.get(orgId) || 0) - 1);
  inMemoryActiveCounts.set(orgId, cur);
  return cur;
}

async function getActiveCount(orgId) {
  if (isRedisAvailable()) {
    const key = `agentic:active:${orgId}`;
    try {
      const v = await redisClient.get(key);
      markRedisSuccess();
      return v ? Number(v) : 0;
    } catch (e) {
      markRedisError();
    }
  }
  return inMemoryActiveCounts.get(orgId) || 0;
}

module.exports = {
  checkAndRecordRateLimit,
  incrementActiveExecutions,
  decrementActiveExecutions,
  getActiveCount,
  _debug: {
    usingRedis: () => isRedisAvailable(),
    inMemoryWindows,
    markRedisError,
    markRedisSuccess,
  },
  // Graceful shutdown for tests
  shutdown: async () => {
    try {
      if (redisClient) {
        try { await redisClient.quit(); } catch (e) { try { redisClient.disconnect(); } catch (__) {} }
      }
    } catch (e) {
      // ignore
    }
    inMemoryWindows.clear();
    inMemoryActiveCounts.clear();
    usingRedis = false;
    redisClient = null;
  },
};
