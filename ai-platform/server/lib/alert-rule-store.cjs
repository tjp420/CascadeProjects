'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { encrypt, decrypt, isEncrypted, encryptObject, decryptObject } = require('./crypto-utils.cjs');

const STORE_PATH = path.join(process.cwd(), '.simplebeacon', 'alert-rules.json');
const MAX_RULES_PER_ORG = 100;

const SENSITIVE_TOP_LEVEL = ['webhookUrl'];
const SENSITIVE_DEST_FIELDS = ['url', 'secret', 'previousSecret', 'routingKey', 'email', 'to', 'webhookUrl'];

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { rules: {} };
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const store = JSON.parse(raw);
    // Migrate: encrypt any plaintext sensitive fields in existing rules
    let migrated = false;
    for (const key of Object.keys(store.rules || {})) {
      const rule = store.rules[key];
      for (const field of SENSITIVE_TOP_LEVEL) {
        if (rule[field] && !isEncrypted(rule[field])) {
          rule[field] = encrypt(rule[field]);
          migrated = true;
        }
      }
      if (rule.destination && typeof rule.destination === 'object') {
        for (const field of SENSITIVE_DEST_FIELDS) {
          if (rule.destination[field] && !isEncrypted(rule.destination[field])) {
            rule.destination[field] = encrypt(rule.destination[field]);
            migrated = true;
          }
        }
      }
    }
    if (migrated) writeStore(store);
    return store;
  } catch {
    return { rules: {} };
  }
}

function writeStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function makeKey(orgId, id) {
  return orgId ? `${orgId}::${id}` : id;
}

// ── Rule CRUD ───────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  'critical_finding',
  'sla_breached',
  'gate_failed',
  'guardrail_blocked',
  'audit_delete',
  'eval_failure',
  'audit_chain_broken',
  'guardrail_anomaly_spike',
];

const DESTINATION_TYPES = ['webhook', 'slack', 'email', 'pagerduty'];

function decryptRule(rule) {
  if (!rule) return null;
  let result = { ...rule };
  for (const field of SENSITIVE_TOP_LEVEL) {
    if (result[field] && isEncrypted(result[field])) {
      result[field] = decrypt(result[field]);
    }
  }
  if (result.destination && typeof result.destination === 'object') {
    result.destination = { ...result.destination };
    for (const field of SENSITIVE_DEST_FIELDS) {
      if (result.destination[field] && isEncrypted(result.destination[field])) {
        result.destination[field] = decrypt(result.destination[field]);
      }
    }
  }
  return result;
}

function getRule(ruleId, orgId) {
  const store = readStore();
  return decryptRule(store.rules[makeKey(orgId, ruleId)] || null);
}

function getAllRules(orgId) {
  const store = readStore();
  return Object.values(store.rules)
    .filter((r) => r.orgId === orgId)
    .map(decryptRule);
}

function setRule(ruleId, rule, orgId) {
  const store = readStore();
  const key = makeKey(orgId, ruleId);
  const existing = store.rules[key];
  // Encrypt sensitive fields at rest
  const webhookUrl = rule.webhookUrl ? encrypt(rule.webhookUrl) : '';
  let destination = {};
  if (rule.destination && typeof rule.destination === 'object') {
    destination = { ...rule.destination };
    for (const field of SENSITIVE_DEST_FIELDS) {
      if (destination[field] && !isEncrypted(destination[field])) {
        destination[field] = encrypt(destination[field]);
      }
    }
  }
  store.rules[key] = {
    id: ruleId,
    orgId,
    name: rule.name || 'Untitled Rule',
    enabled: rule.enabled !== false,
    eventType: rule.eventType || 'critical_finding',
    destinationType: rule.destinationType || 'webhook',
    webhookUrl,
    destination,
    threshold: rule.threshold || 1,
    cooldownMinutes: rule.cooldownMinutes || 0,
    severityFilter: rule.severityFilter || 'all',
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastFiredAt: null,
    fireCount: existing?.fireCount || 0,
  };
  // Prune
  const orgRules = Object.entries(store.rules)
    .filter(([, v]) => v.orgId === orgId)
    .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt));
  if (orgRules.length > MAX_RULES_PER_ORG) {
    for (const [k] of orgRules.slice(MAX_RULES_PER_ORG)) {
      delete store.rules[k];
    }
  }
  writeStore(store);
  return decryptRule(store.rules[key]);
}

function deleteRule(ruleId, orgId) {
  const store = readStore();
  delete store.rules[makeKey(orgId, ruleId)];
  writeStore(store);
}

function updateFireStats(ruleId, orgId) {
  const store = readStore();
  const key = makeKey(orgId, ruleId);
  if (store.rules[key]) {
    store.rules[key].fireCount = (store.rules[key].fireCount || 0) + 1;
    store.rules[key].lastFiredAt = new Date().toISOString();
    writeStore(store);
  }
}

/**
 * Find rules matching an event for a given org.
 * Checks event type, enabled flag, severity filter, and cooldown.
 */
function findMatchingRules(orgId, eventType, context) {
  const store = readStore();
  const rules = Object.values(store.rules)
    .filter((r) => {
      if (r.orgId !== orgId) return false;
      if (!r.enabled) return false;
      if (r.eventType !== eventType) return false;
      // Severity filter
      if (r.severityFilter && r.severityFilter !== 'all') {
        if (context?.severity && context.severity !== r.severityFilter) return false;
      }
      // Cooldown check
      if (r.cooldownMinutes > 0 && r.lastFiredAt) {
        const elapsed = (Date.now() - new Date(r.lastFiredAt).getTime()) / 60000;
        if (elapsed < r.cooldownMinutes) return false;
      }
      return true;
    })
    .map(decryptRule);
  return rules;
}

// ── Webhook Secret Rotation ─────────────────────────────────────────────────

/**
 * Default grace window for key rotation: 24 hours.
 * During this window, the previous secret is still available for signature
 * verification so receivers can update their configured secret without
 * dropping alerts.
 */
const DEFAULT_GRACE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Rotate the webhook signing secret for a rule.
 *
 * Stores the current secret as `previousSecret` with a `secretRotatedAt`
 * timestamp, then sets the new secret as the active one. During the grace
 * window, the dispatcher sends both the new and previous signatures so
 * receivers can verify with either key.
 *
 * @param {string} ruleId
 * @param {string} orgId
 * @param {string} newSecret — the new HMAC secret (plaintext, will be encrypted at rest)
 * @returns {{ success: boolean, rule?: object, error?: string }}
 */
function rotateSecret(ruleId, orgId, newSecret) {
  if (!newSecret || typeof newSecret !== 'string') {
    return { success: false, error: 'newSecret is required' };
  }
  if (newSecret.length < 16) {
    return { success: false, error: 'newSecret must be at least 16 characters' };
  }

  const store = readStore();
  const key = makeKey(orgId, ruleId);
  const rule = store.rules[key];
  if (!rule) return { success: false, error: 'Rule not found' };

  // Decrypt current secret to move it to previousSecret
  const currentDecrypted = rule.destination?.secret && isEncrypted(rule.destination.secret)
    ? decrypt(rule.destination.secret)
    : (rule.destination?.secret || '');

  // Ensure destination object exists
  if (!rule.destination || typeof rule.destination !== 'object') {
    rule.destination = {};
  }

  // Move current secret to previous
  if (currentDecrypted) {
    rule.destination.previousSecret = encrypt(currentDecrypted);
  }
  rule.destination.secret = encrypt(newSecret);
  rule.destination.secretRotatedAt = new Date().toISOString();
  rule.updatedAt = new Date().toISOString();

  writeStore(store);
  return { success: true, rule: decryptRule(rule) };
}

/**
 * Get the rotation status for a rule — whether a grace window is active,
 * when it expires, and whether the previous secret is still available.
 * @param {string} ruleId
 * @param {string} orgId
 * @param {number} graceWindowMs — override the default grace window
 * @returns {{ hasPreviousSecret: boolean, rotatedAt: string|null, graceWindowEndsAt: string|null, graceActive: boolean, graceWindowMs: number }}
 */
function getRotationStatus(ruleId, orgId, graceWindowMs) {
  const gw = graceWindowMs || DEFAULT_GRACE_WINDOW_MS;
  const rule = getRule(ruleId, orgId);
  if (!rule) {
    return { hasPreviousSecret: false, rotatedAt: null, graceWindowEndsAt: null, graceActive: false, graceWindowMs: gw };
  }
  const rotatedAt = rule.destination?.secretRotatedAt || null;
  const hasPrevious = Boolean(rule.destination?.previousSecret);
  let graceWindowEndsAt = null;
  let graceActive = false;
  if (rotatedAt) {
    const expires = new Date(rotatedAt).getTime() + gw;
    graceWindowEndsAt = new Date(expires).toISOString();
    graceActive = hasPrevious && Date.now() < expires;
  }
  return {
    hasPreviousSecret: hasPrevious,
    rotatedAt,
    graceWindowEndsAt,
    graceActive,
    graceWindowMs: gw,
  };
}

/**
 * Clear the previous secret after the grace window expires (or manually).
 * Once cleared, only the current secret will be used for signing.
 * @param {string} ruleId
 * @param {string} orgId
 * @param {boolean} force — if true, clear even if grace window is still active
 * @returns {{ success: boolean, cleared: boolean, error?: string }}
 */
function clearPreviousSecret(ruleId, orgId, force) {
  const store = readStore();
  const key = makeKey(orgId, ruleId);
  const rule = store.rules[key];
  if (!rule) return { success: false, cleared: false, error: 'Rule not found' };

  if (!rule.destination?.previousSecret) {
    return { success: true, cleared: false };
  }

  if (!force) {
    const status = getRotationStatus(ruleId, orgId);
    if (status.graceActive) {
      return {
        success: false,
        cleared: false,
        error: `Grace window still active (expires ${status.graceWindowEndsAt}). Use force=true to override.`,
      };
    }
  }

  delete rule.destination.previousSecret;
  delete rule.destination.secretRotatedAt;
  rule.updatedAt = new Date().toISOString();
  writeStore(store);
  return { success: true, cleared: true };
}

/**
 * Generate a cryptographically random secret suitable for HMAC signing.
 * @param {number} bytes — number of random bytes (default 32 = 256 bits)
 * @returns {string} hex-encoded secret
 */
function generateSecret(bytes) {
  return crypto.randomBytes(bytes || 32).toString('hex');
}

module.exports = {
  EVENT_TYPES,
  DESTINATION_TYPES,
  getRule,
  getAllRules,
  setRule,
  deleteRule,
  updateFireStats,
  findMatchingRules,
  rotateSecret,
  getRotationStatus,
  clearPreviousSecret,
  generateSecret,
  DEFAULT_GRACE_WINDOW_MS,
};
