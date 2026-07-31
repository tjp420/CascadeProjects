// simplebeacon-ignore test-coverage
/**
 * Row-Level Security (RLS) Middleware & RBAC Utilities
 * Enforces workspace-scoped PostgreSQL transactions to prevent cross-tenant leakage.
 */

const logger = require('./app-logger.cjs');

/**
 * Express middleware: opens a scoped PostgreSQL transaction with SET LOCAL
 * app.current_workspace_id for every request that carries a workspace.
 * Expects req.db (DatabaseAdapter instance) and req.user.workspaceId to be set.
 */
function setWorkspaceRlsContext(req, res, next) {
  // Store original db.query so the route can use the scoped client
  const db = req.db;
  if (!db) {
    logger.warn('[RBAC] req.db missing — skipping RLS guard');
    return next();
  }

  const workspaceId = req.user?.workspaceId || req.user?.organizationId || null;
  if (!workspaceId) {
    logger.warn('[RBAC] No workspaceId/organizationId in req.user — skipping RLS guard');
    return next();
  }

  // Wrap the remainder of the request lifecycle inside a transaction
  db.transaction(workspaceId, async (client) => {
    // Inject scoped client into req for downstream route handlers
    req.scopedClient = client;
    // Override db.query on req so controllers use the transaction-scoped client
    req.dbQuery = (sql, params) => client.query(sql, params);

    // Continue to the actual route handler
    return new Promise((resolve, reject) => {
      // Override res.end / res.send to capture completion and resolve the promise
      const originalEnd = res.end.bind(res);
      const originalSend = res.send.bind(res);
      const originalJson = res.json.bind(res);

      res.end = function (...args) {
        res.end = originalEnd;
        resolve();
        return originalEnd(...args);
      };
      res.send = function (...args) {
        res.send = originalSend;
        res.end = originalEnd;
        resolve();
        return originalSend(...args);
      };
      res.json = function (...args) {
        res.json = originalJson;
        res.send = originalSend;
        res.end = originalEnd;
        resolve();
        return originalJson(...args);
      };

      // Catch route-level errors
      const handleError = (err) => {
        res.end = originalEnd;
        res.send = originalSend;
        res.json = originalJson;
        reject(err);
      };

      try {
        next();
      } catch (err) {
        handleError(err);
      }
    });
  }).catch((err) => {
    // Transaction rolled back — propagate error if response not yet sent
    if (!res.headersSent) {
      logger.error('[RBAC] RLS transaction failed:', err.message);
      res.status(500).json({ error: 'Workspace transaction failed', message: err.message });
    }
  });
}

/**
 * Factory: returns Express middleware that requires a specific permission.
 * Checks req.user.permissions array.
 */
function requirePermission(permission) {
  return (req, res, next) => {
    const perms = req.user?.permissions || [];
    if (perms.includes(permission) || perms.includes('admin:all')) {
      return next();
    }
    logger.warn('[RBAC] Permission denied:', permission, req.user?.id);
    return res.status(403).json({ error: 'Forbidden', required: permission });
  };
}

/**
 * Factory: returns Express middleware that requires any of the listed permissions.
 */
function requireAnyPermission(...permissions) {
  return (req, res, next) => {
    const perms = req.user?.permissions || [];
    const allowed = permissions.some((p) => perms.includes(p) || perms.includes('admin:all'));
    if (allowed) {
      return next();
    }
    logger.warn('[RBAC] Permission denied (any):', permissions, req.user?.id);
    return res.status(403).json({ error: 'Forbidden', required: permissions });
  };
}

module.exports = {
  setWorkspaceRlsContext,
  requirePermission,
  requireAnyPermission,
};
