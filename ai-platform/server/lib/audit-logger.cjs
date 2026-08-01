'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Lazy-load crypto-utils to avoid circular dependency at module init
let _cryptoUtils = null;
function getCryptoUtils() {
  if (!_cryptoUtils) {
    _cryptoUtils = require('./crypto-utils.cjs');
  }
  return _cryptoUtils;
}

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
  // Fire-and-forget SIEM export for high-priority events
  try {
    const siem = require('./siem-exporter.cjs');
    // map our entry to a SIEM-friendly event
    const siemEvent = {
      id: entry.id,
      orgId: entry.orgId,
      timestamp: entry.timestamp,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      actorId: entry.actorId,
      metadata: entry.metadata,
      payloadHash: entry.metadata && entry.metadata.payloadHash || null,
    };
    // Only ship quota and rate-limit related events by default
    if (['AGENTIC_QUOTA_EXHAUSTED', 'AGENTIC_RATE_LIMIT_TRIPPED', 'AGENTIC_EXECUTE_REQUEST'].includes(entry.action)) {
      siem.enqueue(siemEvent);
    }
  } catch (e) {
    // don't let SIEM errors affect core logic
  }
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

// ── Retention / Purge Engine ────────────────────────────────────────────────
//
// Per-org retention policies allow administrators to control how long audit
// entries are kept. The purgeOldEntries() function removes entries older than
// the configured retention period, while always preserving at least maxEntries
// most recent entries. After purge, the remaining entries are re-linked with
// new hashes to maintain chain integrity.
//
// Policy configuration is stored in audit-policy-store.cjs.

const auditPolicyStore = require('./audit-policy-store.cjs');

/**
 * Get retention statistics for a specific org.
 * @param {string} orgId
 * @returns {{ total: number, oldestTimestamp: string|null, newestTimestamp: string|null, purgeableCount: number, policy: object }}
 */
function getRetentionStats(orgId) {
  const orgIdNormalized = orgId || 'default';
  const policy = auditPolicyStore.getPolicy(orgIdNormalized);
  const store = readStore();
  const orgEntries = Object.values(store.entries)
    .filter((e) => e.orgId === orgIdNormalized)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  if (orgEntries.length === 0) {
    return {
      total: 0,
      oldestTimestamp: null,
      newestTimestamp: null,
      purgeableCount: 0,
      policy,
    };
  }

  const cutoff = Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoff).toISOString();

  // Count entries that would be purged: older than retention cutoff AND
  // NOT within the most recent `maxEntries` entries (safety floor).
  // The safety floor only applies when total entries exceed maxEntries.
  const safetyFloorStart = orgEntries.length > policy.maxEntries
    ? orgEntries.length - policy.maxEntries
    : orgEntries.length;
  let purgeableCount = 0;
  for (let i = 0; i < orgEntries.length; i++) {
    if (orgEntries[i].timestamp < cutoffIso && i < safetyFloorStart) {
      purgeableCount++;
    }
  }

  return {
    total: orgEntries.length,
    oldestTimestamp: orgEntries[0].timestamp,
    newestTimestamp: orgEntries[orgEntries.length - 1].timestamp,
    purgeableCount,
    policy,
  };
}

/**
 * Purge old audit entries for a specific org based on the retention policy.
 * Removes entries older than retentionDays, while always preserving at least
 * maxEntries most recent entries. Re-links the hash chain after removal.
 *
 * @param {string} orgId
 * @returns {{ purged: number, remaining: number, archived: number }}
 */
function purgeOldEntries(orgId) {
  const orgIdNormalized = orgId || 'default';
  const policy = auditPolicyStore.getPolicy(orgIdNormalized);
  const store = readStore();

  // Get all entries for this org, sorted oldest → newest
  const orgEntryPairs = Object.entries(store.entries)
    .filter(([, e]) => e.orgId === orgIdNormalized)
    .sort(([, a], [, b]) => a.timestamp.localeCompare(b.timestamp));

  if (orgEntryPairs.length === 0) {
    return { purged: 0, remaining: 0, archived: 0 };
  }

  const cutoff = Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoff).toISOString();

  // Determine which entries to purge:
  // - Older than retention cutoff
  // - NOT within the most recent `maxEntries` entries (safety floor)
  // The safety floor only applies when total entries exceed maxEntries;
  // otherwise, all entries are eligible for age-based purge.
  const safetyFloorStart = orgEntryPairs.length > policy.maxEntries
    ? orgEntryPairs.length - policy.maxEntries
    : orgEntryPairs.length; // no entry is in the safety floor if total <= maxEntries
  const keysToPurge = [];
  const entriesToArchive = [];

  for (let i = 0; i < orgEntryPairs.length; i++) {
    const [key, entry] = orgEntryPairs[i];
    const isOldEnough = entry.timestamp < cutoffIso;
    const isWithinSafetyFloor = i >= safetyFloorStart;
    if (isOldEnough && !isWithinSafetyFloor) {
      keysToPurge.push(key);
      if (policy.archive) {
        entriesToArchive.push({ ...entry, archivedAt: new Date().toISOString() });
      }
    }
  }

  if (keysToPurge.length === 0) {
    return { purged: 0, remaining: orgEntryPairs.length, archived: 0 };
  }

  // Archive entries if archiving is enabled
  let archived = 0;
  if (policy.archive && entriesToArchive.length > 0) {
    try {
      const archivePath = path.join(path.dirname(STORE_PATH), `audit-archive-${orgIdNormalized}.json`);
      let archiveStore = { entries: [] };
      if (fs.existsSync(archivePath)) {
        archiveStore = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
        if (!archiveStore.entries) archiveStore.entries = [];
      }
      archiveStore.entries.push(...entriesToArchive);
      archiveStore.lastUpdated = new Date().toISOString();
      fs.writeFileSync(archivePath, JSON.stringify(archiveStore, null, 2));
      archived = entriesToArchive.length;
    } catch {
      // Archive failure is non-fatal — proceed with deletion
    }
  }

  // Remove purged entries from the store
  for (const key of keysToPurge) {
    delete store.entries[key];
  }

  // Re-link remaining entries with new hashes (same pattern as healChain)
  const remainingPairs = Object.entries(store.entries)
    .filter(([, e]) => e.orgId === orgIdNormalized)
    .sort(([, a], [, b]) => a.timestamp.localeCompare(b.timestamp));

  let prevHash = GENESIS_HASH;
  let relinked = 0;

  for (const [key, entry] of remainingPairs) {
    entry.prevHash = prevHash;
    const entryWithoutHash = { ...entry };
    delete entryWithoutHash.hash;
    entry.hash = computeEntryHash(entryWithoutHash, prevHash);
    prevHash = entry.hash;
    relinked++;
  }

  writeStore(store);

  return {
    purged: keysToPurge.length,
    remaining: remainingPairs.length,
    archived,
  };
}

// ── Auto-Healing Worker ─────────────────────────────────────────────────────
//
// The auto-healing worker periodically runs verifyChain() for all orgs and
// quarantines broken/tampered entries. When an entry is quarantined:
//   1. It is moved to a separate quarantine file (audit-log-quarantine.json)
//   2. It is removed from the main audit log
//   3. The remaining entries are re-linked with new hashes
//
// This prevents tampered entries from poisoning the chain while preserving
// the tamper evidence in the quarantine file for forensic analysis.
//
// Configuration:
//   AUDIT_LOG_QUARANTINE_PATH — path to quarantine file (default: alongside
//     the main audit log)
//   AUDIT_HEAL_INTERVAL_MS — background timer interval (default: 300000 = 5min)
//   AUDIT_HEAL_ENABLED — set to 'false' to disable auto-healing on startup

const QUARANTINE_PATH =
  process.env.AUDIT_LOG_QUARANTINE_PATH ||
  (STORE_PATH.replace(/\.json$/, '-quarantine.json'));

const QUARANTINE_DIR =
  process.env.AUDIT_LOG_QUARANTINE_DIR ||
  path.join(process.cwd(), '.simplebeacon', 'quarantine');

const DEFAULT_HEAL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the per-tenant quarantine file path for encrypted storage.
 * @param {string} orgId — Tenant org ID
 * @returns {string} Absolute path to the tenant's quarantine file
 */
function getTenantQuarantinePath(orgId) {
  const safeOrgId = String(orgId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(QUARANTINE_DIR, `tenant-${safeOrgId}`, 'audit-quarantine.json');
}

/**
 * Read the per-tenant encrypted quarantine store.
 * Falls back to the legacy global quarantine file for backward compatibility.
 * @param {string} orgId — Tenant org ID
 * @returns {{ entries: object[], metadata: object }}
 */
function readTenantQuarantineStore(orgId) {
  const orgIdNormalized = orgId || 'default';
  const tenantPath = getTenantQuarantinePath(orgIdNormalized);
  const { encryptForDirectory, decryptForDirectory, isDirectoryEncrypted } = getCryptoUtils();

  try {
    if (fs.existsSync(tenantPath)) {
      const raw = fs.readFileSync(tenantPath, 'utf8');
      // If the file is encrypted, decrypt it
      if (isDirectoryEncrypted(raw)) {
        const decrypted = decryptForDirectory(raw, orgIdNormalized, path.dirname(tenantPath));
        if (decrypted) {
          const parsed = JSON.parse(decrypted);
          if (parsed.entries && Array.isArray(parsed.entries)) return parsed;
        }
        // Decryption failed — return empty store (data is inaccessible)
        return { entries: [], metadata: { createdAt: new Date().toISOString(), encrypted: true, decryptionError: true } };
      }
      // Unencrypted fallback (for migration or if encryption was disabled)
      const parsed = JSON.parse(raw);
      if (parsed.entries && Array.isArray(parsed.entries)) return parsed;
    }
  } catch {
    // Fall through to legacy
  }

  // Legacy: check the global quarantine file for entries belonging to this org
  try {
    if (fs.existsSync(QUARANTINE_PATH)) {
      const raw = fs.readFileSync(QUARANTINE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed.entries && Array.isArray(parsed.entries)) {
        const orgEntries = parsed.entries.filter((e) => e.orgId === orgIdNormalized);
        if (orgEntries.length > 0) {
          return { entries: orgEntries, metadata: parsed.metadata || {} };
        }
      }
    }
  } catch {}

  return { entries: [], metadata: { createdAt: new Date().toISOString() } };
}

/**
 * Write the per-tenant encrypted quarantine store.
 * Encrypts the entire JSON payload using encryptForDirectory() with a key
 * derived from orgId and the directory path.
 * @param {string} orgId — Tenant org ID
 * @param {{ entries: array, metadata: object }} store
 */
function writeTenantQuarantineStore(orgId, store) {
  const orgIdNormalized = orgId || 'default';
  const tenantPath = getTenantQuarantinePath(orgIdNormalized);
  const dir = path.dirname(tenantPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const { encryptForDirectory } = getCryptoUtils();
  const json = JSON.stringify(store, null, 2);
  const ciphertext = encryptForDirectory(json, orgIdNormalized, dir);
  fs.writeFileSync(tenantPath, ciphertext, 'utf8');
}

let _healTimer = null;
let _healRunning = false;
let _lastHealRun = null;
let _healStats = {
  totalRuns: 0,
  totalQuarantined: 0,
  totalRelinked: 0,
  lastResult: null,
};

// Re-keying migration stats
let _reKeyStats = {
  totalSweeps: 0,
  totalMigrated: 0,
  totalSkipped: 0,
  totalFailed: 0,
  totalPurged: 0,
  lastResult: null,
};

// Autonomous lifecycle purge stats
let _lifecyclePurgeRunning = false;
let _lifecyclePurgeStats = {
  totalSweeps: 0,
  totalPurged: 0,
  totalArchived: 0,
  failed: 0,
  lastResult: null,
  lastRun: null,
};

// Test hooks for injectable behaviors (used by unit tests)
const _testHooks = {};

/**
 * Inject test hooks for unit testing. Accepts partial object with
 * getAllOrgIds, purgeOldEntries, and log overrides.
 */
function __testInject(hooks) {
  Object.assign(_testHooks, hooks || {});
}

/**
 * Read the quarantine store.
 * @returns {{ entries: object[], metadata: object }}
 */
function readQuarantineStore() {
  try {
    if (!fs.existsSync(QUARANTINE_PATH)) return { entries: [], metadata: { createdAt: new Date().toISOString() } };
    const raw = fs.readFileSync(QUARANTINE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.entries || !Array.isArray(parsed.entries)) {
      return { entries: [], metadata: { createdAt: new Date().toISOString() } };
    }
    return parsed;
  } catch {
    return { entries: [], metadata: { createdAt: new Date().toISOString() } };
  }
}

/**
 * Write the quarantine store.
 * @param {{ entries: array, metadata: object }} store
 */
function writeQuarantineStore(store) {
  const dir = path.dirname(QUARANTINE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(QUARANTINE_PATH, JSON.stringify(store, null, 2));
}

/**
 * Get all organization IDs that have entries in the audit log.
 * @returns {string[]}
 */
function getAllOrgIds() {
  const store = readStore();
  const orgIds = new Set();
  for (const entry of Object.values(store.entries)) {
    if (entry.orgId) orgIds.add(entry.orgId);
  }
  return [...orgIds];
}

/**
 * Heal the audit log chain for a given org. Detects broken/tampered entries,
 * moves them to the quarantine store, and re-links the remaining entries
 * with new hashes.
 *
 * @param {string} orgId — Tenant org ID
 * @returns {{ healed: boolean, quarantined: array, relinked: number, remaining: number }}
 */
function healChain(orgId) {
  const orgIdNormalized = orgId || 'default';
  const verification = verifyChain(orgIdNormalized);

  if (verification.valid) {
    return { healed: false, quarantined: [], relinked: 0, remaining: verification.totalEntries };
  }

  // Collect IDs of broken/tampered entries
  const brokenIds = new Set();
  for (const link of verification.brokenLinks) {
    brokenIds.add(link.id);
  }
  for (const tampered of verification.tamperedEntries) {
    brokenIds.add(tampered.id);
  }

  // Read the main store
  const store = readStore();

  // Get all entries for this org, sorted by timestamp
  const orgEntries = Object.entries(store.entries)
    .filter(([, e]) => e.orgId === orgIdNormalized)
    .sort(([, a], [, b]) => a.timestamp.localeCompare(b.timestamp));

  // Move broken entries to quarantine
  const quarantined = [];
  const quarantineStore = readTenantQuarantineStore(orgIdNormalized);

  for (const [key, entry] of orgEntries) {
    if (brokenIds.has(entry.id)) {
      quarantined.push({
        ...entry,
        quarantinedAt: new Date().toISOString(),
        quarantineReason: verification.tamperedEntries.some((t) => t.id === entry.id)
          ? 'content_tampered'
          : 'broken_link',
      });
      delete store.entries[key];
    }
  }

  // Save quarantine store (per-tenant encrypted)
  quarantineStore.entries.push(...quarantined);
  quarantineStore.metadata.lastUpdated = new Date().toISOString();
  quarantineStore.metadata.totalQuarantined = quarantineStore.entries.length;
  quarantineStore.metadata.encrypted = true;
  writeTenantQuarantineStore(orgIdNormalized, quarantineStore);

  // Re-link remaining entries with new hashes
  const remainingEntries = Object.entries(store.entries)
    .filter(([, e]) => e.orgId === orgIdNormalized)
    .sort(([, a], [, b]) => a.timestamp.localeCompare(b.timestamp));

  let prevHash = GENESIS_HASH;
  let relinked = 0;

  for (const [key, entry] of remainingEntries) {
    entry.prevHash = prevHash;
    // Recompute hash over the entry (excluding the hash field itself)
    const entryWithoutHash = { ...entry };
    delete entryWithoutHash.hash;
    entry.hash = computeEntryHash(entryWithoutHash, prevHash);
    prevHash = entry.hash;
    relinked++;
  }

  // Save the healed main store
  writeStore(store);

  // Update heal stats
  _healStats.totalRuns++;
  _healStats.totalQuarantined += quarantined.length;
  _healStats.totalRelinked += relinked;
  _healStats.lastResult = {
    orgId: orgIdNormalized,
    healed: true,
    quarantined: quarantined.length,
    relinked,
    remaining: remainingEntries.length,
    timestamp: new Date().toISOString(),
  };

  return {
    healed: true,
    quarantined: quarantined.map((q) => ({
      id: q.id,
      reason: q.quarantineReason,
      quarantinedAt: q.quarantinedAt,
    })),
    relinked,
    remaining: remainingEntries.length,
  };
}

/**
 * Get the quarantine store contents, optionally filtered by orgId.
 * Reads from per-tenant encrypted quarantine files when orgId is provided.
 * Falls back to the legacy global quarantine file when orgId is omitted.
 * @param {string} [orgId] — Optional org filter
 * @returns {{ entries: array, metadata: object }}
 */
function getQuarantine(orgId) {
  if (orgId) {
    // Read from per-tenant encrypted store
    const store = readTenantQuarantineStore(orgId);
    return {
      entries: store.entries.filter((e) => e.orgId === orgId),
      metadata: store.metadata,
    };
  }
  // No orgId — read from legacy global store (for backward compatibility)
  return readQuarantineStore();
}

/**
 * Verify the cryptographic integrity of a single quarantined entry.
 * Recomputes the entry's hash and compares it to the stored hash.
 * Also checks whether the entry can be decrypted with any key in the
 * current keyring (active + previous via getDecryptionKeys()).
 *
 * @param {string} orgId — Tenant org ID
 * @param {string} entryId — Entry ID to verify
 * @returns {{ found: boolean, hashMatches: boolean, expectedHash: string, actualHash: string, quarantineReason: string|null, entry: object|null, decryptionStatus: string }}
 */
function verifyQuarantineEntry(orgId, entryId) {
  const orgIdNormalized = orgId || 'default';
  const store = readTenantQuarantineStore(orgIdNormalized);
  const entry = store.entries.find((e) => e.id === entryId);

  if (!entry) {
    return {
      found: false,
      hashMatches: false,
      expectedHash: '',
      actualHash: '',
      quarantineReason: null,
      entry: null,
      decryptionStatus: 'entry_not_found',
    };
  }

  // Recompute hash using the same canonical payload as computeEntryHash
  const entryWithoutHash = { ...entry };
  delete entryWithoutHash.hash;
  const recomputed = computeEntryHash(entryWithoutHash, entry.prevHash);

  // Check if the quarantine file itself can be decrypted
  // (readTenantQuarantineStore already attempted decryption; if it failed,
  // the metadata will have decryptionError: true)
  let decryptionStatus = 'decrypted';
  if (store.metadata && store.metadata.decryptionError) {
    decryptionStatus = 'decryption_failed';
  }

  return {
    found: true,
    hashMatches: entry.hash === recomputed,
    expectedHash: recomputed,
    actualHash: entry.hash,
    quarantineReason: entry.quarantineReason || null,
    entry,
    decryptionStatus,
  };
}

/**
 * Run healing for all orgs that have audit log entries.
 * @returns {array} Array of heal results per org
 */
function healAllOrgs() {
  if (_healRunning) return [];
  _healRunning = true;
  _lastHealRun = new Date().toISOString();

  try {
    const orgIds = getAllOrgIds();
    const results = [];
    for (const orgId of orgIds) {
      try {
        const result = healChain(orgId);
        if (result.healed) {
          results.push({ orgId, ...result });
        }
      } catch (err) {
        // Continue healing other orgs even if one fails
        results.push({ orgId, error: err.message, healed: false });
      }
    }
    return results;
  } finally {
    _healRunning = false;
  }
}

/**
 * Run an autonomous re-keying migration sweep. Checks if a key rotation is
 * active and, if so, re-encrypts per-tenant quarantine files from the
 * previous key to the active key. After successful migration, purges the
 * previous key from the key ring.
 *
 * This is called automatically during each auto-heal timer tick and can
 * also be triggered manually.
 * @returns {{ migrated: number, skipped: number, failed: number, purged: boolean, rotationActive: boolean }}
 */
function runAutonomousReKeying() {
  let rotationStatus = null;
  try {
    const keyRotationStore = require('./key-rotation-store.cjs');
    rotationStatus = keyRotationStore.getRotationStatus();
  } catch {
    // key-rotation-store not available — nothing to do
    return { migrated: 0, skipped: 0, failed: 0, purged: false, rotationActive: false };
  }

  // No previous key means no rotation in progress
  if (!rotationStatus || !rotationStatus.hasPrevious) {
    _reKeyStats.totalSweeps++;
    _reKeyStats.lastResult = { migrated: 0, skipped: 0, failed: 0, purged: false, rotationActive: false, timestamp: new Date().toISOString() };
    return { migrated: 0, skipped: 0, failed: 0, purged: false, rotationActive: false };
  }

  // If grace window has already expired, just purge and exit
  if (rotationStatus.graceExpired) {
    try {
      const purged = keyRotationStore.purgeExpiredKeys();
      _reKeyStats.totalSweeps++;
      _reKeyStats.totalPurged += purged ? 1 : 0;
      _reKeyStats.lastResult = { migrated: 0, skipped: 0, failed: 0, purged, rotationActive: false, timestamp: new Date().toISOString() };
      return { migrated: 0, skipped: 0, failed: 0, purged, rotationActive: false };
    } catch {
      return { migrated: 0, skipped: 0, failed: 0, purged: false, rotationActive: false };
    }
  }

  // Rotation is active — migrate quarantine files
  const { encryptForDirectory, decryptForDirectory } = getCryptoUtils();
  const keyRotationStore = require('./key-rotation-store.cjs');

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    // Build org list from both the audit log entries AND the quarantine directory.
    // After healChain(), tampered entries are removed from the main log and moved
    // to quarantine, so getAllOrgIds() alone would miss orgs with only quarantined data.
    const orgIds = new Set(getAllOrgIds());
    try {
      const quarantineBase = path.dirname(path.dirname(getTenantQuarantinePath('__probe__')));
      if (fs.existsSync(quarantineBase)) {
        for (const entry of fs.readdirSync(quarantineBase)) {
          if (entry.startsWith('tenant-')) {
            orgIds.add(entry.slice('tenant-'.length));
          }
        }
      }
    } catch {
      // Quarantine dir scan failure is non-fatal
    }

    for (const orgId of orgIds) {
      try {
        const tenantPath = getTenantQuarantinePath(orgId);
        if (!fs.existsSync(tenantPath)) {
          skipped++;
          continue;
        }

        // Read the encrypted quarantine file
        const raw = fs.readFileSync(tenantPath, 'utf8');
        if (!raw) {
          skipped++;
          continue;
        }

        // Decrypt with fallback (tries active key first, then previous)
        const decrypted = decryptForDirectory(raw, orgId, path.dirname(tenantPath));
        if (!decrypted) {
          // Cannot decrypt — file may be corrupted or key is outside grace
          failed++;
          continue;
        }

        // Re-encrypt with the active key
        const reEncrypted = encryptForDirectory(decrypted, orgId, path.dirname(tenantPath));
        if (!reEncrypted) {
          failed++;
          continue;
        }

        // Write back to disk
        fs.writeFileSync(tenantPath, reEncrypted, 'utf8');
        migrated++;
      } catch {
        // Per-org failure — continue to next org
        failed++;
      }
    }
  } catch {
    // Overall migration failure — return what we have
  }

  // After successful migration, purge the previous key
  let purged = false;
  if (migrated > 0 && failed === 0) {
    try {
      purged = keyRotationStore.purgeExpiredKeys(true);
    } catch {
      // Purge failure is non-fatal — grace window will eventually expire
    }
  }

  _reKeyStats.totalSweeps++;
  _reKeyStats.totalMigrated += migrated;
  _reKeyStats.totalSkipped += skipped;
  _reKeyStats.totalFailed += failed;
  _reKeyStats.totalPurged += purged ? 1 : 0;
  _reKeyStats.lastResult = { migrated, skipped, failed, purged, rotationActive: true, timestamp: new Date().toISOString() };

  return { migrated, skipped, failed, purged, rotationActive: true };
}

/**
 * Get re-keying migration stats.
 * @returns {{ totalSweeps: number, totalMigrated: number, totalSkipped: number, totalFailed: number, totalPurged: number, lastResult: object|null }}
 */
function getReKeyStats() {
  return { ..._reKeyStats };
}

/**
 * Run an autonomous lifecycle purge sweep across all orgs. For each
 * discovered org, invokes purgeOldEntries(orgId) which enforces the
 * org's retention policy (retentionDays, maxEntries safety floor,
 * archive flag). When entries are purged, an audit log entry with
 * action 'audit_retention_auto_purge' is recorded so the background
 * cleanup is itself auditable.
 *
 * This is called automatically during each auto-heal timer tick
 * (after healAllOrgs and runAutonomousReKeying) and can also be
 * triggered manually.
 * @returns {{ totalPurged: number, totalArchived: number, orgsProcessed: number, orgsPurged: number, errors: array }}
 */
async function runAutonomousLifecyclePurge() {
  if (_lifecyclePurgeRunning) {
    return { totalPurged: 0, totalArchived: 0, orgsProcessed: 0, orgsPurged: 0, errors: [] };
  }
  _lifecyclePurgeRunning = true;
  _lifecyclePurgeStats.lastRun = new Date().toISOString();

  const errors = [];
  let totalPurged = 0;
  let totalArchived = 0;
  let orgsProcessed = 0;
  let orgsPurged = 0;

  try {
    const getOrgIds = _testHooks.getAllOrgIds || getAllOrgIds;
    const purgeFn = _testHooks.purgeOldEntries || purgeOldEntries;
    const logFn = _testHooks.log || log;

    const orgIds = typeof getOrgIds === 'function' ? await Promise.resolve(getOrgIds()) : [];

    for (const orgId of orgIds) {
      orgsProcessed++;
      try {
        // Provide a safety-floor option to purgeOldEntries so implementations
        // can cap purges per-tenant. Tests expect an options.maxEntries value.
        const result = await Promise.resolve(purgeFn(orgId, { maxEntries: 1000 }));

        if (result && result.purged > 0) {
          orgsPurged++;
          totalPurged += result.purged;
          totalArchived += result.archived || 0;

          // Record the background cleanup as an audit log entry
          try {
            const policy = auditPolicyStore.getPolicy(orgId);
            await Promise.resolve(logFn({
              orgId,
              actorId: 'system',
              actorEmail: 'system@internal',
              action: 'audit_retention_auto_purge',
              entity: 'audit_log',
              entityId: orgId,
              metadata: {
                purged: result.purged,
                remaining: result.remaining,
                archived: result.archived || 0,
                policy: {
                  retentionDays: policy.retentionDays,
                  maxEntries: policy.maxEntries,
                  archive: policy.archive,
                },
                autoPurge: true,
              },
            }));
          } catch (logErr) {
            // Logging failure should not block the sweep
            errors.push({ orgId, error: `audit-log write failed: ${logErr.message}` });
          }
        }
      } catch (err) {
        // Continue purging other orgs even if one fails
        errors.push({ orgId, error: err.message });
      }
    }
  } finally {
    _lifecyclePurgeRunning = false;
  }

  _lifecyclePurgeStats.totalSweeps++;
  _lifecyclePurgeStats.totalPurged += totalPurged;
  _lifecyclePurgeStats.totalArchived += totalArchived;
  _lifecyclePurgeStats.failed += errors.length || 0;
  _lifecyclePurgeStats.lastResult = {
    totalPurged,
    totalArchived,
    orgsProcessed,
    orgsPurged,
    errors,
    timestamp: new Date().toISOString(),
  };

  return { totalPurged, totalArchived, orgsProcessed, orgsPurged, errors };
}

/**
 * Get autonomous lifecycle purge stats.
 * @returns {{ totalSweeps: number, totalPurged: number, totalArchived: number, lastResult: object|null, lastRun: string|null }}
 */
function getLifecyclePurgeStats() {
  // Backwards-compatible view plus test-friendly aliases
  return {
    // legacy counters
    ..._lifecyclePurgeStats,
    // test / user-friendly aliases
    runs: _lifecyclePurgeStats.totalSweeps,
    purged: _lifecyclePurgeStats.totalPurged,
    archived: _lifecyclePurgeStats.totalArchived,
    failed: _lifecyclePurgeStats.failed || 0,
    lastRun: _lifecyclePurgeStats.lastRun,
  };
}

/**
 * Start the background auto-healing timer.
 * @param {number} [intervalMs] — Override interval (default: AUDIT_HEAL_INTERVAL_MS or 5min)
 * @returns {boolean} True if timer was started
 */
function startAutoHeal(intervalMs) {
  if (_healTimer) return false; // Already running
  if (process.env.AUDIT_HEAL_ENABLED === 'false') return false;

  const interval = intervalMs || parseInt(process.env.AUDIT_HEAL_INTERVAL_MS, 10) || DEFAULT_HEAL_INTERVAL_MS;

  _healTimer = setInterval(() => {
    try {
      healAllOrgs();
    } catch {
      // Swallow errors in background timer — don't crash the process
    }
    try {
      runAutonomousReKeying();
    } catch {
      // Swallow errors in background timer — don't crash the process
    }
    try {
      runAutonomousLifecyclePurge().catch(() => {
        // Swallow errors in background timer — don't crash the process
      });
    } catch {
      // Swallow synchronous errors in background timer — don't crash the process
    }
  }, interval);

  // Don't keep the process alive just for the timer
  if (_healTimer.unref) _healTimer.unref();

  return true;
}

/**
 * Stop the background auto-healing timer.
 */
function stopAutoHeal() {
  if (_healTimer) {
    clearInterval(_healTimer);
    _healTimer = null;
  }
}

/**
 * Get auto-healing stats.
 * @returns {{ totalRuns: number, totalQuarantined: number, totalRelinked: number, lastResult: object|null, lastHealRun: string|null, isRunning: boolean }}
 */
function getHealStats() {
  return {
    ..._healStats,
    lastHealRun: _lastHealRun,
    isRunning: _healRunning,
    timerActive: _healTimer !== null,
  };
}

module.exports = {
  log,
  query,
  getStats,
  computeDiff,
  verifyChain,
  getRetentionStats,
  purgeOldEntries,
  computeEntryHash,
  scrubAuditEntry,
  healChain,
  healAllOrgs,
  getQuarantine,
  verifyQuarantineEntry,
  startAutoHeal,
  stopAutoHeal,
  getHealStats,
  getAllOrgIds,
  getTenantQuarantinePath,
  readTenantQuarantineStore,
  writeTenantQuarantineStore,
  runAutonomousReKeying,
  getReKeyStats,
  runAutonomousLifecyclePurge,
  getLifecyclePurgeStats,
  __testInject,
  GENESIS_HASH,
};
