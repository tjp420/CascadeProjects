'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

module.exports = {
  log,
  query,
  getStats,
  computeDiff,
};
