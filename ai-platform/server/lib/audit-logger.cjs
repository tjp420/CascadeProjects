'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { getPolicy, getArchivePath } = require('./audit-policy-store.cjs');

const STORE_PATH = path.join(process.cwd(), '.simplebeacon', 'audit-log.json');
const MAX_ENTRIES_PER_ORG = 1000;

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
  let entries = Object.values(store.entries).filter((e) => e.orgId === orgId);

  if (filters.action) entries = entries.filter((e) => e.action === filters.action);
  if (filters.entity) entries = entries.filter((e) => e.entity === filters.entity);
  if (filters.actorId) entries = entries.filter((e) => e.actorId === filters.actorId);
  if (filters.startDate) entries = entries.filter((e) => e.timestamp >= filters.startDate);
  if (filters.endDate) entries = entries.filter((e) => e.timestamp <= filters.endDate);

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
  const scoped = Object.values(store.entries).filter((e) => e.orgId === (orgId || 'default'));
  const byAction = {};
  const byEntity = {};
  const actorSet = new Map();

  for (const e of scoped) {
    byAction[e.action] = (byAction[e.action] || 0) + 1;
    byEntity[e.entity] = (byEntity[e.entity] || 0) + 1;
    if (!actorSet.has(e.actorId))
      actorSet.set(e.actorId, { actorId: e.actorId, actorEmail: e.actorEmail, count: 0 });
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
 * Delete an audit log entry by ID.
 * @param {string} orgId — Tenant organization ID
 * @param {string} entryId — The audit entry ID to delete
 * @returns {object|null} The deleted entry, or null if not found
 */
function deleteEntry(orgId, entryId) {
  const store = readStore();
  const key = makeKey(orgId, entryId);
  const entry = store.entries[key];
  if (!entry) return null;
  delete store.entries[key];
  writeStore(store);
  return entry;
}

// ── Retention & Archiving ────────────────────────────────────────────────────

/**
 * Read an existing archive file (or return empty structure).
 * @param {string} archivePath
 * @returns {{ entries: Array }}
 */
function readArchive(archivePath) {
  try {
    if (!fs.existsSync(archivePath)) return { entries: [] };
    const raw = fs.readFileSync(archivePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? { entries: parsed } : parsed;
  } catch {
    return { entries: [] };
  }
}

/**
 * Append entries to an archive file.
 * @param {string} archivePath
 * @param {Array} entries
 */
function appendToArchive(archivePath, entries) {
  const dir = path.dirname(archivePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const archive = readArchive(archivePath);
  archive.entries.push(...entries);
  const tmp = archivePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(archive, null, 2), 'utf8');
  fs.renameSync(tmp, archivePath);
}

/**
 * Enforce the retention policy for an org.
 * Archives entries older than archiveAfterDays (if archiving enabled),
 * then deletes entries older than retentionDays or exceeding maxEntries.
 *
 * @param {string} orgId
 * @param {object} [policyOverride] — Override policy for testing
 * @returns {{ archived: number, deleted: number, remaining: number }}
 */
function enforceRetentionPolicy(orgId, policyOverride) {
  const policy = policyOverride || getPolicy(orgId || 'default');
  const store = readStore();
  const scopedOrgId = orgId || 'default';

  const allEntries = Object.entries(store.entries).filter(
    ([, v]) => v.orgId === scopedOrgId
  );

  const now = Date.now();
  const retentionMs = policy.retentionDays * 24 * 60 * 60 * 1000;
  const archiveMs = policy.archiveAfterDays * 24 * 60 * 60 * 1000;

  let archived = 0;
  let deleted = 0;
  const keysToDelete = [];

  // Phase 1: Archive entries older than archiveAfterDays (if enabled)
  if (policy.archiveEnabled && allEntries.length > 0) {
    const toArchive = [];
    for (const [key, entry] of allEntries) {
      const age = now - new Date(entry.timestamp).getTime();
      if (age > archiveMs && age <= retentionMs) {
        toArchive.push(entry);
        keysToDelete.push(key);
      }
    }
    if (toArchive.length > 0) {
      const archivePath = getArchivePath(scopedOrgId);
      appendToArchive(archivePath, toArchive);
      archived = toArchive.length;
    }
  }

  // Phase 2: Delete entries older than retentionDays
  for (const [key, entry] of allEntries) {
    if (keysToDelete.includes(key)) continue; // already archived
    const age = now - new Date(entry.timestamp).getTime();
    if (age > retentionMs) {
      keysToDelete.push(key);
    }
  }

  // Phase 3: Enforce maxEntries — delete oldest beyond the limit
  const remainingEntries = allEntries
    .filter(([k]) => !keysToDelete.includes(k))
    .sort((a, b) => b[1].timestamp.localeCompare(a[1].timestamp));
  if (remainingEntries.length > policy.maxEntries) {
    const excess = remainingEntries.slice(policy.maxEntries);
    for (const [key] of excess) {
      keysToDelete.push(key);
    }
  }

  // Apply deletions
  for (const key of keysToDelete) {
    delete store.entries[key];
  }
  deleted = keysToDelete.length - archived;

  if (keysToDelete.length > 0) {
    writeStore(store);
  }

  const remaining = allEntries.length - keysToDelete.length;
  return { archived, deleted, remaining };
}

/**
 * Generate a compliance report for an org over a date range.
 * Summarizes audit activity by action, entity, actor, and day.
 *
 * @param {string} orgId
 * @param {object} [opts]
 * @param {string} [opts.startDate] — ISO timestamp lower bound
 * @param {string} [opts.endDate] — ISO timestamp upper bound
 * @returns {object} Compliance report
 */
function generateComplianceReport(orgId, opts = {}) {
  const scopedOrgId = orgId || 'default';
  const result = query({
    orgId: scopedOrgId,
    startDate: opts.startDate || '',
    endDate: opts.endDate || '',
    limit: 10000,
    offset: 0,
  });

  const entries = result.entries;
  const byAction = {};
  const byEntity = {};
  const byActor = {};
  const byDay = {};
  const criticalActions = ['DELETE', 'RUN', 'EVALUATE'];

  let criticalCount = 0;
  for (const e of entries) {
    byAction[e.action] = (byAction[e.action] || 0) + 1;
    byEntity[e.entity] = (byEntity[e.entity] || 0) + 1;
    byActor[e.actorId] = (byActor[e.actorId] || 0) + 1;
    const day = e.timestamp.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
    if (criticalActions.includes(e.action)) criticalCount++;
  }

  return {
    orgId: scopedOrgId,
    generatedAt: new Date().toISOString(),
    dateRange: {
      startDate: opts.startDate || null,
      endDate: opts.endDate || null,
    },
    totalEntries: entries.length,
    criticalActionCount: criticalCount,
    summary: {
      byAction,
      byEntity,
      byActor,
      byDay,
    },
    topActors: Object.entries(byActor)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([actorId, count]) => ({ actorId, count })),
    topEntities: Object.entries(byEntity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([entity, count]) => ({ entity, count })),
  };
}

module.exports = {
  log,
  query,
  getStats,
  computeDiff,
  deleteEntry,
  enforceRetentionPolicy,
  generateComplianceReport,
};
