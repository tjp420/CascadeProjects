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
};
