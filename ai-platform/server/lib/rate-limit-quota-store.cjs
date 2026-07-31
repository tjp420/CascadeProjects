'use strict';

/**
 * Rate-Limit Quota Store — Distributed token bucket rate-limiting layer
 * that controls API usage quotas by user, organization, or model tier.
 *
 * Features:
 *   - Token bucket algorithm per scope (user, org, tier)
 *   - Configurable policies: capacity, refill rate, burst allowance
 *   - Per-tier multiplier (cloud-premium costs more tokens than local-fast)
 *   - Sliding window usage tracking for stats and billing
 *   - Persistent policy configuration and usage snapshots
 *
 * @module rate-limit-quota-store
 */

const fs = require('fs');
const path = require('path');
const logger = require('./app-logger.cjs');

const STORE_PATH =
  process.env.RATE_LIMIT_QUOTA_PATH ||
  path.join(process.cwd(), '.simplebeacon', 'rate-limit-quotas.json');

const USAGE_SNAPSHOT_INTERVAL_MS = 60000; // Persist usage every 60s
const MAX_USAGE_BUCKETS = 1440; // 24h of minute buckets

// Default quota policies
const DEFAULT_POLICIES = {
  user: {
    capacity: 100,
    refillRatePerMin: 30,
    burstAllowance: 1.5,
    enabled: true,
  },
  org: {
    capacity: 500,
    refillRatePerMin: 100,
    burstAllowance: 1.2,
    enabled: true,
  },
  tier: {
    'local-fast': { capacity: 200, refillRatePerMin: 60, costMultiplier: 0.5 },
    'local-capable': { capacity: 150, refillRatePerMin: 40, costMultiplier: 0.7 },
    'cloud-fast': { capacity: 100, refillRatePerMin: 30, costMultiplier: 1.0 },
    'cloud-capable': { capacity: 60, refillRatePerMin: 15, costMultiplier: 2.0 },
    'cloud-premium': { capacity: 30, refillRatePerMin: 8, costMultiplier: 3.0 },
  },
};

// In-memory token buckets: { 'scope:key': { tokens, lastRefill, capacity, refillRate } }
const _buckets = new Map();

// In-memory usage tracking: { 'scope:key': { buckets: [{ ts, count, tokensConsumed }], totalRequests, totalTokensConsumed, blockedRequests } }
const _usage = new Map();

let _policies = null;
let _cacheDirty = true;
let _lastSnapshot = 0;

function readStore() {
  if (!_cacheDirty) return _policies;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      _policies = JSON.parse(raw);
      if (!_policies.user) _policies.user = DEFAULT_POLICIES.user;
      if (!_policies.org) _policies.org = DEFAULT_POLICIES.org;
      if (!_policies.tier) _policies.tier = DEFAULT_POLICIES.tier;
    } else {
      _policies = JSON.parse(JSON.stringify(DEFAULT_POLICIES));
    }
  } catch {
    _policies = JSON.parse(JSON.stringify(DEFAULT_POLICIES));
  }
  _cacheDirty = false;
  return _policies;
}

function writeStore() {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(_policies, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_PATH);
  _cacheDirty = false;
}

// ── Token Bucket Logic ──────────────────────────────────────────────────────

function getBucket(scope, key) {
  const bucketKey = `${scope}:${key}`;
  let bucket = _buckets.get(bucketKey);

  if (!bucket) {
    const policy = getPolicy(scope, key);
    bucket = {
      tokens: policy.capacity,
      lastRefill: Date.now(),
      capacity: policy.capacity,
      refillRatePerMin: policy.refillRatePerMin,
    };
    _buckets.set(bucketKey, bucket);
  }

  // Refill tokens based on elapsed time
  const now = Date.now();
  const elapsedMin = (now - bucket.lastRefill) / 60000;
  const refilled = elapsedMin * bucket.refillRatePerMin;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + refilled);
  bucket.lastRefill = now;

  return bucket;
}

function getPolicy(scope, key) {
  const policies = readStore();
  if (scope === 'tier') {
    const tierPolicy = policies.tier[key] || policies.tier['cloud-fast'];
    return {
      capacity: tierPolicy.capacity,
      refillRatePerMin: tierPolicy.refillRatePerMin,
      burstAllowance: 1.0,
      enabled: true,
    };
  }
  const base = policies[scope] || policies.user;
  return {
    capacity: base.capacity,
    refillRatePerMin: base.refillRatePerMin,
    burstAllowance: base.burstAllowance || 1.0,
    enabled: base.enabled !== false,
  };
}

/**
 * Check and consume tokens from the bucket.
 * @param {string} scope — 'user', 'org', or 'tier'
 * @param {string} key — user email, org ID, or tier ID
 * @param {number} cost — tokens to consume (default 1)
 * @returns {object} — { allowed, remaining, resetInMs, scope, key }
 */
function checkQuota(scope, key, cost = 1) {
  const policy = getPolicy(scope, key);

  if (!policy.enabled) {
    return { allowed: true, remaining: Infinity, resetInMs: 0, scope, key, disabled: true };
  }

  const bucket = getBucket(scope, key);
  const effectiveCost = Math.max(1, Math.round(cost));

  if (bucket.tokens >= effectiveCost) {
    bucket.tokens -= effectiveCost;
    recordUsage(scope, key, true, effectiveCost);
    maybeSnapshot();
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      resetInMs: Math.ceil((bucket.capacity - bucket.tokens) / bucket.refillRatePerMin * 60000),
      scope,
      key,
    };
  }

  recordUsage(scope, key, false, effectiveCost);
  maybeSnapshot();
  return {
    allowed: false,
    remaining: Math.floor(bucket.tokens),
    resetInMs: Math.ceil((effectiveCost - bucket.tokens) / bucket.refillRatePerMin * 60000),
    scope,
    key,
  };
}

/**
 * Check quota across multiple scopes (user + org + tier).
 * All must pass. Consumes from all if allowed.
 * @param {object} contexts — { user: email, org: orgId, tier: tierId }
 * @param {number} baseCost — base token cost
 * @returns {object} — { allowed, details, remaining }
 */
function checkQuotas(contexts, baseCost = 1) {
  const details = [];
  let totalCost = baseCost;

  // Calculate tier-adjusted cost
  if (contexts.tier) {
    const policies = readStore();
    const tierPolicy = policies.tier[contexts.tier];
    if (tierPolicy && tierPolicy.costMultiplier) {
      totalCost = Math.max(1, Math.round(baseCost * tierPolicy.costMultiplier));
    }
  }

  // Check all scopes first without consuming
  for (const [scope, key] of Object.entries(contexts)) {
    if (!key) continue;
    const policy = getPolicy(scope, key);
    if (!policy.enabled) continue;
    const bucket = getBucket(scope, key);
    if (bucket.tokens < totalCost) {
      recordUsage(scope, key, false, totalCost);
      maybeSnapshot();
      return {
        allowed: false,
        reason: `Quota exceeded for ${scope}:${key}`,
        details: [{
          scope, key, allowed: false,
          remaining: Math.floor(bucket.tokens),
          resetInMs: Math.ceil((totalCost - bucket.tokens) / bucket.refillRatePerMin * 60000),
        }],
        cost: totalCost,
      };
    }
    details.push({ scope, key, allowed: true, remaining: Math.floor(bucket.tokens) });
  }

  // All passed — consume from all
  for (const d of details) {
    const bucket = getBucket(d.scope, d.key);
    bucket.tokens -= totalCost;
    d.remaining = Math.floor(bucket.tokens);
    recordUsage(d.scope, d.key, true, totalCost);
  }

  maybeSnapshot();
  return { allowed: true, details, cost: totalCost };
}

// ── Usage Tracking ──────────────────────────────────────────────────────────

function recordUsage(scope, key, allowed, tokensConsumed) {
  const usageKey = `${scope}:${key}`;
  let usage = _usage.get(usageKey);
  if (!usage) {
    usage = {
      buckets: [],
      totalRequests: 0,
      totalTokensConsumed: 0,
      blockedRequests: 0,
      lastRequestAt: null,
    };
    _usage.set(usageKey, usage);
  }

  const now = Date.now();
  const bucketTs = Math.floor(now / 60000) * 60000;
  let bucket = usage.buckets[usage.buckets.length - 1];
  if (!bucket || bucket.ts !== bucketTs) {
    bucket = { ts: bucketTs, count: 0, tokensConsumed: 0, blocked: 0 };
    usage.buckets.push(bucket);
    if (usage.buckets.length > MAX_USAGE_BUCKETS) {
      usage.buckets = usage.buckets.slice(-MAX_USAGE_BUCKETS);
    }
  }

  bucket.count++;
  usage.totalRequests++;
  usage.lastRequestAt = new Date(now).toISOString();

  if (allowed) {
    bucket.tokensConsumed += tokensConsumed;
    usage.totalTokensConsumed += tokensConsumed;
  } else {
    bucket.blocked++;
    usage.blockedRequests++;
  }
}

function maybeSnapshot() {
  const now = Date.now();
  if (now - _lastSnapshot < USAGE_SNAPSHOT_INTERVAL_MS) return;
  _lastSnapshot = now;
  // Usage is in-memory; could persist if needed for crash recovery
  // For now, we just update the timestamp
}

// ── Policy Management ───────────────────────────────────────────────────────

function getPolicies() {
  return readStore();
}

function updatePolicy(scope, updates) {
  const policies = readStore();
  if (scope === 'tier') {
    // updates is { tierId: { ... } }
    for (const [tierId, tierUpdates] of Object.entries(updates)) {
      if (!policies.tier[tierId]) {
        policies.tier[tierId] = { capacity: 100, refillRatePerMin: 30, costMultiplier: 1.0 };
      }
      Object.assign(policies.tier[tierId], tierUpdates);
    }
  } else {
    Object.assign(policies[scope], updates);
  }
  writeStore();
  // Reset buckets for affected scope so new policy takes effect
  for (const [bk, bucket] of _buckets) {
    if (bk.startsWith(`${scope}:`)) {
      const policy = getPolicy(scope, bk.split(':')[1]);
      bucket.capacity = policy.capacity;
      bucket.refillRatePerMin = policy.refillRatePerMin;
    }
  }
  return { success: true, policies };
}

function resetPolicies() {
  _policies = JSON.parse(JSON.stringify(DEFAULT_POLICIES));
  writeStore();
  _buckets.clear();
  return { success: true, policies: _policies };
}

// ── Usage Queries ───────────────────────────────────────────────────────────

function getUsage(scope, key) {
  const usageKey = `${scope}:${key}`;
  return _usage.get(usageKey) || null;
}

function getAllUsage() {
  const result = {};
  for (const [key, usage] of _usage) {
    result[key] = {
      totalRequests: usage.totalRequests,
      totalTokensConsumed: usage.totalTokensConsumed,
      blockedRequests: usage.blockedRequests,
      lastRequestAt: usage.lastRequestAt,
      recentBuckets: usage.buckets.slice(-60), // last hour
    };
  }
  return result;
}

function getUsageStats() {
  let totalRequests = 0;
  let totalTokensConsumed = 0;
  let totalBlocked = 0;
  let activeScopes = 0;

  for (const usage of _usage.values()) {
    totalRequests += usage.totalRequests;
    totalTokensConsumed += usage.totalTokensConsumed;
    totalBlocked += usage.blockedRequests;
    activeScopes++;
  }

  return {
    totalRequests,
    totalTokensConsumed,
    totalBlocked,
    activeScopes,
    blockRate: totalRequests > 0 ? Math.round((totalBlocked / totalRequests) * 10000) / 100 : 0,
  };
}

function getBucketStatus(scope, key) {
  const bucket = getBucket(scope, key);
  return {
    scope,
    key,
    tokens: Math.floor(bucket.tokens),
    capacity: bucket.capacity,
    refillRatePerMin: bucket.refillRatePerMin,
    utilization: Math.round((1 - bucket.tokens / bucket.capacity) * 100),
  };
}

function resetUsage() {
  _usage.clear();
  return { success: true };
}

module.exports = {
  checkQuota,
  checkQuotas,
  getPolicies,
  updatePolicy,
  resetPolicies,
  getUsage,
  getAllUsage,
  getUsageStats,
  getBucketStatus,
  resetUsage,
};
