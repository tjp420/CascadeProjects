'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH =
  process.env.AUDIT_LOG_PATH ||
  path.join(process.cwd(), '.simplebeacon', 'audit-log.json');
const MAX_ENTRIES_PER_ORG = 1000;
const GENESIS_HASH = '0'.repeat(64); // 64-char zero hash as chain genesis

/**
 * Compute the SHA-256 hash of a canonical string representation of an audit
 * entry (excluding the hash field itself). This creates a tamper-evident
 * chain where each entry's hash incorporates the previous entry's hash.
 * @param {object} entry — The audit entry (must NOT include the hash field)
 * @param {string} prevHash — The previous entry's hash (or GENESIS_HASH)
 * @returns {string} 64-char hex SHA-256 digest
 */
function computeEntryHash(entry, prevHash) {
  // Canonical payload: prevHash + all entry fields (excluding 'hash' and 'prevHash')
  // We use a stable JSON stringification by building the payload in a fixed
  // key order. JSON.stringify without a replacer preserves insertion order
  // and fully serializes nested objects.
  const payload = {
    prevHash,
    id: entry.id,
    orgId: entry.orgId,
    timestamp: entry.timestamp,
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    changes: entry.changes,
    metadata: entry.metadata,
  };
  // No replacer array — it strips nested object keys. Insertion order is
  // deterministic since we control the payload construction above.
  const canonical = JSON.stringify(payload);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Get the latest hash in the chain for a given org.
 * Used to link the next entry to the previous one.
 * @param {object} store — The full store object
 * @param {string} orgId — Tenant org ID
 * @returns {string} The latest entry's hash, or GENESIS_HASH if no entries
 */
function getLatestHash(store, orgId) {
  const orgEntries = Object.values(store.entries)
    .filter((e) => e.orgId === orgId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (orgEntries.length === 0) return GENESIS_HASH;
  return orgEntries[orgEntries.length - 1].hash || GENESIS_HASH;
}

function readStore() {
  try {
    if (!fs.existsSync(STORE_PATH)) return { entries: {} };
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { entries: {} };
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

// ── PII Scrubbing Integration ───────────────────────────────────────────────
//
// Audit log entries can contain PII in actorEmail, metadata, and changes
// fields. When AUDIT_LOG_SCRUB_PII is enabled (default), entries are
// scrubbed via pii-policy-store.redactText() before being written to disk
// and before the hash chain is computed. This ensures PII never persists
// in the audit log file.
//
// The scrubbing is applied per-org: the orgId from the entry is used to
// look up the org's PII policies. If no policies exist, the entry passes
// through unchanged.

let _piiPolicyStore = null;
let _scrubEnabled = process.env.AUDIT_LOG_SCRUB_PII !== 'false';

/**
 * Lazily load the PII policy store to avoid circular dependency issues.
 * @returns {object|null} The pii-policy-store module, or null if unavailable
 */
function _getPiiPolicyStore() {
  if (_piiPolicyStore === null) {
    try {
      _piiPolicyStore = require('./pii-policy-store.cjs');
    } catch {
      _piiPolicyStore = false; // Mark as unavailable
    }
  }
  return _piiPolicyStore || null;
}

/**
 * Scrub a string value using the org's PII policies.
 * @param {string} text — The text to scrub
 * @param {string} orgId — Org ID for policy lookup
 * @returns {string} Scrubbed text
 */
function _scrubString(text, orgId) {
  if (!text || typeof text !== 'string') return text;
  const store = _getPiiPolicyStore();
  if (!store) return text;
  const result = store.redactText(text, orgId);
  return result.text;
}

/**
 * Recursively scrub all string values in an object using PII policies.
 * @param {*} value — The value to scrub (string, object, array, or primitive)
 * @param {string} orgId — Org ID for policy lookup
 * @returns {*} Scrubbed value (same type as input)
 */
function _scrubValue(value, orgId) {
  if (typeof value === 'string') {
    return _scrubString(value, orgId);
  }
  if (Array.isArray(value)) {
    return value.map((v) => _scrubValue(v, orgId));
  }
  if (value && typeof value === 'object') {
    const scrubbed = {};
    for (const key of Object.keys(value)) {
      scrubbed[key] = _scrubValue(value[key], orgId);
    }
    return scrubbed;
  }
  return value;
}

/**
 * Scrub PII from an audit log entry before it is written to disk.
 * Scrubs: actorEmail, metadata, changes (including nested oldValue/newValue).
 * Does NOT scrub: id, orgId, timestamp, action, entity, entityId (structural).
 *
 * @param {object} entry — The audit entry to scrub (mutated in place)
 * @param {string} orgId — Org ID for PII policy lookup
 * @returns {object} The scrubbed entry (same reference as input)
 */
function scrubAuditEntry(entry, orgId) {
  if (!_scrubEnabled) return entry;

  // Scrub actorEmail — often contains the user's email address
  if (entry.actorEmail) {
    entry.actorEmail = _scrubString(entry.actorEmail, orgId);
  }

  // Scrub actorId — frequently set to the user's email
  if (entry.actorId) {
    entry.actorId = _scrubString(entry.actorId, orgId);
  }

  // Scrub metadata — can contain IPs, routes, arbitrary context with PII
  if (entry.metadata) {
    entry.metadata = _scrubValue(entry.metadata, orgId);
  }

  // Scrub changes — oldValue/newValue can contain PII
  if (Array.isArray(entry.changes)) {
    entry.changes = entry.changes.map((change) => ({
      field: change.field,
      oldValue: _scrubValue(change.oldValue, orgId),
      newValue: _scrubValue(change.newValue, orgId),
    }));
  }

  return entry;
}

/**
 * Compute a shallow deep-diff between old and new values.
 * Returns an array of { field, oldValue, newValue } entries.
 */
function computeDiff(oldVal, newVal) {
  if (!oldVal && !newVal) return [];
  if (!oldVal) return [{ field: '_entity', oldValue: null, newValue: newVal }];
  if (!newVal) return [{ field: '_entity', oldValue: oldVal, newValue: null }];

  const diffs = [];
  const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
  for (const key of allKeys) {
    // Skip volatile fields that change on every write
    if (key === 'updatedAt' || key === 'markedAt' || key === 'createdAt') continue;
    const ov = oldVal[key];
    const nv = newVal[key];
    if (JSON.stringify(ov) !== JSON.stringify(nv)) {
      diffs.push({ field: key, oldValue: ov ?? null, newValue: nv ?? null });
    }
  }
  return diffs;
}

/**
 * Record an audit log entry.
 * @param {object} params
 * @param {string} params.orgId — Tenant organization ID
 * @param {string} params.actorId — User ID from req.user
 * @param {string} params.actorEmail — User email from req.user
 * @param {string} params.action — Operation type: CREATE, UPDATE, DELETE, RUN, EVALUATE
 * @param {string} params.entity — Target entity type: ticket_status, webhook_config, report_schedule, deployment_gate_policy, deployment_gate_evaluation, scan_record
 * @param {string} params.entityId — Target entity identifier
 * @param {object} [params.oldValue] — Previous state (for UPDATE/DELETE)
 * @param {object} [params.newValue] — New state (for CREATE/UPDATE)
 * @param {string} [params.metadata] — Additional context (e.g., route path, IP)
 * @returns {object} The recorded audit entry
 */
function log(params) {
  const store = readStore();
  const id = `audit-${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date().toISOString();
  const orgId = params.orgId || 'default';

  const oldValue = params.oldValue || null;
  const newValue = params.newValue || null;
  const changes = computeDiff(oldValue, newValue);

  const entry = {
    id,
    orgId,
    timestamp: now,
    actorId: params.actorId || 'unknown',
    actorEmail: params.actorEmail || 'unknown',
    action: params.action || 'UPDATE',
    entity: params.entity || 'unknown',
    entityId: params.entityId || '',
    changes,
    metadata: params.metadata || null,
  };

  // Scrub PII from entry fields before computing hash and writing to disk.
  // The hash is computed over the scrubbed entry, so the chain remains
  // verifiable — verifyChain() recomputes hashes from the on-disk (scrubbed)
  // data, not from the original unscrubbed input.
  scrubAuditEntry(entry, orgId);

  // Compute hash chain link
  const prevHash = getLatestHash(store, orgId);
  entry.prevHash = prevHash;
  entry.hash = computeEntryHash(entry, prevHash);

  const key = makeKey(orgId, id);
  store.entries[key] = entry;

  // Prune: keep only the latest MAX_ENTRIES_PER_ORG per org
  const orgEntries = Object.entries(store.entries)
    .filter(([, v]) => v.orgId === orgId)
    .sort((a, b) => b[1].timestamp.localeCompare(a[1].timestamp));
  if (orgEntries.length > MAX_ENTRIES_PER_ORG) {
    for (const [k] of orgEntries.slice(MAX_ENTRIES_PER_ORG)) {
      delete store.entries[k];
    }
  }

  writeStore(store);
  return entry;
}

/**
 * Query audit log entries with optional filters.
 * @param {object} filters
 * @param {string} [filters.orgId] — Required: tenant scope
 * @param {string} [filters.action] — Filter by action type
 * @param {string} [filters.entity] — Filter by entity type
 * @param {string} [filters.actorId] — Filter by actor
 * @param {string} [filters.startDate] — ISO timestamp lower bound
 * @param {string} [filters.endDate] — ISO timestamp upper bound
 * @param {number} [filters.limit] — Max results (default 100, max 500)
 * @param {number} [filters.offset] — Pagination offset
 * @returns {{ entries: array, total: number, limit: number, offset: number }}
 */
function query(filters) {
  const store = readStore();
  const orgId = filters.orgId || 'default';
  let entries = Object.values(store.entries).filter(e => e.orgId === orgId);

  if (filters.action) entries = entries.filter(e => e.action === filters.action);
  if (filters.entity) entries = entries.filter(e => e.entity === filters.entity);
  if (filters.actorId) entries = entries.filter(e => e.actorId === filters.actorId);
  if (filters.startDate) entries = entries.filter(e => e.timestamp >= filters.startDate);
  if (filters.endDate) entries = entries.filter(e => e.timestamp <= filters.endDate);

  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const total = entries.length;
  const limit = Math.min(filters.limit || 100, 500);
  const offset = Math.max(filters.offset || 0, 0);
  entries = entries.slice(offset, offset + limit);

  return { entries, total, limit, offset };
}

/**
 * Get summary stats for an org's audit log.
 * @param {string} orgId
 * @returns {object} { total, byAction, byEntity, recentActors }
 */
function getStats(orgId) {
  const store = readStore();
  const scoped = Object.values(store.entries).filter(e => e.orgId === (orgId || 'default'));
  const byAction = {};
  const byEntity = {};
  const actorSet = new Map();

  for (const e of scoped) {
    byAction[e.action] = (byAction[e.action] || 0) + 1;
    byEntity[e.entity] = (byEntity[e.entity] || 0) + 1;
    if (!actorSet.has(e.actorId)) actorSet.set(e.actorId, { actorId: e.actorId, actorEmail: e.actorEmail, count: 0 });
    actorSet.get(e.actorId).count++;
  }

  const recentActors = [...actorSet.values()].sort((a, b) => b.count - a.count).slice(0, 10);

  return {
    total: scoped.length,
    byAction,
    byEntity,
    recentActors,
  };
}

/**
 * Verify the integrity of the audit log hash chain for a given org.
 * Checks that every entry's hash matches a recomputed hash, and that
 * each entry's prevHash matches the previous entry's hash.
 * @param {string} orgId — Tenant org ID
 * @returns {{ valid: boolean, totalEntries: number, verifiedEntries: number, brokenLinks: array, tamperedEntries: array }}
 */
function verifyChain(orgId) {
  const store = readStore();
  const scoped = Object.values(store.entries)
    .filter((e) => e.orgId === (orgId || 'default'))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const brokenLinks = [];
  const tamperedEntries = [];
  let expectedPrevHash = GENESIS_HASH;
  let verifiedEntries = 0;

  for (const entry of scoped) {
    // Check prevHash linkage
    if (entry.prevHash !== expectedPrevHash) {
      brokenLinks.push({
        id: entry.id,
        expected: expectedPrevHash,
        actual: entry.prevHash,
      });
    }

    // Recompute hash and compare
    const entryWithoutHash = { ...entry };
    delete entryWithoutHash.hash;
    const recomputed = computeEntryHash(entryWithoutHash, entry.prevHash);

    if (entry.hash !== recomputed) {
      tamperedEntries.push({
        id: entry.id,
        expected: recomputed,
        actual: entry.hash,
      });
    } else {
      verifiedEntries++;
    }

    expectedPrevHash = entry.hash;
  }

  return {
    valid: brokenLinks.length === 0 && tamperedEntries.length === 0,
    totalEntries: scoped.length,
    verifiedEntries,
    brokenLinks,
    tamperedEntries,
  };
}

module.exports = {
  log,
  query,
  getStats,
  computeDiff,
  verifyChain,
  computeEntryHash,
  scrubAuditEntry,
  GENESIS_HASH,
};
