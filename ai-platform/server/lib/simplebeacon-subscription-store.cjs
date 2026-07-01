/**
 * Simplebeacon Cloud Teams entitlements — file store with optional Postgres sync.
 * Includes in-memory read cache and atomic file writes for durability.
 * @module simplebeacon-subscription-store
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../../src/lib/app-logger.cjs');

const constants = require('../config/constants.cjs');
const PROJECT_ROOT = path.join(__dirname, '../..');
const STORE_PATH = process.env.SIMPLEBEACON_SUBSCRIPTION_STORE
  || path.join(PROJECT_ROOT, '.simplebeacon', 'subscriptions.json');
const PAID_API_LIMIT = Number(process.env.SIMPLEBEACON_PAID_API_LIMIT || 100);
const PAID_PERIOD_MS = 30 * 24 * 60 * constants.ONE_MINUTE_MS;

/** Basic email regex for validation (covers 99 % of valid addresses). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** API token prefix. */
const TOKEN_PREFIX = 'sb_';
/** API token hex length after prefix. */
const TOKEN_HEX_LEN = 48;
/** Full API token length including prefix. */
const TOKEN_FULL_LEN = TOKEN_PREFIX.length + TOKEN_HEX_LEN;

/** In-memory store cache. */
let _cache = null;
/** True when the cache is known to be stale (after a write). */
let _cacheDirty = true;
/** Prevent concurrent writes. */
let _writeInProgress = false;
/** Queue of pending write promises. */
const _writeQueue = [];

const SCAN_QUOTA_MAP = {
  developer: Infinity,
  startup: 2500,
  growth: 10000,
  enterprise: Infinity
};

/**
 * @typedef {Object} Store
 * @property {Object<string, SubscriptionRecord>} subscriptions
 * @property {Object<string, string>} byApiToken Maps apiToken → normalized email
 */

/**
 * @typedef {Object} SubscriptionRecord
 * @property {string} email
 * @property {boolean} subscriptionActive
 * @property {string|null} stripeCustomerId
 * @property {string|null} subscriptionId
 * @property {string|null} product
 * @property {string} tier
 * @property {string} apiToken
 * @property {number} apiCallsThisPeriod
 * @property {number} scansThisPeriod
 * @property {number} scanQuota
 * @property {string} scanType
 * @property {string} periodStart ISO date string
 * @property {string} updatedAt ISO date string
 * @property {string|null} licenseToken
 * @property {string|null} licenseTier
 * @property {number} complianceCertsThisPeriod
 * @property {number} complianceCertLimit
 * @property {string|null} certClientName
 * @property {string|null} certProjectName
 * @property {string} certMilestone
 * @property {string} certOrgId
 * @property {boolean} customConfigEnabled
 * @property {boolean} allowlistEnabled
 */

/**
 * @typedef {Object} ConsumptionResult
 * @property {boolean} allowed
 * @property {string} [reason]
 * @property {number} [remaining]
 * @property {number} [limit]
 * @property {string} [periodStart]
 */

/**
 * Is monetization enabled.
 * @returns {boolean}
 */
function isMonetizationEnabled() {
  if (process.env.SIMPLEBEACON_MONETIZATION_ENABLED === 'false') {
    return false;
  }
  if (process.env.SIMPLEBEACON_MONETIZATION_ENABLED === 'true') {
    return true;
  }
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

/**
 * Default empty store.
 * @returns {Store}
 */
function defaultStore() {
  return { subscriptions: {}, byApiToken: {} };
}

/**
 * Clear the in-memory read cache.
 * Call after external file modifications (e.g. manual edits).
 * @returns {void}
 */
function clearCache() {
  _cache = null;
  _cacheDirty = true;
}

/**
 * Read store from disk (with in-memory cache).
 * @returns {Promise<Store>}
 */
async function readStore() {
  if (!_cacheDirty && _cache) {
    return _cache;
  }
  try {
    const raw = await fs.promises.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    _cache = {
      subscriptions: parsed.subscriptions || {},
      byApiToken: parsed.byApiToken || {}
    };
    _cacheDirty = false;
    return _cache;
  } catch {
    _cache = defaultStore();
    _cacheDirty = false;
    return _cache;
  }
}

/**
 * Atomically write store to disk.
 * Uses tmp-file + rename to prevent partial writes under concurrent access.
 * @param {Store} store
 * @returns {Promise<void>}
 */
async function writeStore(store) {
  // Serialize all writes through a queue to prevent race conditions
  if (_writeInProgress) {
    return new Promise((resolve, reject) => {
      _writeQueue.push({ store, resolve, reject });
    });
  }
  _writeInProgress = true;

  try {
    await _doWrite(store);
  } finally {
    _writeInProgress = false;
    // Process any queued writes
    if (_writeQueue.length > 0) {
      const next = _writeQueue.shift();
      // Write the latest accumulated state (not the queued one, which may be stale)
      const latest = _cache || store;
      writeStore(latest).then(next.resolve, next.reject);
    }
  }
}

/** Perform the actual atomic write. */
async function _doWrite(store) {
  const dir = path.dirname(STORE_PATH);
  await fs.promises.mkdir(dir, { recursive: true });
  const json = `${JSON.stringify(store, null, 2)}\n`;
  const tmpPath = `${STORE_PATH}.tmp.${Date.now()}`;
  try {
    await fs.promises.writeFile(tmpPath, json, 'utf8');
    await fs.promises.rename(tmpPath, STORE_PATH);
  } catch (err) {
    // On Windows the target may be locked; fall back to direct overwrite
    if (err.code === 'EPERM') {
      await fs.promises.writeFile(STORE_PATH, json, 'utf8');
    } else {
      throw err;
    }
  } finally {
    // Clean up tmp file if rename failed and it still exists
    try {
      await fs.promises.unlink(tmpPath);
    } catch {
      // ignore
    }
  }
  _cache = store;
  _cacheDirty = false;
}

/**
 * Normalize and validate an email address.
 * @param {string} email
 * @returns {string} Normalized email or empty string if invalid.
 */
function normalizeEmail(email) {
  const s = String(email || '').trim().toLowerCase();
  if (!s || !EMAIL_RE.test(s)) return '';
  return s;
}

/**
 * Create a new API token.
 * @returns {string}
 */
function createApiToken() {
  return `${TOKEN_PREFIX}${crypto.randomBytes(TOKEN_HEX_LEN / 2).toString('hex')}`;
}

/**
 * Validate an API token format (does NOT check existence in store).
 * @param {string} token
 * @returns {boolean}
 */
function isValidApiTokenFormat(token) {
  return typeof token === 'string'
    && token.startsWith(TOKEN_PREFIX)
    && token.length === TOKEN_FULL_LEN;
}

/**
 * Build a fresh subscription record.
 * @param {string} email Normalized email.
 * @param {Partial<SubscriptionRecord>} [overrides]
 * @returns {SubscriptionRecord}
 */
function subscriptionRecord(email, overrides = {}) {
  const now = new Date().toISOString();
  return {
    email,
    subscriptionActive: false,
    stripeCustomerId: null,
    subscriptionId: null,
    product: null,
    tier: 'developer',
    apiToken: createApiToken(),
    apiCallsThisPeriod: 0,
    scansThisPeriod: 0,
    scanQuota: SCAN_QUOTA_MAP.developer,
    scanType: 'local',
    periodStart: now,
    updatedAt: now,
    licenseToken: null,
    licenseTier: null,
    complianceCertsThisPeriod: 0,
    complianceCertLimit: 0,
    certClientName: null,
    certProjectName: null,
    certMilestone: 'release',
    certOrgId: 'default',
    customConfigEnabled: false,
    allowlistEnabled: false,
    ...overrides
  };
}

/**
 * Get subscription by normalized email.
 * @param {string} email
 * @returns {Promise<SubscriptionRecord|null>}
 */
async function getSubscriptionByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const store = await readStore();
  return store.subscriptions[normalized] || null;
}

/**
 * Get subscription by API token.
 * @param {string} token
 * @returns {Promise<SubscriptionRecord|null>}
 */
async function getSubscriptionByApiToken(token) {
  if (!isValidApiTokenFormat(token)) return null;
  const store = await readStore();
  const email = store.byApiToken[token];
  if (!email) return null;
  return store.subscriptions[email] || null;
}

/**
 * Create or update a subscription.
 * @param {string} email
 * @param {Partial<SubscriptionRecord>} [patch]
 * @returns {Promise<SubscriptionRecord>}
 * @throws {Error} If email is invalid.
 */
async function upsertSubscription(email, patch = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error('Email is required and must be a valid email address');
  }

  const store = await readStore();
  const existing = store.subscriptions[normalized] || subscriptionRecord(normalized);
  const next = {
    ...existing,
    email: normalized,
    ...patch,
    updatedAt: new Date().toISOString()
  };

  if (existing.apiToken && existing.apiToken !== next.apiToken) {
    delete store.byApiToken[existing.apiToken];
  }
  if (!next.apiToken) {
    next.apiToken = createApiToken();
  }

  store.subscriptions[normalized] = next;
  store.byApiToken[next.apiToken] = normalized;
  await writeStore(store);
  return next;
}

/**
 * Activate or deactivate a subscription.
 * @param {string} email
 * @param {boolean} active
 * @param {Partial<SubscriptionRecord>} [stripeFields]
 * @returns {Promise<SubscriptionRecord>}
 */
async function setSubscriptionActive(email, active, stripeFields = {}) {
  return upsertSubscription(email, {
    subscriptionActive: Boolean(active),
    ...stripeFields
  });
}

/**
 * Reset usage counters if the billing period has elapsed.
 * @param {SubscriptionRecord} record
 * @returns {SubscriptionRecord}
 */
function resetPeriodIfNeeded(record) {
  const periodStart = record.periodStart ? Date.parse(record.periodStart) : 0;
  if (!periodStart || Date.now() - periodStart >= PAID_PERIOD_MS) {
    return {
      ...record,
      apiCallsThisPeriod: 0,
      scansThisPeriod: 0,
      complianceCertsThisPeriod: 0,
      periodStart: new Date().toISOString()
    };
  }
  return record;
}

/**
 * Consume one API call from a token's quota.
 * @param {string} token
 * @returns {Promise<ConsumptionResult>}
 */
async function consumeApiCall(token) {
  if (!isValidApiTokenFormat(token)) {
    return { allowed: false, reason: 'invalid_token' };
  }
  const store = await readStore();
  const email = store.byApiToken[token];
  if (!email) {
    return { allowed: false, reason: 'invalid_token' };
  }

  let record = store.subscriptions[email];
  if (!record?.subscriptionActive) {
    return { allowed: false, reason: 'subscription_inactive' };
  }

  record = resetPeriodIfNeeded(record);
  if (record.apiCallsThisPeriod >= PAID_API_LIMIT) {
    store.subscriptions[email] = record;
    await writeStore(store);
    return {
      allowed: false,
      reason: 'rate_limit',
      limit: PAID_API_LIMIT,
      remaining: 0,
      periodStart: record.periodStart
    };
  }

  record.apiCallsThisPeriod += 1;
  record.updatedAt = new Date().toISOString();
  store.subscriptions[email] = record;
  await writeStore(store);

  return {
    allowed: true,
    remaining: PAID_API_LIMIT - record.apiCallsThisPeriod,
    limit: PAID_API_LIMIT,
    periodStart: record.periodStart
  };
}

/**
 * Consume one scan from a user's quota.
 * @param {string} email
 * @param {string} [scanType='local']
 * @returns {Promise<ConsumptionResult>}
 */
async function consumeScan(email, scanType = 'local') {
  const normalized = normalizeEmail(email);
  if (!normalized) return { allowed: false, reason: 'email_required' };

  const store = await readStore();
  let record = store.subscriptions[normalized];
  if (!record) {
    record = subscriptionRecord(normalized);
    store.subscriptions[normalized] = record;
  }

  record = resetPeriodIfNeeded(record);
  const quota = Number.isFinite(record.scanQuota)
    ? record.scanQuota
    : (SCAN_QUOTA_MAP[record.tier] || SCAN_QUOTA_MAP.developer);

  if (quota !== Infinity && record.scansThisPeriod >= quota) {
    store.subscriptions[normalized] = record;
    await writeStore(store);
    return {
      allowed: false,
      reason: 'scan_quota_exceeded',
      limit: quota,
      remaining: 0,
      periodStart: record.periodStart
    };
  }

  record.scansThisPeriod += 1;
  record.scanType = scanType;
  record.updatedAt = new Date().toISOString();
  store.subscriptions[normalized] = record;
  await writeStore(store);

  return {
    allowed: true,
    remaining: quota === Infinity ? Infinity : Math.max(0, quota - record.scansThisPeriod),
    limit: quota,
    periodStart: record.periodStart
  };
}

/**
 * Consume one compliance certificate from a user's quota.
 * Requires active subscription and product === 'continuous_shield'.
 * @param {string} email
 * @returns {Promise<ConsumptionResult>}
 */
async function consumeComplianceCert(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return { allowed: false, reason: 'email_required' };

  const store = await readStore();
  let record = store.subscriptions[normalized];
  if (!record?.subscriptionActive) {
    return { allowed: false, reason: 'subscription_inactive' };
  }
  if (record.product !== 'continuous_shield') {
    return { allowed: false, reason: 'tier_not_continuous_shield' };
  }

  record = resetPeriodIfNeeded(record);
  const limit = record.complianceCertLimit || 3;
  if (record.complianceCertsThisPeriod >= limit) {
    store.subscriptions[normalized] = record;
    await writeStore(store);
    return { allowed: false, reason: 'cert_limit_reached', limit, remaining: 0, periodStart: record.periodStart };
  }

  record.complianceCertsThisPeriod += 1;
  record.updatedAt = new Date().toISOString();
  store.subscriptions[normalized] = record;
  await writeStore(store);

  return { allowed: true, remaining: limit - record.complianceCertsThisPeriod, limit, periodStart: record.periodStart };
}

/**
 * Sync a subscription record to the users table in Postgres.
 * @param {any} db A pg-compatible client with `.query(sql, params)`.
 * @param {SubscriptionRecord} record
 * @returns {Promise<void>}
 */
async function syncSubscriptionToDb(db, record) {
  if (!db || !record?.email) return;
  try {
    await db.query(
      `UPDATE users SET
         subscription_active = $2,
         stripe_customer_id = $3,
         subscription_id = $4,
         api_token = $5
       WHERE email = $1`,
      [
        record.email,
        record.subscriptionActive,
        record.stripeCustomerId,
        record.subscriptionId,
        record.apiToken
      ]
    );
  } catch (error) {
    logger.warn('[Simplebeacon billing] DB sync skipped:', error.message);
  }
}

/**
 * Build a public-facing status object from a subscription record.
 * @param {SubscriptionRecord|null} record
 * @returns {Object}
 */
function publicSubscriptionStatus(record) {
  if (!record) {
    return {
      tier: 'free',
      subscriptionActive: false,
      apiLimit: PAID_API_LIMIT
    };
  }

  const reset = resetPeriodIfNeeded(record);
  const certLimit = reset.complianceCertLimit || 0;
  const scanQuota = Number.isFinite(reset.scanQuota)
    ? reset.scanQuota
    : (SCAN_QUOTA_MAP[reset.tier] || SCAN_QUOTA_MAP.developer);
  return {
    tier: reset.subscriptionActive ? (reset.product || reset.tier || 'paid') : 'free',
    email: reset.email,
    subscriptionActive: Boolean(reset.subscriptionActive),
    apiToken: reset.subscriptionActive ? reset.apiToken : null,
    apiLimit: PAID_API_LIMIT,
    apiCallsThisPeriod: reset.apiCallsThisPeriod,
    apiRemaining: Math.max(0, PAID_API_LIMIT - reset.apiCallsThisPeriod),
    scanQuota: scanQuota === Infinity ? 'unlimited' : scanQuota,
    scansThisPeriod: reset.scansThisPeriod || 0,
    scansRemaining: scanQuota === Infinity ? 'unlimited' : Math.max(0, scanQuota - (reset.scansThisPeriod || 0)),
    scanType: reset.scanType || 'local',
    customConfigEnabled: Boolean(reset.customConfigEnabled),
    allowlistEnabled: Boolean(reset.allowlistEnabled),
    periodStart: reset.periodStart,
    product: reset.product || null,
    complianceCertLimit: certLimit,
    complianceCertsThisPeriod: reset.complianceCertsThisPeriod || 0,
    complianceCertsRemaining: Math.max(0, certLimit - (reset.complianceCertsThisPeriod || 0)),
    certClientName: reset.certClientName || null,
    certProjectName: reset.certProjectName || null,
    certMilestone: reset.certMilestone || 'release',
    certOrgId: reset.certOrgId || 'default'
  };
}

module.exports = {
  STORE_PATH,
  PAID_API_LIMIT,
  PAID_PERIOD_MS,
  SCAN_QUOTA_MAP,
  isMonetizationEnabled,
  defaultStore,
  readStore,
  writeStore,
  clearCache,
  getSubscriptionByEmail,
  getSubscriptionByApiToken,
  upsertSubscription,
  setSubscriptionActive,
  consumeApiCall,
  consumeScan,
  consumeComplianceCert,
  syncSubscriptionToDb,
  publicSubscriptionStatus,
  normalizeEmail,
  createApiToken,
  isValidApiTokenFormat,
  subscriptionRecord,
  resetPeriodIfNeeded
};
