'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { encrypt, decrypt, isEncrypted, encryptObject, decryptObject } = require('./crypto-utils.cjs');

const STORE_PATH = path.join(process.cwd(), '.simplebeacon', 'alert-rules.json');
const MAX_RULES_PER_ORG = 100;

const SENSITIVE_TOP_LEVEL = ['webhookUrl'];
const SENSITIVE_DEST_FIELDS = ['url', 'secret', 'routingKey', 'email', 'to', 'webhookUrl'];

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

module.exports = {
  EVENT_TYPES,
  DESTINATION_TYPES,
  getRule,
  getAllRules,
  setRule,
  deleteRule,
  updateFireStats,
  findMatchingRules,
};
