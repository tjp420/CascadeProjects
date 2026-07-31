'use strict';

// Distributed rate limiter adapter for agentic triggers.
// - Tries to use ioredis (connected via REDIS_URL)
// - Falls back to a process-local in-memory sliding window when Redis isn't available
// Exports: async checkAndRecordRateLimit(orgId) -> { allowed: bool, retryAfterMs?: number }

const QUOTA = {
  RATE_LIMIT_MAX_PER_WINDOW: 3,
  RATE_LIMIT_WINDOW_MS: 60 * 1000,
};

let redisClient = null;
let usingRedis = false;
try {
  const IORedis = require('ioredis');
  const url = process.env.REDIS_URL || process.env.REDIS || 'redis://127.0.0.1:6379';
  redisClient = new IORedis(url);
  usingRedis = true;
} catch (e) {
  // ioredis not installed or connection failed; fall back
  usingRedis = false;
}

const inMemoryWindows = new Map();

async function checkAndRecordRateLimit(orgId) {
  const now = Date.now();
  const windowMs = QUOTA.RATE_LIMIT_WINDOW_MS;
  if (usingRedis && redisClient) {
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
      redis.call('ZADD', key, now, tostring(now))
      redis.call('EXPIRE', key, math.ceil(window/1000) + 1)
      return {1, 0}
    `;
    try {
      const res = await redisClient.eval(script, 1, key, now, windowMs, QUOTA.RATE_LIMIT_MAX_PER_WINDOW);
      // res -> [allowedFlag, earliestScore]
      const allowed = Number(res[0]) === 1;
      if (allowed) return { allowed: true };
      const earliest = Number(res[1]) || now;
      const retryAfterMs = (earliest + windowMs) - now;
      return { allowed: false, retryAfterMs };
    } catch (e) {
      // If Redis eval fails, fall back to in-memory implementation below
      usingRedis = false;
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

module.exports = {
  checkAndRecordRateLimit,
  _debug: {
    usingRedis: () => usingRedis,
    inMemoryWindows,
  },
};
