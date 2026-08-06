const assert = require('assert');
const redisLimiter = require('../../server/lib/redis-rate-limiter.cjs');

test('redis-rate-limiter: blocks after configured quota', async () => {
  const key = 'test-org-' + Date.now() + '-' + Math.floor(Math.random() * 10000);

  const usingRedis = !!(redisLimiter && redisLimiter._debug && typeof redisLimiter._debug.usingRedis === 'function' && redisLimiter._debug.usingRedis());
  if (!process.env.REDIS_URL && !usingRedis) {
    console.warn('Skipping redis integration test: no REDIS_URL and adapter not using Redis');
    return;
  }

  // Try to clean any existing state for this key when Redis is present
  if (usingRedis) {
    try {
      const IORedis = require('ioredis');
      const client = new IORedis(process.env.REDIS_URL || process.env.REDIS || 'redis://127.0.0.1:6379');
      await client.del(`agentic:ratelimit:${key}`);
      await client.quit();
    } catch (e) {
      // best-effort cleanup
    }
  }

  // The limiter in this repo uses a default quota of 3 per window
  const QUOTA = 3;

  for (let i = 0; i < QUOTA; i++) {
    const r = await redisLimiter.checkAndRecordRateLimit(key);
    assert.strictEqual(r.allowed, true, `expected allowed on iteration ${i}`);
  }

  const last = await redisLimiter.checkAndRecordRateLimit(key);
  assert.strictEqual(last.allowed, false, 'expected blocked after quota exceeded');
  if (last.retryAfterMs !== undefined) {
    assert.ok(Number(last.retryAfterMs) > 0, 'retryAfterMs should be positive when provided');
  }
});
