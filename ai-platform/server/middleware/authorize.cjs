'use strict';

/**
 * Authorization Middleware ?????? checks user permissions against required
 * permissions for each endpoint. Must be used after authenticate middleware.
 *
 * Usage:
 *   const { authorize } = require('../middleware/authorize.cjs');
 *   router.post('/violations', authorize('write:tickets'), handler);
 *   router.delete('/suites/:id', authorize('delete:all'), handler);
 *
 * Also provides org-partition enforcement via enforceOrgPartition().
 */

const rbacStore = require('../lib/rbac-store.cjs');

// Lazy-load settings store to avoid circular dependency at module init
function getSettings() {
  try {
    return require('../lib/security-monitor-settings-store.cjs').getSettings();
  } catch {
    return {};
  }
}

function isPartitionEnforcementEnabled() {
  return getSettings().orgPartitionEnforcementEnabled !== false;
}

function shouldAlertOnViolation() {
  return getSettings().orgPartitionAlertOnViolation !== false;
}

function getViolationAlertThreshold() {
  return getSettings().orgPartitionViolationAlertThreshold || 5;
}

function getViolationTtlMs() {
  return getSettings().orgPartitionViolationTtlMs || 24 * 60 * 60 * 1000;
}

function getViolationMaxLog() {
  const max = getSettings().orgPartitionViolationMaxLog;
  return typeof max === 'number' && max >= 10 ? max : 1000;
}

function getViolationMemoryGuardMb() {
  const mb = getSettings().orgPartitionViolationMemoryGuardMb;
  return typeof mb === 'number' && mb >= 1 ? mb : 50;
}

function getViolationCleanupIntervalMs() {
  const interval = getSettings().orgPartitionViolationCleanupIntervalMs;
  return typeof interval === 'number' && interval >= 10000 ? interval : 5 * 60 * 1000;
}

function getOrgId(req) {
  return req.user?.id || req.user?.email || 'default';
}

// ?????? Org Partition Enforcement ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????

let _partitionViolations = [];
let _violationAlertCooldown = new Map();
const VIOLATION_ALERT_COOLDOWN_MS = 15 * 60 * 1000;
let _cleanupTimer = null;
let _lastCleanupRun = 0;

/**
 * Estimate the memory footprint of the violation buffer in MB.
 * Each violation object is roughly 200-400 bytes; we use a conservative
 * estimate of 0.5 KB per entry to account for V8 object overhead.
 * @returns {number} Estimated MB consumed by _partitionViolations
 */
function estimateViolationMemoryMb() {
  return (_partitionViolations.length * 0.5) / 1024;
}

/**
 * Remove expired violations from the in-memory buffer.
 * Violations older than the configured TTL are purged.
 * @returns {number} Number of violations purged
 */
function purgeExpiredViolations() {
  const ttlMs = getViolationTtlMs();
  const cutoff = Date.now() - ttlMs;
  const before = _partitionViolations.length;

  _partitionViolations = _partitionViolations.filter((v) => {
    const ts = new Date(v.at).getTime();
    return ts > cutoff;
  });

  _lastCleanupRun = Date.now();
  return before - _partitionViolations.length;
}

/**
 * Ensure the violation buffer doesn't exceed the max log size or
 * the memory pressure guard threshold. Called after every recordViolation().
 * @returns {number} Number of violations trimmed
 */
function enforceViolationCap() {
  const maxLog = getViolationMaxLog();
  const memoryGuardMb = getViolationMemoryGuardMb();
  let trimmed = 0;

  // Enforce count cap
  if (_partitionViolations.length > maxLog) {
    trimmed = _partitionViolations.length - maxLog;
    _partitionViolations = _partitionViolations.slice(0, maxLog);
  }

  // Enforce memory guard ??? keep trimming until under the MB threshold
  while (estimateViolationMemoryMb() > memoryGuardMb && _partitionViolations.length > 0) {
    _partitionViolations.pop();
    trimmed++;
  }

  return trimmed;
}

/**
 * Maybe run a cleanup cycle if enough time has elapsed since the last run.
 * This is called lazily from recordViolation() rather than using a setInterval
 * to avoid timer leaks in test environments. A setInterval is also started
 * for background cleanup when the module is first loaded in production.
 */
function maybeRunCleanup() {
  const now = Date.now();
  const interval = getViolationCleanupIntervalMs();
  if (now - _lastCleanupRun >= interval) {
    purgeExpiredViolations();
    enforceViolationCap();
  }
}

/**
 * Start a background cleanup timer. Safe to call multiple times ???
 * it will clear any existing timer first.
 */
function startCleanupTimer() {
  if (_cleanupTimer) clearInterval(_cleanupTimer);
  const interval = getViolationCleanupIntervalMs();
  _cleanupTimer = setInterval(() => {
    try {
      purgeExpiredViolations();
      enforceViolationCap();
    } catch {}
  }, interval);
  // Don't keep the process alive just for this timer
  if (_cleanupTimer.unref) _cleanupTimer.unref();
}

/**
 * Stop the background cleanup timer (for tests / shutdown).
 */
function stopCleanupTimer() {
  if (_cleanupTimer) {
    clearInterval(_cleanupTimer);
    _cleanupTimer = null;
  }
}

/**
 * Clear all violations from the buffer (for tests / admin reset).
 * @returns {number} Number of violations cleared
 */
function clearViolations() {
  const count = _partitionViolations.length;
  _partitionViolations = [];
  return count;
}

function recordViolation(violation) {
  // Run lazy cleanup if interval has elapsed
  maybeRunCleanup();

  // Memory pressure guard ??? refuse to store if already over the guard limit
  const memoryGuardMb = getViolationMemoryGuardMb();
  if (estimateViolationMemoryMb() > memoryGuardMb) {
    // Aggressively trim before adding
    enforceViolationCap();
    // If still over, refuse to store the new violation
    if (estimateViolationMemoryMb() > memoryGuardMb) {
      return;
    }
  }

  _partitionViolations.unshift({ ...violation, at: new Date().toISOString() });

  // Enforce cap after adding
  enforceViolationCap();

  // Feed the stream interdiction engine for unified multi-axis tracking
  const streamKey = violation.userId || violation.callerOrgId;
  if (streamKey) {
    recordStreamFailure(streamKey, 'org_partition', `${violation.method} ${violation.path}`);
  }

  if (!shouldAlertOnViolation()) return;

  const threshold = getViolationAlertThreshold();
  const callerOrgId = violation.callerOrgId;
  const recentOrgViolations = _partitionViolations.filter(
    (v) => v.callerOrgId === callerOrgId
  ).length;

  if (recentOrgViolations >= threshold) {
    const lastAlert = _violationAlertCooldown.get(callerOrgId);
    const now = Date.now();
    if (lastAlert && now - lastAlert < VIOLATION_ALERT_COOLDOWN_MS) return;
    _violationAlertCooldown.set(callerOrgId, now);

    // Auto-interdict the caller's API key if auto-trigger is enabled
    if (isAutoInterdictionEnabled()) {
      const keyToBlock = violation.userId || callerOrgId;
      interdictKey(
        keyToBlock,
        `auto:org_partition_violation_spike (${recentOrgViolations} violations, threshold ${threshold})`,
        getInterdictionTtlMs(),
        'auto'
      );
    }

    try {
      const { processEvent } = require('../lib/alert-dispatcher.cjs');
      processEvent(callerOrgId, 'org_partition_violation_spike', {
        severity: 'high',
        message: `Org partition violation spike: ${recentOrgViolations} cross-org access attempts blocked`,
        data: { orgId: callerOrgId, violationCount: recentOrgViolations, threshold, recentViolation: violation },
      }).catch(() => {});
    } catch {}
  }
}

function getPartitionViolations() {
  return _partitionViolations;
}

function getPartitionStats() {
  const settings = getSettings();
  return {
    totalViolations: _partitionViolations.length,
    recentViolations: _partitionViolations.slice(0, 10),
    enforcementEnabled: isPartitionEnforcementEnabled(),
    alertOnViolation: shouldAlertOnViolation(),
    violationAlertThreshold: getViolationAlertThreshold(),
    // Retention policy info
    violationTtlMs: getViolationTtlMs(),
    violationMaxLog: getViolationMaxLog(),
    violationMemoryGuardMb: getViolationMemoryGuardMb(),
    estimatedMemoryMb: Math.round(estimateViolationMemoryMb() * 1000) / 1000,
    lastCleanupRun: _lastCleanupRun || null,
    settingsUpdatedAt: settings.updatedAt,
  };
}

function resolveCallerOrgId(req) {
  return req.user?.id || req.user?.email || 'default';
}

function hasCrossOrgAccess(userId, orgId, fallbackRole) {
  const { permissions } = rbacStore.resolveUserRole(userId, orgId, fallbackRole);
  return permissions.includes('admin:all');
}

/**
 * Express middleware that enforces org partition isolation.
 * Checks if the client-provided orgId matches the authenticated user's orgId.
 * If they don't match and the user doesn't have admin:all, the request is
 * rejected with 403 and the violation is logged.
 * Must be used AFTER authenticate middleware.
 * @returns {function} Express middleware
 */
function enforceOrgPartition() {
  return function orgPartitionMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'authentication_required',
        message: 'Authentication required before partition check',
      });
    }

    const callerOrgId = resolveCallerOrgId(req);
    const userId = req.user.id || req.user.email;

    const clientOrgId =
      req.body?.orgId ||
      req.query?.orgId ||
      req.params?.orgId ||
      null;

    if (!clientOrgId) {
      req.resolvedOrgId = callerOrgId;
      return next();
    }

    if (clientOrgId === callerOrgId) {
      req.resolvedOrgId = callerOrgId;
      return next();
    }

    // If enforcement is disabled, allow through but still track
    if (!isPartitionEnforcementEnabled()) {
      req.resolvedOrgId = clientOrgId;
      req.crossOrgAccess = true;
      req.partitionEnforcementBypassed = true;
      return next();
    }

    if (hasCrossOrgAccess(userId, callerOrgId, req.user.role)) {
      req.resolvedOrgId = clientOrgId;
      req.crossOrgAccess = true;
      return next();
    }

    const violation = {
      callerOrgId,
      clientOrgId,
      userId,
      method: req.method,
      path: req.path,
      ip: req.ip || req.socket?.remoteAddress,
    };

    recordViolation(violation);

    return res.status(403).json({
      success: false,
      error: 'org_partition_violation',
      message: 'Cross-organization access denied. You can only access data within your own organization.',
      callerOrgId,
      requestedOrgId: clientOrgId,
    });
  };
}

/**
 * Express middleware factory that requires a specific permission.
 * @param {string} requiredPermission ?????? e.g. 'write:tickets', 'delete:all', 'read:audit'
 * @returns {function} Express middleware
 */
function authorize(requiredPermission) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.user) {
      return res
        .status(401)
        .json({
          success: false,
          error: 'authentication_required',
          message: 'Authentication required before authorization',
        });
    }

    const orgId = getOrgId(req);
    const userId = req.user.id || req.user.email;

    // Resolve user's role and permissions
    const { role, permissions, source } = rbacStore.resolveUserRole(userId, orgId, req.user.role);

    // Check permission
    if (!rbacStore.hasPermission(permissions, requiredPermission)) {
      return res.status(403).json({
        success: false,
        error: 'insufficient_permissions',
        message: `Role "${role}" does not have permission "${requiredPermission}"`,
        requiredPermission,
        userRole: role,
        permissionSource: source,
      });
    }

    // Attach resolved role info to request for downstream use
    req.userRole = role;
    req.userPermissions = permissions;

    next();
  };
}

/**
 * Middleware that allows access if user has ANY of the specified permissions.
 * @param  {...string} permissions
 */
function authorizeAny(...permissions) {
  return function authorizeAnyMiddleware(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'authentication_required' });
    }

    const orgId = getOrgId(req);
    const userId = req.user.id || req.user.email;
    const { role, permissions: userPerms } = rbacStore.resolveUserRole(
      userId,
      orgId,
      req.user.role
    );

    const hasAny = permissions.some((p) => rbacStore.hasPermission(userPerms, p));
    if (!hasAny) {
      return res.status(403).json({
        success: false,
        error: 'insufficient_permissions',
        message: `Role "${role}" requires one of: ${permissions.join(', ')}`,
      });
    }

    req.userRole = role;
    req.userPermissions = userPerms;
    next();
  };
}

// ── Key Interdiction Engine ─────────────────────────────────────────────────
//
// In-memory API key block list with TTL-based eviction. When a key is
// interdicted (either manually by an admin or automatically by the violation
// threshold trigger), subsequent requests carrying that key are rejected with
// HTTP 423 Locked before reaching downstream handlers.
//
// Configuration (via security-monitor-settings-store):
//   interdictionDefaultTtlMs — default lockout duration (default: 15 min)
//   interdictionMaxKeys — max entries in block list (default: 10,000)
//   interdictionAutoTriggerEnabled — auto-block on violation threshold (default: true)

const MAX_INTERDICTED_KEYS = 10000;
const DEFAULT_INTERDICTION_TTL_MS = 15 * 60 * 1000;

// ── Stream Interdiction Engine ──────────────────────────────────────────────
//
// Multi-axis sliding-window failure tracker. Records security failures by
// type (chain_verification, pii_violation, guardrail_refusal, auth_failure,
// org_partition, rate_limit, bundle_verification) per API key within a
// rolling window. When any failure type exceeds its configured threshold
// within the window, the key is automatically interdicted.
//
// Configuration (via security-monitor-settings-store):
//   streamInterdictionEnabled — master switch (default: true)
//   streamInterdictionWindowMs — sliding window duration (default: 5 min)
//   streamInterdictionTtlMs — lockout duration for stream-triggered blocks (default: 30 min)
//   streamInterdictionMaxFailures — max failure records in memory (default: 10,000)
//   streamInterdictionThresholds — per-type threshold object

const STREAM_FAILURE_TYPES = [
  'chain_verification',
  'pii_violation',
  'guardrail_refusal',
  'auth_failure',
  'org_partition',
  'rate_limit',
  'bundle_verification',
];

let _streamFailures = []; // array of { apiKey, type, detail, at }
let _streamInterdictionStats = {
  totalFailuresRecorded: 0,
  totalAutoInterdicts: 0,
  lastAutoInterdict: null,
  byType: {}, // { chain_verification: 0, ... }
};

// Initialize byType counters
STREAM_FAILURE_TYPES.forEach((t) => {
  _streamInterdictionStats.byType[t] = 0;
});

function isStreamInterdictionEnabled() {
  const settings = getSettings();
  return settings.streamInterdictionEnabled !== false;
}

function getStreamWindowMs() {
  const settings = getSettings();
  const w = settings.streamInterdictionWindowMs;
  return typeof w === 'number' && w >= 10000 ? w : 5 * 60 * 1000;
}

function getStreamTtlMs() {
  const settings = getSettings();
  const t = settings.streamInterdictionTtlMs;
  return typeof t === 'number' && t >= 1000 ? t : 30 * 60 * 1000;
}

function getStreamMaxFailures() {
  const settings = getSettings();
  const m = settings.streamInterdictionMaxFailures;
  return typeof m === 'number' && m >= 100 ? m : 10000;
}

function getStreamThresholds() {
  const settings = getSettings();
  return settings.streamInterdictionThresholds || {
    chain_verification: 3,
    pii_violation: 5,
    guardrail_refusal: 5,
    auth_failure: 10,
    org_partition: 5,
    rate_limit: 10,
    bundle_verification: 3,
  };
}

function getStreamThreshold(failureType) {
  const thresholds = getStreamThresholds();
  return thresholds[failureType] || Infinity;
}

/**
 * Purge stream failures older than the sliding window.
 * @returns {number} Number of entries purged
 */
function purgeExpiredStreamFailures() {
  const windowMs = getStreamWindowMs();
  const cutoff = Date.now() - windowMs;
  const before = _streamFailures.length;
  _streamFailures = _streamFailures.filter((f) => f.at > cutoff);
  return before - _streamFailures.length;
}

/**
 * Enforce memory cap on stream failures.
 */
function enforceStreamFailureCap() {
  const max = getStreamMaxFailures();
  if (_streamFailures.length > max) {
    _streamFailures = _streamFailures.slice(-max);
  }
}

/**
 * Count failures of a given type for a key within the current window.
 * @param {string} apiKey
 * @param {string} failureType
 * @returns {number}
 */
function countStreamFailures(apiKey, failureType) {
  const windowMs = getStreamWindowMs();
  const cutoff = Date.now() - windowMs;
  return _streamFailures.filter(
    (f) => f.apiKey === apiKey && f.type === failureType && f.at > cutoff
  ).length;
}

/**
 * Record a stream failure and auto-interdict if threshold is exceeded.
 *
 * This is the main ingress hook — call from audit-logger, pii-policy-store,
 * guardrail checks, auth middleware, etc. when a security failure occurs.
 *
 * @param {string} apiKey — The API key or user ID that triggered the failure
 * @param {string} failureType — One of STREAM_FAILURE_TYPES
 * @param {string} [detail] — Optional human-readable detail
 * @returns {{ recorded: boolean, count: number, interdicted: boolean, threshold: number }}
 */
function recordStreamFailure(apiKey, failureType, detail) {
  if (!apiKey || !failureType) return { recorded: false, count: 0, interdicted: false, threshold: 0 };
  if (!STREAM_FAILURE_TYPES.includes(failureType)) {
    return { recorded: false, count: 0, interdicted: false, threshold: 0 };
  }
  if (!isStreamInterdictionEnabled()) return { recorded: false, count: 0, interdicted: false, threshold: 0 };

  // Purge expired entries lazily
  purgeExpiredStreamFailures();

  // Record the failure
  _streamFailures.push({
    apiKey,
    type: failureType,
    detail: detail || null,
    at: Date.now(),
  });

  _streamInterdictionStats.totalFailuresRecorded++;
  _streamInterdictionStats.byType[failureType] = (_streamInterdictionStats.byType[failureType] || 0) + 1;

  // Enforce cap after adding
  enforceStreamFailureCap();

  // Check threshold
  const count = countStreamFailures(apiKey, failureType);
  const threshold = getStreamThreshold(failureType);

  if (count >= threshold) {
    // Auto-interdict the key
    const ttl = getStreamTtlMs();
    interdictKey(
      apiKey,
      `auto:stream_interdiction (${failureType} ${count}/${threshold} in window)`,
      ttl,
      'auto'
    );
    _streamInterdictionStats.totalAutoInterdicts++;
    _streamInterdictionStats.lastAutoInterdict = new Date().toISOString();
    return { recorded: true, count, interdicted: true, threshold };
  }

  return { recorded: true, count, interdicted: false, threshold };
}

/**
 * Get stream interdiction stats and current failure counts.
 * @returns {{ stats: object, recentFailures: array, byKey: object }}
 */
function getStreamFailureStats() {
  purgeExpiredStreamFailures();

  const windowMs = getStreamWindowMs();
  const cutoff = Date.now() - windowMs;

  // Aggregate by key+type
  const byKey = {};
  for (const f of _streamFailures) {
    if (f.at <= cutoff) continue;
    if (!byKey[f.apiKey]) byKey[f.apiKey] = {};
    byKey[f.apiKey][f.type] = (byKey[f.apiKey][f.type] || 0) + 1;
  }

  // Recent failures (last 20)
  const recentFailures = _streamFailures
    .filter((f) => f.at > cutoff)
    .slice(-20)
    .reverse()
    .map((f) => ({
      apiKey: f.apiKey.length > 8 ? f.apiKey.slice(0, 4) + '\u2026' + f.apiKey.slice(-4) : f.apiKey,
      type: f.type,
      detail: f.detail,
      at: new Date(f.at).toISOString(),
    }));

  return {
    enabled: isStreamInterdictionEnabled(),
    windowMs: getStreamWindowMs(),
    ttlMs: getStreamTtlMs(),
    thresholds: getStreamThresholds(),
    totalFailuresInWindow: _streamFailures.filter((f) => f.at > cutoff).length,
    stats: { ..._streamInterdictionStats, byType: { ..._streamInterdictionStats.byType } },
    recentFailures,
    byKey,
  };
}

/**
 * Clear all stream failures (for tests / admin reset).
 * @returns {number} Number of failures cleared
 */
function clearStreamFailures() {
  const count = _streamFailures.length;
  _streamFailures = [];
  return count;
}

/**
 * Reset stream interdiction stats (for tests).
 */
function _resetStreamInterdictionStats() {
  _streamInterdictionStats = {
    totalFailuresRecorded: 0,
    totalAutoInterdicts: 0,
    lastAutoInterdict: null,
    byType: {},
  };
  STREAM_FAILURE_TYPES.forEach((t) => {
    _streamInterdictionStats.byType[t] = 0;
  });
}

let _interdictedKeys = new Map();
let _interdictionStats = {
  totalBlocked: 0,
  totalReleased: 0,
  totalAutoTriggered: 0,
  totalRequestsRejected: 0,
  lastAutoTrigger: null,
};

function getInterdictionTtlMs() {
  const settings = getSettings();
  const ttl = settings.interdictionDefaultTtlMs;
  return typeof ttl === 'number' && ttl >= 1000 ? ttl : DEFAULT_INTERDICTION_TTL_MS;
}

function getInterdictionMaxKeys() {
  const settings = getSettings();
  const max = settings.interdictionMaxKeys;
  return typeof max === 'number' && max >= 100 ? max : MAX_INTERDICTED_KEYS;
}

function isAutoInterdictionEnabled() {
  const settings = getSettings();
  return settings.interdictionAutoTriggerEnabled !== false;
}

/**
 * Extract the API key from a request. Checks x-api-key header, query param,
 * and falls back to the authenticated user's ID for token-based auth.
 * @param {object} req — Express request
 * @returns {string|null}
 */
function extractApiKey(req) {
  return req.headers['x-api-key'] || req.query.apiKey || req.user?.id || null;
}

/**
 * Interdict (block) an API key for a specified duration.
 * @param {string} apiKey — The key to block
 * @param {string} reason — Why the key is being blocked
 * @param {number} [ttlMs] — Lockout duration (defaults to configured TTL)
 * @param {string} [source] — 'manual' or 'auto'
 * @returns {{ blocked: boolean, expiresAt: number }}
 */
function interdictKey(apiKey, reason, ttlMs, source = 'manual') {
  if (!apiKey) return { blocked: false, expiresAt: 0 };
  const ttl = ttlMs || getInterdictionTtlMs();
  const expiresAt = Date.now() + ttl;

  // Enforce memory cap — evict oldest entry if at limit
  const maxKeys = getInterdictionMaxKeys();
  if (_interdictedKeys.size >= maxKeys && !_interdictedKeys.has(apiKey)) {
    const oldestKey = _interdictedKeys.keys().next().value;
    if (oldestKey) _interdictedKeys.delete(oldestKey);
  }

  _interdictedKeys.set(apiKey, {
    reason: reason || 'unspecified',
    blockedAt: Date.now(),
    expiresAt,
    source,
  });

  _interdictionStats.totalBlocked++;
  if (source === 'auto') {
    _interdictionStats.totalAutoTriggered++;
    _interdictionStats.lastAutoTrigger = new Date().toISOString();
  }

  return { blocked: true, expiresAt };
}

/**
 * Release (unblock) an interdicted API key immediately.
 * @param {string} apiKey — The key to release
 * @returns {{ released: boolean, wasBlocked: boolean }}
 */
function releaseKey(apiKey) {
  if (!apiKey) return { released: false, wasBlocked: false };
  const wasBlocked = _interdictedKeys.has(apiKey);
  if (wasBlocked) {
    _interdictedKeys.delete(apiKey);
    _interdictionStats.totalReleased++;
  }
  return { released: true, wasBlocked };
}

/**
 * Check if a key is currently interdicted. Evicts expired entries lazily.
 * @param {string} apiKey
 * @returns {{ interdicted: boolean, reason: string|null, expiresAt: number|null }}
 */
function checkInterdiction(apiKey) {
  if (!apiKey) return { interdicted: false, reason: null, expiresAt: null };
  const block = _interdictedKeys.get(apiKey);
  if (!block) return { interdicted: false, reason: null, expiresAt: null };

  // Lazy TTL eviction
  if (Date.now() >= block.expiresAt) {
    _interdictedKeys.delete(apiKey);
    _interdictionStats.totalReleased++;
    return { interdicted: false, reason: null, expiresAt: null };
  }

  return { interdicted: true, reason: block.reason, expiresAt: block.expiresAt };
}

/**
 * Get a list of all currently interdicted keys with metadata.
 * Evicts expired entries during the scan.
 * @returns {{ keys: array, total: number, stats: object }}
 */
function getInterdictedKeys() {
  const now = Date.now();
  const keys = [];
  for (const [apiKey, block] of _interdictedKeys) {
    // Lazy eviction during scan
    if (now >= block.expiresAt) {
      _interdictedKeys.delete(apiKey);
      continue;
    }
    keys.push({
      apiKey: apiKey.length > 8 ? apiKey.slice(0, 4) + '…' + apiKey.slice(-4) : apiKey,
      reason: block.reason,
      blockedAt: new Date(block.blockedAt).toISOString(),
      expiresAt: new Date(block.expiresAt).toISOString(),
      source: block.source,
    });
  }
  return {
    keys,
    total: keys.length,
    stats: { ..._interdictionStats },
  };
}

/**
 * Clear all interdicted keys (for tests / admin reset).
 * @returns {number} Number of keys cleared
 */
function clearInterdictedKeys() {
  const count = _interdictedKeys.size;
  _interdictedKeys.clear();
  return count;
}

/**
 * Reset interdiction stats (for tests).
 */
function _resetInterdictionStats() {
  _interdictionStats = {
    totalBlocked: 0,
    totalReleased: 0,
    totalAutoTriggered: 0,
    totalRequestsRejected: 0,
    lastAutoTrigger: null,
  };
}

/**
 * Express middleware that enforces key interdiction. Must be mounted BEFORE
 * route handlers. Checks the request's API key against the block list and
 * returns HTTP 423 Locked if the key is currently interdicted.
 * @returns {function} Express middleware
 */
function enforceKeyInterdiction() {
  return function keyInterdictionMiddleware(req, res, next) {
    const apiKey = extractApiKey(req);
    if (!apiKey) return next();

    const status = checkInterdiction(apiKey);
    if (status.interdicted) {
      _interdictionStats.totalRequestsRejected++;
      return res.status(423).json({
        success: false,
        error: 'token_interdicted',
        message: 'This access key has been temporarily locked due to real-time security interdiction.',
        expiresAt: new Date(status.expiresAt).toISOString(),
      });
    }

    next();
  };
}

module.exports = {
  authorize,
  authorizeAny,
  enforceOrgPartition,
  resolveCallerOrgId,
  getPartitionViolations,
  getPartitionStats,
  // Violation retention policy
  purgeExpiredViolations,
  enforceViolationCap,
  clearViolations,
  startCleanupTimer,
  stopCleanupTimer,
  estimateViolationMemoryMb,
  recordViolation,
  // Key interdiction engine
  enforceKeyInterdiction,
  interdictKey,
  releaseKey,
  checkInterdiction,
  getInterdictedKeys,
  clearInterdictedKeys,
  extractApiKey,
  _resetInterdictionStats,
  // Stream interdiction engine
  recordStreamFailure,
  getStreamFailureStats,
  clearStreamFailures,
  _resetStreamInterdictionStats,
  STREAM_FAILURE_TYPES,
};
