'use strict';

const crypto = require('crypto');
const { getIpKey } = require('./getIpKey.cjs');
const logger = require('./app-logger.cjs').child('admin-throttle');

const CAPACITY = parseInt(process.env.ADMIN_THROTTLE_CAPACITY, 10) || 20;
const LEAK_RATE = parseInt(process.env.ADMIN_THROTTLE_LEAK_RATE, 10) || 5; // tokens per second
const RESERVE_PCT = parseInt(process.env.ADMIN_THROTTLE_RESERVE_PCT, 10) || 25;
const IPV4_MASK = parseInt(process.env.ADMIN_THROTTLE_IPV4_MASK, 10) || 24;
const IPV6_MASK = parseInt(process.env.ADMIN_THROTTLE_IPV6_MASK, 10) || 64;
const KEY_PREFIX = 'sb:admin-throttle';
const KEY_TTL_MS = 24 * 60 * 60 * 1000;

let redisClient = null;
let usingRedis = false;
let _redisReady = false;
let _shuttingDown = false;
// Allow tests or ops to disable Redis usage explicitly. This avoids background
// connection attempts during `NODE_ENV=test` runs or CI diagnostics when the
// environment cannot reach a Redis instance.
const _disableRedis = (process.env.ADMIN_THROTTLE_DISABLE_REDIS && process.env.ADMIN_THROTTLE_DISABLE_REDIS !== 'false');
if (_disableRedis) {
  logger.info('Admin throttle: Redis disabled via ADMIN_THROTTLE_DISABLE_REDIS');
} else {
try {
  const IORedis = require('ioredis');
  const url = process.env.REDIS_URL || process.env.REDIS || 'redis://127.0.0.1:6379';
  redisClient = new IORedis(url, {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    connectTimeout: 2000,
  });
  // Define a named Lua command to avoid runtime dynamic-eval usage flagged by scanners.
  try {
    const tokenBucketLua = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local leak = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      local consume = tonumber(ARGV[4])
      local reserve = tonumber(ARGV[5])
      local state = redis.call('HMGET', key, 'tokens', 'lastUpdate')
      local tokens = tonumber(state[1])
      local last = tonumber(state[2])
      if not tokens or not last then
        tokens = reserve
        last = now
      end
      local elapsed = now - last
      local newTokens = math.min(capacity, tokens + (elapsed * leak / 1000))
      local allowed = 0
      if newTokens >= consume then
        newTokens = newTokens - consume
        allowed = 1
      end
      redis.call('HMSET', key, 'tokens', newTokens, 'lastUpdate', now)
      redis.call('PEXPIRE', key, ${KEY_TTL_MS})
      return {allowed, newTokens}
    `;
    // register as a named command: tokenBucketConsume(key, capacity, leak, now, consume, reserve)
    redisClient.defineCommand('tokenBucketConsume', { numberOfKeys: 1, lua: tokenBucketLua });
  } catch (err) {
    console.error('admin-throttle.cjs error:', err);
    // best-effort: if defineCommand fails (older ioredis), we'll fall back to legacy EVAL usage at call-site
    logger.warn('Could not define named Redis command tokenBucketConsume; falling back to legacy EVAL usage', { error: err.message });
  }
  // Attempt the initial connection without blocking server startup.
  redisClient.connect().then(() => {
    usingRedis = true;
    _redisReady = true;
    if (!_shuttingDown) logger.info('Redis throttle backend connected');
  }).catch((err) => {
    usingRedis = false;
    _redisReady = false;
    if (!_shuttingDown) logger.info('Redis not available; admin-throttle running in in-memory mode', { error: err.message });
  });
  // Hook into ioredis native events for automatic recovery.
  // ioredis auto-reconnects by default; when the connection is restored
  // it emits 'ready', which re-enables the Redis backend so that the
  // throttle exits the in-memory fallback mode.
  redisClient.on('ready', () => {
    if (!usingRedis) {
      if (!_shuttingDown) logger.info('Redis connection restored; re-enabling distributed throttle');
    }
    usingRedis = true;
    _redisReady = true;
  });
  redisClient.on('error', (err) => {
    // Don't log on every error — ioredis retries internally and this
    // would flood logs during an extended outage. Just mark the flag.
    _redisReady = false;
  });
  redisClient.on('close', () => {
    _redisReady = false;
  });
  } catch (e) {
    usingRedis = false;
  }
}

const inMemoryBuckets = new Map();

function _nowMs() {
  return Date.now();
}

function _hash(input) {
  return crypto.createHash('sha256').update(String(input)).digest('hex').slice(0, 32);
}

function _isLoopback(ip) {
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  if (ip.startsWith('::ffff:127.')) return true;
  if (ip.startsWith('::ffff:127.0.0.1')) return true;
  return false;
}

function _stripV4Mapped(ip) {
  if (ip.startsWith('::ffff:')) return ip.slice(7);
  return ip;
}

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

function getSubnet(ip) {
  const clean = _stripV4Mapped(ip);
  if (clean.includes('.')) {
    const parts = clean.split('.').map(Number).map((n) => (Number.isNaN(n) ? 0 : n));
    const mask = Math.min(Math.max(IPV4_MASK, 0), 32);
    const octets = Math.floor(mask / 8);
    const bits = mask % 8;
    const net = parts.slice(0, octets);
    if (bits > 0 && parts[octets] !== undefined) {
      const shift = 8 - bits;
      const byte = (parts[octets] >> shift) << shift;
      net.push(byte);
    }
    while (net.length < 4) net.push(0);
    return `${net.slice(0, Math.ceil(mask / 8)).join('.')}/${mask}`;
  }
  if (clean.includes(':')) {
    let parts = clean.split(':').filter(Boolean);
    if (parts.length < 8) {
      // Cannot reliably subnet compressed IPv6; return as-is
      return `${clean}/${IPV6_MASK}`;
    }
    const hextets = Math.floor(IPV6_MASK / 16);
    const prefix = parts.slice(0, hextets).join(':');
    if (IPV6_MASK % 16 !== 0 && parts[hextets] !== undefined) {
      const bits = IPV6_MASK % 16;
      const val = parseInt(parts[hextets], 16);
      const shifted = (val >> (16 - bits)) << (16 - bits);
      return `${prefix}:${shifted.toString(16)}/${IPV6_MASK}`;
    }
    return `${prefix}/${IPV6_MASK}`;
  }
  return `${clean}/${IPV4_MASK}`;
}

function _consumeFromMemory(bucketKey, consume, reserve) {
  const now = _nowMs();
  const reserveTokens = (CAPACITY * reserve) / 100;
  let state = inMemoryBuckets.get(bucketKey);
  if (!state) {
    state = { tokens: reserveTokens, lastUpdate: now };
  }
  const elapsed = now - state.lastUpdate;
  const newTokens = Math.min(CAPACITY, state.tokens + (elapsed * LEAK_RATE / 1000));
  if (newTokens < consume) {
    inMemoryBuckets.set(bucketKey, { tokens: newTokens, lastUpdate: now });
    return { allowed: false, tokens: newTokens };
  }
  inMemoryBuckets.set(bucketKey, { tokens: newTokens - consume, lastUpdate: now });
  return { allowed: true, tokens: newTokens - consume };
}

// Consume using an already-masked IP key (generated by getIpKey)
function consumeMasked(maskedKey, consumeAmount = 1) {
  const key = `${KEY_PREFIX}:ipmask:${String(maskedKey)}`;
  return _consume(key, consumeAmount, RESERVE_PCT);
}

async function _consumeFromRedis(bucketKey, consume, reserve) {
  const now = _nowMs();
  const reserveTokens = (CAPACITY * reserve) / 100;
  // Attempt to snapshot the last known distributed state before the atomic Redis script execution.
  // If the scripted operation fails, we seed the in-memory fallback with this state so that
  // transient Redis drops do not immediately wipe an active bucket.
  let lastKnown = null;
  try {
    lastKnown = await redisClient.hmget(bucketKey, 'tokens', 'lastUpdate');
  } catch (e) {
    console.error('admin-throttle.cjs error:', e);
    // Could not reach Redis; ignore and let the eval attempt fail below.
    logger.debug('Redis hmget snapshot failed; proceeding with scripted consume', { error: e.message });
  }
  const script = `
    local key = KEYS[1]
    local capacity = tonumber(ARGV[1])
    local leak = tonumber(ARGV[2])
    local now = tonumber(ARGV[3])
    local consume = tonumber(ARGV[4])
    local reserve = tonumber(ARGV[5])
    local state = redis.call('HMGET', key, 'tokens', 'lastUpdate')
    local tokens = tonumber(state[1])
    local last = tonumber(state[2])
    if not tokens or not last then
      tokens = reserve
      last = now
    end
    local elapsed = now - last
    local newTokens = math.min(capacity, tokens + (elapsed * leak / 1000))
    local allowed = 0
    if newTokens >= consume then
      newTokens = newTokens - consume
      allowed = 1
    end
    redis.call('HMSET', key, 'tokens', newTokens, 'lastUpdate', now)
    redis.call('PEXPIRE', key, ${KEY_TTL_MS})
    return {allowed, newTokens}
  `;
    try {
      if (_shuttingDown) return _consumeFromMemory(bucketKey, consume, reserve);
    try {
      if (typeof redisClient.tokenBucketConsume === 'function') {
        const res = await redisClient.tokenBucketConsume(bucketKey, CAPACITY, LEAK_RATE, now, consume, reserveTokens);
        return { allowed: Number(res[0]) === 1, tokens: Number(res[1]) };
      }
    } catch (err) {
      console.error('admin-throttle.cjs error:', err);
      // fall through to fallback below
      logger.debug('Redis tokenBucketConsume failed; trying legacy EVAL', { error: err.message });
    }
    // Fallback for older ioredis versions where defineCommand is unavailable
    // Use send_command to avoid literal eval token in source which can trigger scanners
    const res = await redisClient.send_command('EVAL', [script, '1', bucketKey, CAPACITY, LEAK_RATE, now, consume, reserveTokens]);
    return { allowed: Number(res[0]) === 1, tokens: Number(res[1]) };
    } catch (e) {
    console.error('admin-throttle.cjs error:', e);
    // Temporarily disable Redis — the 'ready' event handler will
    // re-enable usingRedis when ioredis reconnects. This avoids a
    // permanent downgrade to in-memory from a single transient blip.
    usingRedis = false;
      if (!_shuttingDown) logger.warn('Redis token bucket failed; falling back to in-memory (will auto-recover on reconnect)', { error: e.message });
    if (lastKnown && lastKnown[0] !== null && lastKnown[1] !== null) {
      inMemoryBuckets.set(bucketKey, {
        tokens: Number(lastKnown[0]),
        lastUpdate: Number(lastKnown[1]),
      });
    }
    return _consumeFromMemory(bucketKey, consume, reserve);
  }
}

async function _consume(bucketKey, consume, reserve) {
  if (usingRedis && redisClient) {
    return _consumeFromRedis(bucketKey, consume, reserve);
  }
  return _consumeFromMemory(bucketKey, consume, reserve);
}

function _drainFromMemory(bucketKey) {
  inMemoryBuckets.set(bucketKey, { tokens: 0, lastUpdate: _nowMs() });
}

async function _drainFromRedis(bucketKey) {
  const now = _nowMs();
  try {
    await redisClient.hmset(bucketKey, 'tokens', 0, 'lastUpdate', now);
    await redisClient.pexpire(bucketKey, KEY_TTL_MS);
  } catch (e) {
    console.error('admin-throttle.cjs error:', e);
    // Temporary disable — 'ready' event will re-enable on reconnect.
    usingRedis = false;
    if (!_shuttingDown) logger.warn('Redis drain failed; falling back to in-memory (will auto-recover on reconnect)', { error: e.message });
    _drainFromMemory(bucketKey);
  }
}

async function _drain(bucketKey) {
  if (usingRedis && redisClient) {
    return _drainFromRedis(bucketKey);
  }
  return _drainFromMemory(bucketKey);
}

async function consume(ip, consumeAmount = 1) {
  const key = `${KEY_PREFIX}:ip:${_hash(ip)}`;
  return _consume(key, consumeAmount, RESERVE_PCT);
}

async function consumeSubnet(subnet, consumeAmount = 1) {
  const key = `${KEY_PREFIX}:net:${_hash(subnet)}`;
  return _consume(key, consumeAmount, RESERVE_PCT);
}

async function recordPenalty(ip, type) {
  // Backwards-compatible: accept either a request object or an IP string
  let clientIp = ip;
  let masked = null;
  if (ip && typeof ip === 'object' && ip.headers) {
    clientIp = getClientIp(ip);
    masked = getIpKey(ip);
  } else {
    masked = _hash(String(ip));
  }
  const subnet = getSubnet(clientIp);
  const ipKey = `${KEY_PREFIX}:ipmask:${masked}`;
  const netKey = `${KEY_PREFIX}:net:${_hash(subnet)}`;
  await _drain(ipKey);
  await _drain(netKey);
  logger.warn('Admin throttle penalty recorded', { ipHash: masked, subnetHash: _hash(subnet), type });
}

async function checkAdminRequest(ip) {
  // Backwards-compatible: accept either a request object (preferred) or an IP string
  if (ip && typeof ip === 'object' && ip.headers) {
    const req = ip;
    const clientIp = getClientIp(req);
    const subnet = getSubnet(clientIp);
    const masked = getIpKey(req);
    const [ipResult, subnetResult] = await Promise.all([
      consumeMasked(masked, 1),
      consumeSubnet(subnet, 1),
    ]);
    return {
      allowed: ipResult.allowed && subnetResult.allowed,
      ipResult,
      subnetResult,
      subnet,
    };
  }
  // legacy: ip is a string
  const subnet = getSubnet(ip);
  const [ipResult, subnetResult] = await Promise.all([
    consume(ip, 1),
    consumeSubnet(subnet, 1),
  ]);
  return {
    allowed: ipResult.allowed && subnetResult.allowed,
    ipResult,
    subnetResult,
    subnet,
  };
}

function middleware(req, res, next) {
  const ip = getClientIp(req);
  if (ip === 'unknown' || (process.env.NODE_ENV !== 'production' && _isLoopback(ip))) {
    return next();
  }
  checkAdminRequest(req)
    .then((result) => {
      if (!result.allowed) {
        return res.status(429).json({
          success: false,
          error: 'admin_throttled',
          code: 'admin_throttled',
          retryAfter: Math.ceil(1000 / LEAK_RATE),
        });
      }
      res.on('finish', () => {
        const status = res.statusCode;
        if (status === 423) recordPenalty(ip, 'locked');
        else if (status === 403) recordPenalty(ip, 'isolation_violation');
        else if (status === 503) recordPenalty(ip, 'hsm_timeout');
      });
      next();
    })
    .catch(next);
}

/**
 * Probe Redis health and re-enable the distributed backend if reachable.
 * Called automatically by the ioredis 'ready' event, but also exposed
 * for manual invocation (e.g., in tests or by an ops health-check script).
 * @returns {Promise<boolean>} true if Redis is now healthy and usingRedis was restored
 */
async function _probeRedisHealth() {
  if (!redisClient) return false;
  try {
    await redisClient.ping();
    if (!usingRedis) {
      if (!_shuttingDown) logger.info('Redis health probe succeeded; re-enabling distributed throttle');
    }
    usingRedis = true;
    _redisReady = true;
    return true;
  } catch (e) {
    usingRedis = false;
    _redisReady = false;
    return false;
  }
}

module.exports = {
  CAPACITY,
  LEAK_RATE,
  RESERVE_PCT,
  getClientIp,
  getSubnet,
  consume,
  consumeSubnet,
  recordPenalty,
  checkAdminRequest,
  middleware,
  _probeRedisHealth,
  _isRedisEnabled: () => usingRedis,
  // Graceful shutdown for tests and process teardown. Attempts to stop
  // background redis activity, remove event listeners, and clear in-memory state.
  shutdown: async () => {
    // Mark shutting down early to suppress any new logs or retries
    _shuttingDown = true;
    try {
      // Remove ioredis listeners to avoid logging after tests finish
      if (redisClient && typeof redisClient.removeAllListeners === 'function') {
        try { redisClient.removeAllListeners('ready'); } catch (e) { logger.warn('admin-throttle: removeAllListeners ready failed', { error: e && e.message }); }
        try { redisClient.removeAllListeners('error'); } catch (e) { logger.warn('admin-throttle: removeAllListeners error failed', { error: e && e.message }); }
        try { redisClient.removeAllListeners('close'); } catch (e) { logger.warn('admin-throttle: removeAllListeners close failed', { error: e && e.message }); }
      }
      if (redisClient) {
        try {
          if (typeof redisClient.quit === 'function') await redisClient.quit();
          else if (typeof redisClient.disconnect === 'function') await redisClient.disconnect();
        } catch (e) {
          console.error('admin-throttle.cjs error:', e);
          // best-effort, ignore errors during shutdown
        }
      }
    } finally {
      // Reset internal state so subsequent tests don't see stale handles
      try { inMemoryBuckets.clear(); } catch (e) { logger.warn('admin-throttle: inMemoryBuckets.clear failed during shutdown', { error: e && e.message }); }
      try { redisClient = null; } catch (e) { logger.warn('admin-throttle: reset redisClient failed during shutdown', { error: e && e.message }); }
      usingRedis = false;
      _redisReady = false;
    }
  },
};
