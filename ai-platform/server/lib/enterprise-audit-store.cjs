/**
 * Enterprise Audit Log Store — Immutable, hash-chained audit trail
 * for multi-tenant administrative actions.
 *
 * Every entry is cryptographically linked to the previous entry via
 * SHA-256 hashing, creating a tamper-evident chain. Any modification
 * to a historical entry breaks the chain and is detectable.
 *
 * Audit actions recorded:
 *   - org_created        — New organization onboarded
 *   - trial_started      — Enterprise trial provisioned
 *   - seat_added         — Seat provisioned to a user
 *   - seat_removed       — Seat revoked from a user
 *   - api_key_generated  — New API key created for an org
 *   - azure_devops_generated — Azure DevOps pipeline config generated
 *   - org_updated        — Organization details updated
 *   - contract_upgraded  — Trial converted to paid contract
 *
 * @module enterprise-audit-store
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const AUDIT_STORE_PATH =
  process.env.ENTERPRISE_AUDIT_PATH ||
  path.join(__dirname, '../../.simplebeacon', 'enterprise-audit.json');

let _cache = null;
let _cacheDirty = true;

/**
 * Read the audit store from disk.
 * @returns {{ entries: Array, chainHead: string|null }}
 */
function readAuditStore() {
  if (_cache && !_cacheDirty) return _cache;
  try {
    const raw = fs.readFileSync(AUDIT_STORE_PATH, 'utf8');
    _cache = JSON.parse(raw);
    if (!_cache.entries || !Array.isArray(_cache.entries)) {
      _cache = { entries: [], chainHead: null };
    }
  } catch {
    _cache = { entries: [], chainHead: null };
  }
  _cacheDirty = false;
  return _cache;
}

/**
 * Write the audit store atomically to disk.
 * @param {{ entries: Array, chainHead: string|null }} store
 */
function writeAuditStore(store) {
  const dir = path.dirname(AUDIT_STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = AUDIT_STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, AUDIT_STORE_PATH);
  _cache = store;
  _cacheDirty = false;
}

/**
 * Compute SHA-256 hash of an entry concatenated with the previous hash.
 * @param {object} entry
 * @param {string|null} previousHash
 * @returns {string}
 */
function computeHash(entry, previousHash) {
  const payload = JSON.stringify({
    eventId: entry.eventId,
    timestamp: entry.timestamp,
    action: entry.action,
    orgId: entry.orgId,
    actor: entry.actor,
    previousHash: previousHash || '',
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Append a new audit entry to the hash chain.
 *
 * @param {object} params
 * @param {string} params.action     — Action type (e.g. 'seat_added')
 * @param {string} params.orgId      — Organization ID
 * @param {string} params.actor      — Who performed the action (email or 'system')
 * @param {string} [params.actorIp]  — IP address of the actor
 * @param {string} [params.description] — Human-readable description
 * @param {object} [params.before]   — State before the change
 * @param {object} [params.after]    — State after the change
 * @param {object} [params.metadata] — Additional context
 * @returns {object} The created audit entry
 */
function appendEntry({ action, orgId, actor, actorIp, description, before, after, metadata }) {
  const store = readAuditStore();
  const previousHash = store.chainHead;
  const entry = {
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    action,
    orgId,
    actor,
    actorIp: actorIp || null,
    description: description || '',
    before: before || null,
    after: after || null,
    metadata: metadata || {},
    previousHash,
    hash: null,
  };
  entry.hash = computeHash(entry, previousHash);
  store.entries.push(entry);
  store.chainHead = entry.hash;
  writeAuditStore(store);
  return entry;
}

/**
 * Query audit entries with filtering and pagination.
 *
 * @param {object} filters
 * @param {string} [filters.orgId]      — Filter by organization
 * @param {string} [filters.action]     — Filter by action type
 * @param {string} [filters.actor]      — Filter by actor email
 * @param {string} [filters.startDate]  — ISO date string
 * @param {string} [filters.endDate]    — ISO date string
 * @param {number} [filters.limit=50]   — Max entries (max 200)
 * @param {number} [filters.offset=0]   — Pagination offset
 * @returns {{ entries: Array, total: number, limit: number, offset: number }}
 */
function queryEntries(filters = {}) {
  const store = readAuditStore();
  let entries = [...store.entries];

  if (filters.orgId) {
    entries = entries.filter((e) => e.orgId === filters.orgId);
  }
  if (filters.action) {
    entries = entries.filter((e) => e.action === filters.action);
  }
  if (filters.actor) {
    entries = entries.filter((e) => e.actor === filters.actor);
  }
  if (filters.startDate) {
    const start = new Date(filters.startDate);
    entries = entries.filter((e) => new Date(e.timestamp) >= start);
  }
  if (filters.endDate) {
    const end = new Date(filters.endDate);
    entries = entries.filter((e) => new Date(e.timestamp) <= end);
  }

  entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const MAX_PAGE_SIZE = 200;
  const DEFAULT_PAGE_SIZE = 50;
  const limit = Math.min(
    Math.max(parseInt(filters.limit, 10) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE
  );
  const offset = Math.max(parseInt(filters.offset, 10) || 0, 0);
  const total = entries.length;
  const paginated = entries.slice(offset, offset + limit);

  return { entries: paginated, total, limit, offset };
}

/**
 * Verify the integrity of the hash chain.
 * Returns true if all entries' hashes are valid and chained correctly.
 * @returns {{ valid: boolean, brokenAt: number|null, totalEntries: number }}
 */
function verifyChain() {
  const store = readAuditStore();
  let previousHash = null;

  for (let i = 0; i < store.entries.length; i++) {
    const entry = store.entries[i];
    if (entry.previousHash !== previousHash) {
      return { valid: false, brokenAt: i, totalEntries: store.entries.length };
    }
    const expectedHash = computeHash(entry, previousHash);
    if (entry.hash !== expectedHash) {
      return { valid: false, brokenAt: i, totalEntries: store.entries.length };
    }
    previousHash = entry.hash;
  }

  if (store.chainHead !== previousHash) {
    return { valid: false, brokenAt: store.entries.length - 1, totalEntries: store.entries.length };
  }

  return { valid: true, brokenAt: null, totalEntries: store.entries.length };
}

/**
 * Get audit statistics for dashboard KPIs.
 * @returns {{ totalEntries: number, actionCounts: object, orgCounts: object, last24h: number }}
 */
function getStats() {
  const store = readAuditStore();
  const now = Date.now();
  const yesterday = now - 24 * 60 * 60 * 1000;

  const actionCounts = {};
  const orgCounts = {};
  let last24h = 0;

  for (const entry of store.entries) {
    actionCounts[entry.action] = (actionCounts[entry.action] || 0) + 1;
    orgCounts[entry.orgId] = (orgCounts[entry.orgId] || 0) + 1;
    if (new Date(entry.timestamp).getTime() > yesterday) {
      last24h++;
    }
  }

  return {
    totalEntries: store.entries.length,
    actionCounts,
    orgCounts,
    last24h,
  };
}

module.exports = {
  appendEntry,
  queryEntries,
  verifyChain,
  getStats,
  AUDIT_STORE_PATH,
};
