'use strict';

/**
 * Audit Policy Store — Per-org retention policy configuration for the
 * audit ledger. Each org can configure:
 *   - retentionDays: How long to keep audit entries (default: 90)
 *   - maxEntries: Maximum number of entries to preserve (default: 10000)
 *   - archive: If true, purged entries are moved to an archive file
 *     before deletion (default: false)
 *
 * The store is persisted as a JSON file at AUDIT_POLICY_PATH (default:
 * .simplebeacon/audit-policy-store.json) with a map of orgId → policy.
 *
 * @module audit-policy-store
 */

const fs = require('fs');
const path = require('path');

const AUDIT_POLICY_PATH =
  process.env.AUDIT_POLICY_PATH ||
  path.join(process.cwd(), '.simplebeacon', 'audit-policy-store.json');

const DEFAULT_POLICY = {
  retentionDays: 90,
  maxEntries: 10000,
  archive: false,
};

let _cache = null;
let _cacheDirty = true;

function readStore() {
  if (_cache && !_cacheDirty) return _cache;
  try {
    if (fs.existsSync(AUDIT_POLICY_PATH)) {
      const raw = fs.readFileSync(AUDIT_POLICY_PATH, 'utf8');
      _cache = JSON.parse(raw);
      if (!_cache || typeof _cache !== 'object' || Array.isArray(_cache)) {
        _cache = {};
      }
    } else {
      _cache = {};
    }
  } catch {
    _cache = {};
  }
  _cacheDirty = false;
  return _cache;
}

function writeStore(store) {
  const dir = path.dirname(AUDIT_POLICY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = AUDIT_POLICY_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, AUDIT_POLICY_PATH);
  _cache = store;
  _cacheDirty = false;
}

/**
 * Get the retention policy for a specific org.
 * Falls back to DEFAULT_POLICY if no custom policy is set.
 * @param {string} orgId
 * @returns {{ retentionDays: number, maxEntries: number, archive: boolean }}
 */
function getPolicy(orgId) {
  const store = readStore();
  const policy = store[orgId];
  if (!policy) return { ...DEFAULT_POLICY };
  return {
    retentionDays: typeof policy.retentionDays === 'number' ? policy.retentionDays : DEFAULT_POLICY.retentionDays,
    maxEntries: typeof policy.maxEntries === 'number' ? policy.maxEntries : DEFAULT_POLICY.maxEntries,
    archive: typeof policy.archive === 'boolean' ? policy.archive : DEFAULT_POLICY.archive,
  };
}

/**
 * Set the retention policy for a specific org.
 * Validates all fields and persists to disk.
 * @param {string} orgId
 * @param {object} policy — { retentionDays?, maxEntries?, archive? }
 * @returns {{ success: boolean, error?: string, policy?: object }}
 */
function setPolicy(orgId, policy) {
  if (!orgId) return { success: false, error: 'orgId is required' };
  if (!policy || typeof policy !== 'object') return { success: false, error: 'policy must be an object' };

  const merged = { ...getPolicy(orgId) };

  if (policy.retentionDays !== undefined) {
    const days = parseInt(policy.retentionDays, 10);
    if (isNaN(days) || days < 1) {
      return { success: false, error: 'retentionDays must be a positive integer (>= 1)' };
    }
    merged.retentionDays = days;
  }

  if (policy.maxEntries !== undefined) {
    const max = parseInt(policy.maxEntries, 10);
    if (isNaN(max) || max < 100) {
      return { success: false, error: 'maxEntries must be an integer >= 100' };
    }
    merged.maxEntries = max;
  }

  if (policy.archive !== undefined) {
    if (typeof policy.archive !== 'boolean') {
      return { success: false, error: 'archive must be a boolean' };
    }
    merged.archive = policy.archive;
  }

  const store = readStore();
  store[orgId] = merged;
  writeStore(store);

  return { success: true, policy: merged };
}

/**
 * Get all configured org policies.
 * @returns {object} Map of orgId → policy
 */
function getAllPolicies() {
  const store = readStore();
  const result = {};
  for (const [orgId, policy] of Object.entries(store)) {
    result[orgId] = {
      retentionDays: typeof policy.retentionDays === 'number' ? policy.retentionDays : DEFAULT_POLICY.retentionDays,
      maxEntries: typeof policy.maxEntries === 'number' ? policy.maxEntries : DEFAULT_POLICY.maxEntries,
      archive: typeof policy.archive === 'boolean' ? policy.archive : DEFAULT_POLICY.archive,
    };
  }
  return result;
}

/**
 * Reset cache (for tests).
 */
function _resetCache() {
  _cache = null;
  _cacheDirty = true;
}

module.exports = {
  getPolicy,
  setPolicy,
  getAllPolicies,
  DEFAULT_POLICY,
  _resetCache,
  AUDIT_POLICY_PATH,
};
