/**
 * SimpleBeacon Enterprise RBAC — Role-based access control middleware.
 *
 * Relies on the role_permissions table seeded by migration 004.
 */

const db = require("./db.cjs");

/**
 * Fetch all permission codes granted to a role name.
 * @param {string} roleName
 * @returns {Promise<string[]>}
 */
async function getRolePermissions(roleName) {
  const rows = await db.query(
    `SELECT p.code
         FROM permissions p
         JOIN role_permissions rp ON p.id = rp.permission_id
         JOIN roles r ON r.id = rp.role_id
         WHERE r.name = $1`,
    [roleName],
  );
  return rows.map((r) => r.code);
}

/**
 * Check if a role has a specific permission.
 * @param {string} roleName
 * @param {string} permissionCode
 * @returns {Promise<boolean>}
 */
async function hasPermission(roleName, permissionCode) {
  const perms = await getRolePermissions(roleName);
  return perms.includes(permissionCode);
}

/**
 * Express middleware factory: require a specific permission.
 * Must be used *after* requireAuth (so req.auth exists).
 * @param {string} permissionCode
 * @returns {Function}
 */
function requirePermission(permissionCode) {
  return async (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const ok = await hasPermission(req.auth.role, permissionCode);
    if (!ok) {
      return res
        .status(403)
        .json({ error: "Forbidden", required: permissionCode });
    }
    next();
  };
}

/**
 * Express middleware factory: require any of the listed permissions.
 * @param {string[]} permissionCodes
 * @returns {Function}
 */
function requireAnyPermission(permissionCodes) {
  return async (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const perms = await getRolePermissions(req.auth.role);
    const ok = permissionCodes.some((code) => perms.includes(code));
    if (!ok) {
      return res
        .status(403)
        .json({ error: "Forbidden", required: permissionCodes });
    }
    next();
  };
}

/**
 * Middleware: verify the authenticated user is a member of the workspace
 * specified in req.params.workspaceId (or req.body.workspaceId).
 * Attaches req.membership = { role_id, role_name, invitation_accepted }.
 * Returns 403 if not a member.
 */
async function requireWorkspaceMembership(req, res, next) {
  if (!req.auth) {
    return res.status(401).json({ error: "Authentication required" });
  }
  const workspaceId = req.params.workspaceId || req.body.workspaceId;
  if (!workspaceId) {
    return res.status(400).json({ error: "workspaceId required" });
  }

  const membership = await db.get(
    `SELECT wm.role_id, r.name AS role_name, wm.invitation_accepted
         FROM workspace_members wm
         JOIN roles r ON r.id = wm.role_id
         WHERE wm.workspace_id = $1 AND wm.user_id = $2`,
    [workspaceId, req.auth.userId],
  );

  if (!membership) {
    return res.status(403).json({ error: "Workspace access denied" });
  }
  if (!membership.invitation_accepted) {
    return res
      .status(403)
      .json({
        error: "Invitation pending — accept invite to access workspace",
      });
  }

  req.membership = membership;
  req.workspaceId = workspaceId;
  next();
}

/**
 * Middleware: set RLS context for PostgreSQL row-level security.
 * Must be used after requireWorkspaceMembership.
 * Executes `SET app.current_workspace_id = '<uuid>'` on the current connection.
 */
async function setWorkspaceRlsContext(req, res, next) {
  if (!req.workspaceId) {
    return next(); // No workspace context — org-level request
  }
  try {
    await db.query(`SELECT set_config('app.current_workspace_id', $1, true)`, [
      req.workspaceId,
    ]);
    next();
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Failed to set workspace isolation context" });
  }
}

module.exports = {
  getRolePermissions,
  hasPermission,
  requirePermission,
  requireAnyPermission,
  requireWorkspaceMembership,
  setWorkspaceRlsContext,
};
