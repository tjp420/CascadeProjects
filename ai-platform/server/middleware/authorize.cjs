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
};
