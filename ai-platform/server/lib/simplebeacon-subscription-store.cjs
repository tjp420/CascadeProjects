/**
 * Simplebeacon Cloud Teams entitlements — file store with optional Postgres sync.
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

const SCAN_QUOTA_MAP = {
  developer: 100,
  startup: 2500,
  growth: 10000,
  enterprise: Infinity
};

/**
 * Is monetization enabled.
 * @returns {any}
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
 * Default store.
 * @returns {any}
 */
function defaultStore() {
  return { subscriptions: {}, byApiToken: {} };
}

/**
 * Read store.
 * @returns {any}
 */
async function readStore() {
  try {
    const raw = await fs.promises.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      subscriptions: parsed.subscriptions || {},
      byApiToken: parsed.byApiToken || {}
    };
  } catch {
    return defaultStore();
  }
}

/**
 * Write store.
 * @param {any} store
 * @returns {any}
 */
async function writeStore(store) {
  await fs.promises.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.promises.writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

/**
 * Normalize email.
 * @param {string} email
 * @returns {any}
 */
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Create api token.
 * @returns {any}
 */
function createApiToken() {
  return `sb_${crypto.randomBytes(24).toString('hex')}`;
}

/**
 * Subscription record.
 * @param {string} email
 * @param {Array} overrides
 * @returns {any}
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
 * Get subscription by email.
 * @param {string} email
 * @returns {any}
 */
async function getSubscriptionByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const store = await readStore();
  return store.subscriptions[normalized] || null;
}

/**
 * Get subscription by api token.
 * @param {string} token
 * @returns {any}
 */
async function getSubscriptionByApiToken(token) {
  if (!token) return null;
  const store = await readStore();
  const email = store.byApiToken[token];
  if (!email) return null;
  return store.subscriptions[email] || null;
}

/**
 * Upsert subscription.
 * @param {string} email
 * @param {any} patch
 * @returns {any}
 */
async function upsertSubscription(email, patch = {}) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error('Email is required');
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
 * Set subscription active.
 * @param {string} email
 * @param {any} active
 * @param {Array} stripeFields
 * @returns {any}
 */
async function setSubscriptionActive(email, active, stripeFields = {}) {
  return upsertSubscription(email, {
    subscriptionActive: Boolean(active),
    ...stripeFields
  });
}

/**
 * Reset period if needed.
 * @param {any} record
 * @returns {any}
 */
function resetPeriodIfNeeded(record) {
  const periodStart = record.periodStart ? Date.parse(record.periodStart) : 0;
  if (!periodStart || Date.now() - periodStart >= PAID_PERIOD_MS) {
    return {
      ...record,
      apiCallsThisPeriod: 0,
      scansThisPeriod: 0,
      periodStart: new Date().toISOString()
    };
  }
  return record;
}

/**
 * Consume api call.
 * @param {string} token
 * @returns {any}
 */
async function consumeApiCall(token) {
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
 * Consume compliance cert.
 * @param {string} email
 * @returns {any}
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
  const quota = record.scanQuota || SCAN_QUOTA_MAP[record.tier] || SCAN_QUOTA_MAP.developer;

  if (quota !== Infinity && record.scansThisPeriod >= quota) {
    store.subscriptions[normalized] = record;
    await writeStore(store);
    return { allowed: false, reason: 'scan_quota_exceeded', limit: quota, remaining: 0, periodStart: record.periodStart };
  }

  record.scansThisPeriod += 1;
  record.scanType = scanType;
  record.updatedAt = new Date().toISOString();
  store.subscriptions[normalized] = record;
  await writeStore(store);

  return { allowed: true, remaining: quota === Infinity ? Infinity : Math.max(0, quota - record.scansThisPeriod), limit: quota, periodStart: record.periodStart };
}

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
 * Sync subscription to db.
 * @param {any} db
 * @param {any} record
 * @returns {any}
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
 * Public subscription status.
 * @param {any} record
 * @returns {any}
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
  const scanQuota = reset.scanQuota || SCAN_QUOTA_MAP[reset.tier] || SCAN_QUOTA_MAP.developer;
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
  SCAN_QUOTA_MAP,
  isMonetizationEnabled,
  readStore,
  writeStore,
  getSubscriptionByEmail,
  getSubscriptionByApiToken,
  upsertSubscription,
  setSubscriptionActive,
  consumeApiCall,
  consumeScan,
  consumeComplianceCert,
  syncSubscriptionToDb,
  publicSubscriptionStatus,
  normalizeEmail
};
