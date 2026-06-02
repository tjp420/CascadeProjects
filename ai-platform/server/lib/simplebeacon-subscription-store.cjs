/**
 * Simplebeacon Cloud Teams entitlements — file store with optional Postgres sync.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const logger = require('../../src/lib/app-logger.cjs');

const PROJECT_ROOT = path.join(__dirname, '../..');
const STORE_PATH = process.env.SIMPLEBEACON_SUBSCRIPTION_STORE
  || path.join(PROJECT_ROOT, '.simplebeacon', 'subscriptions.json');
const PAID_API_LIMIT = Number(process.env.SIMPLEBEACON_PAID_API_LIMIT || 100);
const PAID_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

function isMonetizationEnabled() {
  if (process.env.SIMPLEBEACON_MONETIZATION_ENABLED === 'false') {
    return false;
  }
  if (process.env.SIMPLEBEACON_MONETIZATION_ENABLED === 'true') {
    return true;
  }
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

function defaultStore() {
  return { subscriptions: {}, byApiToken: {} };
}

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

async function writeStore(store) {
  await fs.promises.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.promises.writeFile(STORE_PATH, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function createApiToken() {
  return `sb_${crypto.randomBytes(24).toString('hex')}`;
}

function subscriptionRecord(email, overrides = {}) {
  const now = new Date().toISOString();
  return {
    email,
    subscriptionActive: false,
    stripeCustomerId: null,
    subscriptionId: null,
    apiToken: createApiToken(),
    apiCallsThisPeriod: 0,
    periodStart: now,
    updatedAt: now,
    ...overrides
  };
}

async function getSubscriptionByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const store = await readStore();
  return store.subscriptions[normalized] || null;
}

async function getSubscriptionByApiToken(token) {
  if (!token) return null;
  const store = await readStore();
  const email = store.byApiToken[token];
  if (!email) return null;
  return store.subscriptions[email] || null;
}

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

async function setSubscriptionActive(email, active, stripeFields = {}) {
  return upsertSubscription(email, {
    subscriptionActive: Boolean(active),
    ...stripeFields
  });
}

function resetPeriodIfNeeded(record) {
  const periodStart = record.periodStart ? Date.parse(record.periodStart) : 0;
  if (!periodStart || Date.now() - periodStart >= PAID_PERIOD_MS) {
    return {
      ...record,
      apiCallsThisPeriod: 0,
      periodStart: new Date().toISOString()
    };
  }
  return record;
}

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

function publicSubscriptionStatus(record) {
  if (!record) {
    return {
      tier: 'free',
      subscriptionActive: false,
      apiLimit: PAID_API_LIMIT
    };
  }

  const reset = resetPeriodIfNeeded(record);
  return {
    tier: reset.subscriptionActive ? 'paid' : 'free',
    email: reset.email,
    subscriptionActive: Boolean(reset.subscriptionActive),
    apiToken: reset.subscriptionActive ? reset.apiToken : null,
    apiLimit: PAID_API_LIMIT,
    apiCallsThisPeriod: reset.apiCallsThisPeriod,
    apiRemaining: Math.max(0, PAID_API_LIMIT - reset.apiCallsThisPeriod),
    periodStart: reset.periodStart
  };
}

module.exports = {
  STORE_PATH,
  PAID_API_LIMIT,
  isMonetizationEnabled,
  readStore,
  writeStore,
  getSubscriptionByEmail,
  getSubscriptionByApiToken,
  upsertSubscription,
  setSubscriptionActive,
  consumeApiCall,
  syncSubscriptionToDb,
  publicSubscriptionStatus,
  normalizeEmail
};
