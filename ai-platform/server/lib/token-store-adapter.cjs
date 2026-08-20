"use strict";

/**
 * Token Store Adapter — pluggable session token persistence.
 *
 * Supports Redis (ephemeral, high-throughput) and JSON file fallback.
 * Redis is used when `REDIS_SESSION_URL` is set; otherwise the existing
 * `token-db.cjs` JSON queue is used.
 *
 * Design assumptions:
 *   - Redis eviction policy should be `noeviction` so critical
 *     token sequences are never silently evicted.
 *   - Session keys carry explicit TTLs (`EXPIRE` / `PXAT`) and are
 *     namespaced by tenant (`session:{tenantId}:{tokenHash}`).
 *   - JSON fallback can lazily backfill to Redis when Redis reconnects.
 */

const fs = require("fs");
const path = require("path");

const tokenDb = require("./token-db.cjs");

let IORedis;
let Redis;
try {
  IORedis = require("ioredis");
} catch {
  IORedis = null;
}
try {
  Redis = require("redis");
} catch {
  Redis = null;
}

const REDIS_URL = process.env.REDIS_SESSION_URL || process.env.REDIS_URL;
const REDIS_SESSION_PREFIX = "session";
const REDIS_SEQ_KEY = (tenantId) => `seq:session:${tenantId}`;
const REDIS_TOKEN_KEY = (tenantId, tokenHash) =>
  `${REDIS_SESSION_PREFIX}:${tenantId}:${tokenHash}`;
const REDIS_TENANT_ZSET = (tenantId) => `zset:sessions:${tenantId}`;
const REDIS_ACCOUNT_ZSET = (tenantId, accountId) =>
  `zset:sessions:${tenantId}:account:${accountId}`;

// ─── JsonFileTokenStore (fallback) ──────────────────────────────────────────

class JsonFileTokenStore {
  constructor() {}

  getSessionTokenByHash(tokenHash) {
    return tokenDb.getSessionTokenByHash(tokenHash);
  }

  findSessionTokensByTenant(tenantId) {
    return tokenDb.findSessionTokensByTenant(tenantId);
  }

  findSessionTokensByAccount(accountId) {
    return tokenDb.findSessionTokensByAccount(accountId);
  }

  async syncSessionToken(token) {
    return tokenDb.syncSessionToken(token);
  }

  expireSessionToken(id) {
    return tokenDb.expireSessionToken(id);
  }

  rotateSessionToken(id, newTokenHash, newExpiresAt) {
    return tokenDb.rotateSessionToken(id, newTokenHash, newExpiresAt);
  }

  nextSequence(tenantId) {
    // TODO: per-tenant sequence persistence in JSON; for now rely on replicator cache
    return null;
  }

  // No-op backfill; JSON is the source of truth when Redis is down
  backfillToRedis(_redis) {
    return { backfilled: 0 };
  }
}

// ─── RedisTokenStore ────────────────────────────────────────────────────────

class RedisTokenStore {
  constructor(client) {
    this.client = client;
  }

  async getSessionTokenByHash(tokenHash, tenantId = "default") {
    const raw = await this.client.get(REDIS_TOKEN_KEY(tenantId, tokenHash));
    return raw ? JSON.parse(raw) : null;
  }

  async findSessionTokensByTenant(tenantId = "default") {
    const keys = await this.client.zrange(REDIS_TENANT_ZSET(tenantId), 0, -1);
    if (!keys.length) return [];
    const values = await this.client.mget(keys);
    return values.filter(Boolean).map((v) => JSON.parse(v));
  }

  async findSessionTokensByAccount(accountId, tenantId = "default") {
    const keys = await this.client.zrange(
      REDIS_ACCOUNT_ZSET(tenantId, accountId),
      0,
      -1,
    );
    if (!keys.length) return [];
    const values = await this.client.mget(keys);
    return values.filter(Boolean).map((v) => JSON.parse(v));
  }

  /**
   * Atomic compare-and-swap for monotonic (epoch, tokenSequence) ordering.
   * Uses WATCH/MULTI/EXEC with an explicit retry loop.
   */
  async syncSessionToken(token) {
    const {
      token_hash,
      tenant_id = "default",
      token_sequence = 0,
      epoch = 0,
    } = token;
    const key = REDIS_TOKEN_KEY(tenant_id, token_hash);
    const tenantZset = REDIS_TENANT_ZSET(tenant_id);
    const accountZset = token.account_id
      ? REDIS_ACCOUNT_ZSET(tenant_id, token.account_id)
      : null;

    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.client.watch(key);
      const existing = await this.client.get(key);
      const parsed = existing ? JSON.parse(existing) : null;

      if (parsed) {
        const localEpoch = parsed.epoch || 0;
        const localSeq = parsed.token_sequence || 0;
        const newer =
          epoch > localEpoch ||
          (epoch === localEpoch && token_sequence > localSeq);
        if (!newer) {
          await this.client.unwatch();
          return {
            accepted: false,
            action: "ignored",
            reason: "stale_sequence",
          };
        }
      }

      const multi = this.client.multi();
      multi.set(key, JSON.stringify(token));
      multi.zadd(tenantZset, token_sequence, key);
      if (accountZset) multi.zadd(accountZset, token_sequence, key);

      // Set session key TTL if an expires_at ISO string is available
      const expiresAt = token.expires_at || token.expiresAt;
      if (expiresAt) {
        const ms = new Date(expiresAt).getTime() - Date.now();
        if (ms > 0) multi.pexpire(key, Math.floor(ms));
      }

      const results = await multi.exec();
      if (results) {
        return { accepted: true, action: existing ? "update" : "insert" };
      }
      // Transaction aborted because key changed; retry
    }
    return {
      accepted: false,
      action: "error",
      reason: "concurrent_update_retries_exhausted",
    };
  }

  async expireSessionToken(id) {
    // In Redis the canonical key is by token_hash; this adapter requires a token_hash map.
    // For now, fallback to scanning tenant zsets is expensive; return 0 changed.
    return 0;
  }

  async rotateSessionToken(id, newTokenHash, newExpiresAt) {
    return { accepted: false, reason: "rotate_requires_lookup" };
  }

  async nextSequence(tenantId = "default") {
    return await this.client.incr(REDIS_SEQ_KEY(tenantId));
  }

  /**
   * Backfill local JSON tokens into Redis when Redis recovers.
   * This is a one-way sync; JSON tokens without a Redis key are written.
   */
  async backfillToRedis() {
    const all = tokenDb.findSessionTokensByTenant("*") || [];
    if (!all.length) return { backfilled: 0 };
    let backfilled = 0;
    const pipeline = this.client.pipeline();
    for (const token of all) {
      const t = token.tenant_id || "default";
      const key = REDIS_TOKEN_KEY(t, token.token_hash);
      pipeline.get(key);
      backfilled += 1;
    }
    const exists = await pipeline.exec();
    for (let i = 0; i < all.length; i++) {
      if (!exists[i][1]) {
        await this.syncSessionToken(all[i]);
      }
    }
    return { backfilled };
  }
}

// ─── Factory and exports ────────────────────────────────────────────────────

let _redisClient = null;
let _activeStore = null;

function createRedisClient(url = REDIS_URL) {
  if (!url) return null;
  if (IORedis) {
    return new IORedis(url, { maxRetriesPerRequest: 3, lazyConnect: true });
  }
  if (Redis && Redis.createClient) {
    return Redis.createClient({ url });
  }
  return null;
}

async function getStore() {
  if (_activeStore) return _activeStore;

  if (REDIS_URL) {
    if (!_redisClient) {
      _redisClient = createRedisClient();
      if (_redisClient) {
        try {
          if (typeof _redisClient.connect === "function")
            await _redisClient.connect();
          _activeStore = new RedisTokenStore(_redisClient);
          return _activeStore;
        } catch (err) {
          _redisClient = null;
        }
      }
    }
  }

  _activeStore = new JsonFileTokenStore();
  return _activeStore;
}

function setStore(store) {
  _activeStore = store;
}

function getRedisClient() {
  return _redisClient;
}

module.exports = {
  JsonFileTokenStore,
  RedisTokenStore,
  getStore,
  setStore,
  getRedisClient,
  createRedisClient,
};
