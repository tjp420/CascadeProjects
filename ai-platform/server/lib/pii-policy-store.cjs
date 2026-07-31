'use strict';

/**
 * PII Redaction Policy Store — Persistent per-organization custom
 * regex-based PII masking patterns for inbound prompt data.
 *
 * Admins can define custom regex patterns that are applied to prompt
 * text before it reaches upstream LLM models, in addition to the
 * built-in PII patterns in prompt-firewall.cjs.
 *
 * @module pii-policy-store
 */

const fs = require('fs');
const path = require('path');

const PII_POLICY_PATH =
  process.env.PII_POLICY_PATH || path.join(__dirname, '../../.simplebeacon', 'pii-policies.json');

let _cache = null;
let _cacheDirty = true;

/**
 * @typedef {object} PiiPolicy
 * @property {string} id          — Unique identifier
 * @property {string} orgId       — Organization ID
 * @property {string} name        — Human-readable name (e.g. "Employee ID")
 * @property {string} description — What this pattern detects
 * @property {string} pattern     — Regex pattern string
 * @property {string} flags       — Regex flags (e.g. 'gi')
 * @property {string} replacement — Replacement text (e.g. '[REDACTED-EMP-ID]')
 * @property {'high'|'medium'|'low'} severity — Severity level
 * @property {boolean} enabled    — Whether this policy is active
 * @property {string} createdAt   — ISO timestamp
 * @property {string} updatedAt   — ISO timestamp
 */

function readStore() {
  if (_cache && !_cacheDirty) return _cache;
  try {
    const raw = fs.readFileSync(PII_POLICY_PATH, 'utf8');
    _cache = JSON.parse(raw);
    if (!_cache.policies || !Array.isArray(_cache.policies)) {
      _cache = { policies: [] };
    }
  } catch {
    _cache = { policies: [] };
  }
  _cacheDirty = false;
  return _cache;
}

function writeStore(store) {
  const dir = path.dirname(PII_POLICY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = PII_POLICY_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, PII_POLICY_PATH);
  _cache = store;
  _cacheDirty = false;
}

function generateId() {
  return 'pii-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/**
 * Validate a regex pattern string.
 * @param {string} pattern
 * @param {string} flags
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateRegex(pattern, flags) {
  if (!pattern || typeof pattern !== 'string') {
    return { valid: false, error: 'Pattern is required' };
  }
  try {
    new RegExp(pattern, flags || '');
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: `Invalid regex: ${err.message}` };
  }
}

/**
 * Get all PII policies for an organization.
 * @param {string} orgId
 * @param {boolean} enabledOnly — If true, return only enabled policies
 * @returns {PiiPolicy[]}
 */
function getPolicies(orgId, enabledOnly = false) {
  const store = readStore();
  return store.policies.filter(
    (p) => p.orgId === orgId && (!enabledOnly || p.enabled)
  );
}

/**
 * Get a specific PII policy by ID.
 * @param {string} id
 * @returns {PiiPolicy|null}
 */
function getPolicy(id) {
  const store = readStore();
  return store.policies.find((p) => p.id === id) || null;
}

/**
 * Create a new PII redaction policy.
 * @param {object} params
 * @returns {{ success: boolean, policy?: PiiPolicy, error?: string }}
 */
function createPolicy(params) {
  const { orgId, name, description, pattern, flags, replacement, severity, enabled } = params;

  if (!orgId) return { success: false, error: 'orgId is required' };
  if (!name || typeof name !== 'string') return { success: false, error: 'name is required' };
  if (!replacement || typeof replacement !== 'string')
    return { success: false, error: 'replacement is required' };

  const regexFlags = flags || 'gi';
  const validation = validateRegex(pattern, regexFlags);
  if (!validation.valid) return { success: false, error: validation.error };

  const validSeverities = ['high', 'medium', 'low'];
  const sev = validSeverities.includes(severity) ? severity : 'medium';

  const store = readStore();
  const now = new Date().toISOString();
  const policy = {
    id: generateId(),
    orgId,
    name: name.trim(),
    description: (description || '').trim(),
    pattern,
    flags: regexFlags,
    replacement,
    severity: sev,
    enabled: enabled !== false,
    createdAt: now,
    updatedAt: now,
  };

  store.policies.push(policy);
  writeStore(store);
  return { success: true, policy };
}

/**
 * Update an existing PII policy.
 * @param {string} id
 * @param {object} updates
 * @returns {{ success: boolean, policy?: PiiPolicy, error?: string }}
 */
function updatePolicy(id, updates) {
  const store = readStore();
  const idx = store.policies.findIndex((p) => p.id === id);
  if (idx === -1) return { success: false, error: 'Policy not found' };

  const policy = store.policies[idx];

  if (updates.pattern !== undefined) {
    const validation = validateRegex(updates.pattern, updates.flags || policy.flags);
    if (!validation.valid) return { success: false, error: validation.error };
  }

  if (updates.severity !== undefined) {
    const validSeverities = ['high', 'medium', 'low'];
    if (!validSeverities.includes(updates.severity)) {
      return { success: false, error: 'Invalid severity' };
    }
  }

  const updated = {
    ...policy,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  store.policies[idx] = updated;
  writeStore(store);
  return { success: true, policy: updated };
}

/**
 * Delete a PII policy.
 * @param {string} id
 * @returns {boolean}
 */
function deletePolicy(id) {
  const store = readStore();
  const idx = store.policies.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  store.policies.splice(idx, 1);
  writeStore(store);
  return true;
}

/**
 * Get compiled regex patterns for an organization.
 * Returns an array of { id, name, regex, replacement, severity, description }
 * ready for the redaction engine to apply.
 * @param {string} orgId
 * @returns {Array}
 */
function getCompiledPatterns(orgId) {
  const policies = getPolicies(orgId, true);
  const compiled = [];
  for (const p of policies) {
    try {
      const regex = new RegExp(p.pattern, p.flags);
      compiled.push({
        id: p.id,
        name: p.name,
        regex,
        replacement: p.replacement,
        severity: p.severity,
        description: p.description,
      });
    } catch {
      // Skip invalid patterns silently
    }
  }
  return compiled;
}

/**
 * Apply custom PII redaction patterns to text.
 * Returns { text, matches } where matches describes what was redacted.
 * @param {string} text
 * @param {string} orgId
 * @returns {{ text: string, matches: Array }}
 */
function redactText(text, orgId) {
  if (!text || typeof text !== 'string') return { text, matches: [] };

  const patterns = getCompiledPatterns(orgId);
  if (patterns.length === 0) return { text, matches: [] };

  let redactedText = text;
  const matches = [];

  for (const p of patterns) {
    const regex = new RegExp(p.regex.source, p.regex.flags);
    const found = regex.test(text);
    if (found) {
      const count = (text.match(new RegExp(p.regex.source, p.regex.flags)) || []).length;
      redactedText = redactedText.replace(new RegExp(p.regex.source, p.regex.flags), p.replacement);
      matches.push({
        type: 'custom_pii',
        id: p.id,
        name: p.name,
        severity: p.severity,
        desc: p.description || p.name,
        count,
      });
    }
  }

  return { text: redactedText, matches };
}

/**
 * Get stats for dashboard.
 * @param {string} orgId
 * @returns {{ totalPolicies: number, enabledPolicies: number, bySeverity: object }}
 */
function getStats(orgId) {
  const policies = getPolicies(orgId);
  const bySeverity = { high: 0, medium: 0, low: 0 };
  let enabled = 0;
  for (const p of policies) {
    bySeverity[p.severity] = (bySeverity[p.severity] || 0) + 1;
    if (p.enabled) enabled++;
  }
  return {
    totalPolicies: policies.length,
    enabledPolicies: enabled,
    bySeverity,
  };
}

module.exports = {
  getPolicies,
  getPolicy,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getCompiledPatterns,
  redactText,
  getStats,
  validateRegex,
  PII_POLICY_PATH,
};
