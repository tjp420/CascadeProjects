'use strict';

/**
 * Audit Policy Store — Configurable retention and archiving policies per org.
 *
 * Policies control how long audit entries are kept before automatic
 * archival or deletion. Each org can override the system defaults.
 *
 * @module audit-policy-store
 */

const fs = require('fs');
const path = require('path');

const POLICY_STORE_PATH =
  process.env.AUDIT_POLICY_PATH ||
  path.join(process.cwd(), '.simplebeacon', 'audit-policies.json');

const DEFAULT_POLICY = {
  retentionDays: 90,
  maxEntries: 5000,
  archiveEnabled: true,
  archiveAfterDays: 60,
};

let _cache = null;
let _cacheDirty = true;

function readPolicyStore() {
  if (_cache && !_cacheDirty) return _cache;
  try {
    if (!fs.existsSync(POLICY_STORE_PATH)) {
      _cache = { orgs: {} };
    } else {
      const raw = fs.readFileSync(POLICY_STORE_PATH, 'utf8');
      _cache = JSON.parse(raw);
      if (!_cache.orgs || typeof _cache.orgs !== 'object') {
        _cache = { orgs: {} };
      }
    }
  } catch {
    _cache = { orgs: {} };
  }
  _cacheDirty = false;
  return _cache;
}

function writePolicyStore(store) {
  const dir = path.dirname(POLICY_STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = POLICY_STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, POLICY_STORE_PATH);
  _cache = store;
  _cacheDirty = false;
}

/**
 * Get the effective audit policy for an org (merged with defaults).
 * @param {string} orgId
 * @returns {object} { retentionDays, maxEntries, archiveEnabled, archiveAfterDays }
 */
function getPolicy(orgId) {
  const store = readPolicyStore();
  const orgPolicy = store.orgs[orgId] || {};
  return { ...DEFAULT_POLICY, ...orgPolicy };
}

/**
 * Update the audit policy for an org.
 * @param {string} orgId
 * @param {object} updates — Partial policy fields to merge
 * @returns {object} The updated policy
 */
function setPolicy(orgId, updates) {
  const store = readPolicyStore();
  const current = store.orgs[orgId] || {};
  const merged = { ...DEFAULT_POLICY, ...current };

  if (typeof updates.retentionDays === 'number') {
    merged.retentionDays = Math.max(1, Math.min(updates.retentionDays, 3650));
  }
  if (typeof updates.maxEntries === 'number') {
    merged.maxEntries = Math.max(100, Math.min(updates.maxEntries, 100000));
  }
  if (typeof updates.archiveEnabled === 'boolean') {
    merged.archiveEnabled = updates.archiveEnabled;
  }
  if (typeof updates.archiveAfterDays === 'number') {
    merged.archiveAfterDays = Math.max(1, Math.min(updates.archiveAfterDays, 3650));
  }

  store.orgs[orgId] = merged;
  writePolicyStore(store);
  return merged;
}

/**
 * Reset the audit policy for an org back to defaults.
 * @param {string} orgId
 * @returns {object} The default policy
 */
function resetPolicy(orgId) {
  const store = readPolicyStore();
  delete store.orgs[orgId];
  writePolicyStore(store);
  return { ...DEFAULT_POLICY };
}

/**
 * Get all org policies (for admin overview).
 * @returns {object} Map of orgId -> policy
 */
function getAllPolicies() {
  const store = readPolicyStore();
  return store.orgs;
}

/**
 * Compute the archive path for an org.
 * @param {string} orgId
 * @returns {string} Absolute path to the archive file
 */
function getArchivePath(orgId) {
  const dir = path.join(process.cwd(), '.simplebeacon', 'audit-archive');
  return path.join(dir, `audit-archive-${orgId}.json`);
}

module.exports = {
  getPolicy,
  setPolicy,
  resetPolicy,
  getAllPolicies,
  getArchivePath,
  DEFAULT_POLICY,
  POLICY_STORE_PATH,
};
