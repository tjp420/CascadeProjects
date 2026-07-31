'use strict';

/**
 * Authorization Middleware — checks user permissions against required
 * permissions for each endpoint. Must be used after authenticate middleware.
 *
 * Usage:
 *   const { authorize } = require('../middleware/authorize.cjs');
 *   router.post('/violations', authorize('write:tickets'), handler);
 *   router.delete('/suites/:id', authorize('delete:all'), handler);
 */

const rbacStore = require('../lib/rbac-store.cjs');

function getOrgId(req) {
  return req.user?.id || req.user?.email || 'default';
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

module.exports = { authorize, authorizeAny };
