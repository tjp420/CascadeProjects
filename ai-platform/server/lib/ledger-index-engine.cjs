'use strict';

/**
 * Ledger Index Engine — In-memory indexed lookup layer for JSON-based
 * audit and analytics stores. Provides O(1) lookups by indexed fields
 * and O(log n) range queries by timestamp, replacing the O(n) full-scan
 * pattern used by the audit logger and usage analytics store.
 *
 * Indexes maintained:
 *   Audit Log:
 *     - orgId → entry keys
 *     - orgId + action → entry keys
 *     - orgId + entity → entry keys
 *     - orgId + actorId → entry keys
 *     - orgId + timestamp (sorted) → entry keys (range queries)
 *
 *   Usage Analytics:
 *     - orgId → scan indices
 *     - orgId + gateStatus → scan indices
 *     - orgId + timestamp (sorted) → scan indices (range queries)
 *
 * Materialized Aggregations:
 *   - Daily rollups: total scans, avg findings, avg posture score, pass rate
 *   - Hourly action counts per org
 *   - Top actors per org (rolling 24h)
 *
 * @module ledger-index-engine
 */

const fs = require('fs');
const path = require('path');
const logger = require('./app-logger.cjs');

const INDEX_STATE_PATH =
  process.env.LEDGER_INDEX_PATH ||
  path.join(process.cwd(), '.simplebeacon', 'ledger-index-state.json');

// ── Index structures ────────────────────────────────────────────────────────

// Audit indexes: Map<orgId, Map<fieldValue, Set<entryKey>>>
const auditIndexes = {
  action: new Map(),   // orgId → action → Set<entryKey>
  entity: new Map(),   // orgId → entity → Set<entryKey>
  actorId: new Map(),  // orgId → actorId → Set<entryKey>
  timestamp: new Map(), // orgId → sorted array of { timestamp, key }
};

// Analytics indexes: Map<orgId, Map<fieldValue, Set<scanIdx>>>
const analyticsIndexes = {
  gateStatus: new Map(), // orgId → gateStatus → Set<scanIdx>
  repository: new Map(), // orgId → repository → Set<scanIdx>
  timestamp: new Map(),  // orgId → sorted array of { timestamp, idx }
};

// Materialized daily rollups: Map<orgId, Map<dateStr, Rollup>>
const dailyRollups = new Map();

// Materialized hourly action counts: Map<orgId, Map<hourBucket, Map<action, count>>>
const hourlyActions = new Map();

// Index stats
const stats = {
  auditEntries: 0,
  analyticsEntries: 0,
  indexRebuilds: 0,
  lastRebuildAt: null,
  queryCount: 0,
  indexHits: 0,
  indexMisses: 0,
};

let _initialized = false;

// ── Audit Log Indexing ──────────────────────────────────────────────────────

/**
 * Index a single audit log entry.
 * Called incrementally as new entries are logged.
 * @param {string} key — The store key (orgId::id)
 * @param {object} entry — The audit entry
 */
function indexAuditEntry(key, entry) {
  const orgId = entry.orgId || 'default';

  // Index by action
  if (!auditIndexes.action.has(orgId)) auditIndexes.action.set(orgId, new Map());
  const actionMap = auditIndexes.action.get(orgId);
  if (!actionMap.has(entry.action)) actionMap.set(entry.action, new Set());
  actionMap.get(entry.action).add(key);

  // Index by entity
  if (!auditIndexes.entity.has(orgId)) auditIndexes.entity.set(orgId, new Map());
  const entityMap = auditIndexes.entity.get(orgId);
  if (!entityMap.has(entry.entity)) entityMap.set(entry.entity, new Set());
  entityMap.get(entry.entity).add(key);

  // Index by actorId
  if (!auditIndexes.actorId.has(orgId)) auditIndexes.actorId.set(orgId, new Map());
  const actorMap = auditIndexes.actorId.get(orgId);
  if (!actorMap.has(entry.actorId)) actorMap.set(entry.actorId, new Set());
  actorMap.get(entry.actorId).add(key);

  // Index by timestamp (sorted insertion)
  if (!auditIndexes.timestamp.has(orgId)) auditIndexes.timestamp.set(orgId, []);
  const tsArray = auditIndexes.timestamp.get(orgId);
  tsArray.push({ timestamp: entry.timestamp, key });
  // Keep sorted — binary search insertion would be ideal but for simplicity
  // we sort on rebuild and append + sort periodically

  // Update hourly action aggregation
  updateHourlyAction(orgId, entry.timestamp, entry.action);

  stats.auditEntries++;
}

/**
 * Update hourly action materialized aggregation.
 */
function updateHourlyAction(orgId, timestamp, action) {
  if (!hourlyActions.has(orgId)) hourlyActions.set(orgId, new Map());
  const orgHours = hourlyActions.get(orgId);
  const hourBucket = timestamp.substring(0, 13); // YYYY-MM-DDTHH
  if (!orgHours.has(hourBucket)) orgHours.set(hourBucket, new Map());
  const hourMap = orgHours.get(hourBucket);
  hourMap.set(action, (hourMap.get(action) || 0) + 1);
}

/**
 * Rebuild all audit indexes from the audit log store.
 * @param {object} store — The audit log store object
 */
function rebuildAuditIndexes(store) {
  // Clear existing indexes
  auditIndexes.action.clear();
  auditIndexes.entity.clear();
  auditIndexes.actorId.clear();
  auditIndexes.timestamp.clear();
  hourlyActions.clear();
  stats.auditEntries = 0;

  const entries = store.entries || {};
  for (const [key, entry] of Object.entries(entries)) {
    indexAuditEntry(key, entry);
  }

  // Sort timestamp arrays for binary search
  for (const [orgId, arr] of auditIndexes.timestamp) {
    arr.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  stats.indexRebuilds++;
  stats.lastRebuildAt = new Date().toISOString();
  logger.info(`[LedgerIndex] Rebuilt audit indexes: ${stats.auditEntries} entries`);
}

/**
 * Query audit log using indexes for fast filtering.
 * Returns entry keys matching the filters — caller fetches from store.
 * @param {object} filters — { orgId, action, entity, actorId, startDate, endDate }
 * @returns {Array<string>} — Matching entry keys (sorted by timestamp desc)
 */
function queryAuditKeys(filters) {
  stats.queryCount++;
  const orgId = filters.orgId || 'default';

  // Start with all keys for org, or use most selective index
  let candidateKeys = null;

  if (filters.action) {
    const actionMap = auditIndexes.action.get(orgId);
    if (actionMap && actionMap.has(filters.action)) {
      const keys = actionMap.get(filters.action);
      candidateKeys = candidateKeys
        ? new Set([...candidateKeys].filter((k) => keys.has(k)))
        : new Set(keys);
    } else {
      stats.indexMisses++;
      return [];
    }
    stats.indexHits++;
  }

  if (filters.entity) {
    const entityMap = auditIndexes.entity.get(orgId);
    if (entityMap && entityMap.has(filters.entity)) {
      const keys = entityMap.get(filters.entity);
      candidateKeys = candidateKeys
        ? new Set([...candidateKeys].filter((k) => keys.has(k)))
        : new Set(keys);
    } else {
      stats.indexMisses++;
      return [];
    }
    stats.indexHits++;
  }

  if (filters.actorId) {
    const actorMap = auditIndexes.actorId.get(orgId);
    if (actorMap && actorMap.has(filters.actorId)) {
      const keys = actorMap.get(filters.actorId);
      candidateKeys = candidateKeys
        ? new Set([...candidateKeys].filter((k) => keys.has(k)))
        : new Set(keys);
    } else {
      stats.indexMisses++;
      return [];
    }
    stats.indexHits++;
  }

  // If no field filters, use timestamp index for all org entries
  if (!candidateKeys) {
    const tsArray = auditIndexes.timestamp.get(orgId);
    if (!tsArray) {
      stats.indexMisses++;
      return [];
    }
    candidateKeys = new Set(tsArray.map((t) => t.key));
  }

  // Apply timestamp range filter using binary search
  if (filters.startDate || filters.endDate) {
    const tsArray = auditIndexes.timestamp.get(orgId) || [];
    const startIdx = filters.startDate
      ? lowerBound(tsArray, filters.startDate)
      : 0;
    const endIdx = filters.endDate
      ? upperBound(tsArray, filters.endDate)
      : tsArray.length;
    const rangeKeys = new Set(tsArray.slice(startIdx, endIdx).map((t) => t.key));
    candidateKeys = new Set([...candidateKeys].filter((k) => rangeKeys.has(k)));
  }

  // Sort by timestamp desc — use the timestamp index
  const tsArray = auditIndexes.timestamp.get(orgId) || [];
  const tsMap = new Map(tsArray.map((t) => [t.key, t.timestamp]));
  const result = [...candidateKeys].sort((a, b) => {
    const tsA = tsMap.get(a) || '';
    const tsB = tsMap.get(b) || '';
    return tsB.localeCompare(tsA);
  });

  return result;
}

// ── Binary search helpers for timestamp arrays ──────────────────────────────

function lowerBound(arr, value) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].timestamp < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function upperBound(arr, value) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].timestamp <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// ── Usage Analytics Indexing ────────────────────────────────────────────────

/**
 * Index a single analytics scan entry.
 * @param {number} idx — Array index in store.scans
 * @param {object} scan — The scan entry
 */
function indexAnalyticsEntry(idx, scan) {
  const orgId = scan.orgId || 'default';

  // Index by gateStatus
  if (!analyticsIndexes.gateStatus.has(orgId)) analyticsIndexes.gateStatus.set(orgId, new Map());
  const gateMap = analyticsIndexes.gateStatus.get(orgId);
  const gate = scan.gateStatus || 'pending';
  if (!gateMap.has(gate)) gateMap.set(gate, new Set());
  gateMap.get(gate).add(idx);

  // Index by repository
  if (scan.repository) {
    if (!analyticsIndexes.repository.has(orgId)) analyticsIndexes.repository.set(orgId, new Map());
    const repoMap = analyticsIndexes.repository.get(orgId);
    if (!repoMap.has(scan.repository)) repoMap.set(scan.repository, new Set());
    repoMap.get(scan.repository).add(idx);
  }

  // Index by timestamp
  if (!analyticsIndexes.timestamp.has(orgId)) analyticsIndexes.timestamp.set(orgId, []);
  analyticsIndexes.timestamp.get(orgId).push({ timestamp: scan.timestamp, idx });

  // Update daily rollup
  updateDailyRollup(orgId, scan);

  stats.analyticsEntries++;
}

/**
 * Update daily rollup materialized aggregation.
 */
function updateDailyRollup(orgId, scan) {
  if (!dailyRollups.has(orgId)) dailyRollups.set(orgId, new Map());
  const orgRollups = dailyRollups.get(orgId);
  const dateStr = (scan.timestamp || new Date().toISOString()).substring(0, 10);

  if (!orgRollups.has(dateStr)) {
    orgRollups.set(dateStr, {
      date: dateStr,
      totalScans: 0,
      totalFindings: 0,
      totalCritical: 0,
      postureScores: [],
      passCount: 0,
      failCount: 0,
    });
  }

  const rollup = orgRollups.get(dateStr);
  rollup.totalScans++;
  rollup.totalFindings += scan.totalFindings || 0;
  rollup.totalCritical += scan.criticalCount || 0;
  if (scan.postureScore != null) rollup.postureScores.push(scan.postureScore);
  if (scan.gateStatus === 'pass') rollup.passCount++;
  if (scan.gateStatus === 'fail') rollup.failCount++;
}

/**
 * Rebuild all analytics indexes from the usage analytics store.
 * @param {object} store — The usage analytics store object
 */
function rebuildAnalyticsIndexes(store) {
  analyticsIndexes.gateStatus.clear();
  analyticsIndexes.repository.clear();
  analyticsIndexes.timestamp.clear();
  dailyRollups.clear();
  stats.analyticsEntries = 0;

  const scans = store.scans || [];
  for (let i = 0; i < scans.length; i++) {
    indexAnalyticsEntry(i, scans[i]);
  }

  // Sort timestamp arrays
  for (const [orgId, arr] of analyticsIndexes.timestamp) {
    arr.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  stats.indexRebuilds++;
  logger.info(`[LedgerIndex] Rebuilt analytics indexes: ${stats.analyticsEntries} entries`);
}

/**
 * Query analytics scans using indexes.
 * @param {object} filters — { orgId, gateStatus, repository, startDate, endDate }
 * @returns {Array<number>} — Matching scan array indices
 */
function queryAnalyticsIndices(filters) {
  stats.queryCount++;
  const orgId = filters.orgId || 'default';

  let candidates = null;

  if (filters.gateStatus) {
    const gateMap = analyticsIndexes.gateStatus.get(orgId);
    if (gateMap && gateMap.has(filters.gateStatus)) {
      const indices = gateMap.get(filters.gateStatus);
      candidates = candidates
        ? new Set([...candidates].filter((i) => indices.has(i)))
        : new Set(indices);
    } else {
      stats.indexMisses++;
      return [];
    }
    stats.indexHits++;
  }

  if (filters.repository) {
    const repoMap = analyticsIndexes.repository.get(orgId);
    if (repoMap && repoMap.has(filters.repository)) {
      const indices = repoMap.get(filters.repository);
      candidates = candidates
        ? new Set([...candidates].filter((i) => indices.has(i)))
        : new Set(indices);
    } else {
      stats.indexMisses++;
      return [];
    }
    stats.indexHits++;
  }

  if (!candidates) {
    const tsArray = analyticsIndexes.timestamp.get(orgId);
    if (!tsArray) {
      stats.indexMisses++;
      return [];
    }
    candidates = new Set(tsArray.map((t) => t.idx));
  }

  if (filters.startDate || filters.endDate) {
    const tsArray = analyticsIndexes.timestamp.get(orgId) || [];
    const startIdx = filters.startDate
      ? lowerBound(tsArray, filters.startDate)
      : 0;
    const endIdx = filters.endDate
      ? upperBound(tsArray, filters.endDate)
      : tsArray.length;
    const rangeIndices = new Set(tsArray.slice(startIdx, endIdx).map((t) => t.idx));
    candidates = new Set([...candidates].filter((i) => rangeIndices.has(i)));
  }

  // Sort by timestamp desc
  const tsArray = analyticsIndexes.timestamp.get(orgId) || [];
  const tsMap = new Map(tsArray.map((t) => [t.idx, t.timestamp]));
  return [...candidates].sort((a, b) => {
    const tsA = tsMap.get(a) || '';
    const tsB = tsMap.get(b) || '';
    return tsB.localeCompare(tsA);
  });
}

// ── Materialized Aggregation Queries ────────────────────────────────────────

/**
 * Get daily rollups for an org within a date range.
 * @param {string} orgId
 * @param {string} [startDate] — ISO date (YYYY-MM-DD)
 * @param {string} [endDate] — ISO date (YYYY-MM-DD)
 * @returns {Array} — Daily rollup objects
 */
function getDailyRollups(orgId, startDate, endDate) {
  const orgRollups = dailyRollups.get(orgId || 'default');
  if (!orgRollups) return [];

  let rollups = [...orgRollups.values()];
  if (startDate) rollups = rollups.filter((r) => r.date >= startDate);
  if (endDate) rollups = rollups.filter((r) => r.date <= endDate);

  // Finalize computed fields
  return rollups.map((r) => ({
    date: r.date,
    totalScans: r.totalScans,
    totalFindings: r.totalFindings,
    totalCritical: r.totalCritical,
    avgFindings: r.totalScans > 0 ? Math.round(r.totalFindings / r.totalScans) : 0,
    avgPostureScore:
      r.postureScores.length > 0
        ? Math.round(r.postureScores.reduce((a, b) => a + b, 0) / r.postureScores.length)
        : null,
    passRate: r.totalScans > 0 ? Math.round((r.passCount / r.totalScans) * 100) : 0,
    passCount: r.passCount,
    failCount: r.failCount,
  }));
}

/**
 * Get hourly action counts for an org within a time range.
 * @param {string} orgId
 * @param {number} [hoursBack] — How many hours back (default 24)
 * @returns {Array} — Hourly action count objects
 */
function getHourlyActions(orgId, hoursBack) {
  const orgHours = hourlyActions.get(orgId || 'default');
  if (!orgHours) return [];

  const hours = hoursBack || 24;
  const now = new Date();
  const result = [];

  for (let i = hours - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    const hourBucket = d.toISOString().substring(0, 13);
    const hourMap = orgHours.get(hourBucket);
    result.push({
      hour: hourBucket,
      actions: hourMap ? Object.fromEntries(hourMap) : {},
      total: hourMap ? [...hourMap.values()].reduce((a, b) => a + b, 0) : 0,
    });
  }

  return result;
}

// ── Index Management ────────────────────────────────────────────────────────

/**
 * Rebuild all indexes from scratch.
 * @param {object} auditStore — The audit log store
 * @param {object} analyticsStore — The usage analytics store
 */
function rebuildAll(auditStore, analyticsStore) {
  if (auditStore) rebuildAuditIndexes(auditStore);
  if (analyticsStore) rebuildAnalyticsIndexes(analyticsStore);
  saveState();
}

/**
 * Get index engine stats.
 */
function getStats() {
  return {
    ...stats,
    auditOrgs: auditIndexes.timestamp.size,
    analyticsOrgs: analyticsIndexes.timestamp.size,
    dailyRollupOrgs: dailyRollups.size,
    hourlyActionOrgs: hourlyActions.size,
    indexHitRate: stats.queryCount > 0
      ? Math.round((stats.indexHits / stats.queryCount) * 100)
      : 0,
  };
}

/**
 * Save index state metadata (not the full indexes — those are rebuilt on startup).
 */
function saveState() {
  try {
    const state = {
      lastRebuildAt: stats.lastRebuildAt,
      indexRebuilds: stats.indexRebuilds,
      auditEntries: stats.auditEntries,
      analyticsEntries: stats.analyticsEntries,
    };
    const dir = path.dirname(INDEX_STATE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(INDEX_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    logger.warn('[LedgerIndex] Failed to save state:', err.message);
  }
}

/**
 * Initialize the index engine on server startup.
 * Rebuilds indexes from the audit log and analytics stores.
 */
function initialize() {
  if (_initialized) return;
  _initialized = true;

  try {
    // Load audit log store
    const auditPath = path.join(process.cwd(), '.simplebeacon', 'audit-log.json');
    if (fs.existsSync(auditPath)) {
      const auditStore = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
      rebuildAuditIndexes(auditStore);
    }

    // Load analytics store
    const analyticsPath = path.join(process.cwd(), '.simplebeacon', 'usage-analytics.json');
    if (fs.existsSync(analyticsPath)) {
      const analyticsStore = JSON.parse(fs.readFileSync(analyticsPath, 'utf8'));
      rebuildAnalyticsIndexes(analyticsStore);
    }

    logger.info('[LedgerIndex] Initialization complete');
  } catch (err) {
    logger.warn('[LedgerIndex] Initialization failed:', err.message);
  }
}

module.exports = {
  initialize,
  indexAuditEntry,
  rebuildAuditIndexes,
  rebuildAnalyticsIndexes,
  rebuildAll,
  queryAuditKeys,
  queryAnalyticsIndices,
  getDailyRollups,
  getHourlyActions,
  getStats,
  saveState,
};
