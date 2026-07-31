'use strict';

/**
 * Authorization Middleware — checks user permissions against required
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

function getOrgId(req) {
  return req.user?.id || req.user?.email || 'default';
}

// ── Org Partition Enforcement ───────────────────────────────────────────────

let _partitionViolations = [];
const MAX_VIOLATION_LOG = 100;

function recordViolation(violation) {
  _partitionViolations.unshift({ ...violation, at: new Date().toISOString() });
  if (_partitionViolations.length > MAX_VIOLATION_LOG) {
    _partitionViolations = _partitionViolations.slice(0, MAX_VIOLATION_LOG);
  }
}

function getPartitionViolations() {
  return _partitionViolations;
}

function getPartitionStats() {
  return {
    totalViolations: _partitionViolations.length,
    recentViolations: _partitionViolations.slice(0, 10),
    enforcementEnabled: true,
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
 * @param {string} requiredPermission — e.g. 'write:tickets', 'delete:all', 'read:audit'
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
};
