/**
 * Root-down time token system.
 * - Account tokens are root-controlled (DB-backed via account-store).
 * - Time tokens reference an account_id; features/limits come from live account state.
 * - On every use, stale time tokens for the account are purged.
 */

'use strict';

const jwt = require('jsonwebtoken');
const { getPlan } = require('./plans.cjs');
const {
  createAccount,
  getAccount,
  createTimeToken,
  registerTimeTokenHash,
  validateTimeToken
} = require('./account-store.cjs');

const secret = process.env.SIMPLEBEACON_LICENSE_SECRET || '';

/**
 * Generate a time token for an account.
 * 1. Create root-controlled account (or reuse).
 * 2. Create time token entry bound to that account.
 * 3. Sign minimal JWT (account_id only — no embedded features/limits).
 * @param {string} accountType — 'starter', 'pro', 'enterprise', 'trial'
 * @param {Object} options
 * @param {string} [options.email]
 * @param {string} [options.period]
 * @param {number} [options.customTtlDays]
 * @returns {Object} { token, accountId, timeTokenId, meta }
 */
function generateTimeToken(accountType, options = {}) {
  if (!secret) throw new Error('SIMPLEBEACON_LICENSE_SECRET env var not set.');

  const plan = getPlan(accountType);
  if (!plan) throw new Error(`Unknown account type: ${accountType}`);

  const ttlDays = options.customTtlDays || plan.defaultTtlDays || 30;

  // Step 1: Reuse existing account or create new root-controlled account
  let accountId = options.accountId;
  if (!accountId) {
    const account = createAccount({
      email: options.email || '',
      tier: accountType
    });
    accountId = account.accountId;
  }

  // Step 2: Create time token entry bound to account
  const tt = createTimeToken(accountId, options.period || 'default', ttlDays);
  if (!tt.success) throw new Error(tt.error);

  // Step 3: Sign minimal JWT — only account_id, no embedded features/limits
  const payload = {
    sub: tt.timeTokenId,
    account_id: accountId,
    tier: accountType,
    period: options.period || 'default',
    email: options.email || ''
  };

  const expiresIn = ttlDays * 24 * 60 * 60;
  const token = jwt.sign(payload, secret, { expiresIn });

  // Step 4: Register hash so validateTimeToken can look it up
  registerTimeTokenHash(tt.timeTokenId, token);

  return {
    token,
    accountId,
    timeTokenId: tt.timeTokenId,
    meta: {
      accountType,
      tag: plan.tag,
      tier: accountType,
      period: options.period || 'default',
      ttlDays,
      issuedAt: new Date().toISOString(),
      expiresAt: tt.expiresAt
    }
  };
}

/**
 * Decode and validate a time token.
 * On every validation, stale time tokens for the account are purged.
 * Concurrent use from a different context is rejected.
 * @param {string} token
 * @param {Object} [context] — { ip, userAgent, deviceId }
 * @returns {Object} { valid, account, timeToken, error, stalePurged }
 */
function decodeTimeToken(token, context = {}) {
  try {
    jwt.verify(token, secret);
  } catch (err) {
    return { valid: false, account: null, timeToken: null, error: err.message, stalePurged: 0 };
  }

  // validateTimeToken checks live account state, purges stale tokens, enforces single-session
  const result = validateTimeToken(token, context);
  if (!result.valid) {
    return { valid: false, account: null, timeToken: null, error: result.error, stalePurged: result.stalePurged || 0 };
  }

  return {
    valid: true,
    account: result.account,
    timeToken: result.timeToken,
    error: null,
    stalePurged: result.stalePurged || 0
  };
}

/**
 * Check token status without full validation (no cleanup).
 * @param {string} token
 * @returns {Object} { active, expired, error }
 */
function getTokenStatus(token) {
  try {
    const decoded = jwt.verify(token, secret);
    return { active: true, expired: false, decoded, error: null };
  } catch (err) {
    return { active: false, expired: true, decoded: null, error: err.message };
  }
}

module.exports = { generateTimeToken, decodeTimeToken, getTokenStatus };
