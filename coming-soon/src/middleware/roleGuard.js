'use strict';

const ROLE_PERMISSIONS = {
  owner: [
    'tenant:read',
    'reports:read',
    'reports:write',
    'history:read',
    'workspaces:read',
    'workspaces:write',
    'members:invite',
    'members:mutate',
    'tenant:metadata:write',
    'audit_logs:read',
    'audit_logs:export',
    'compliance:write'
  ],
  auditor: [
    'tenant:read',
    'reports:read',
    'history:read',
    'workspaces:read',
    'audit_logs:read'
  ],
  team_lead: [
    'tenant:read',
    'reports:read',
    'reports:write',
    'history:read',
    'workspaces:read',
    'workspaces:write',
    'scans:execute',
    'configs:write',
    'members:invite',
    'members:mutate',
    'audit_logs:read'
  ],
  compliance_officer: [
    'tenant:read',
    'reports:read',
    'reports:write',
    'history:read',
    'workspaces:read',
    'workspaces:write',
    'scans:execute',
    'configs:write',
    'policies:approve',
    'audit_logs:export',
    'compliance:write'
  ],
  admin: [
    'tenant:read',
    'reports:read',
    'reports:write',
    'history:read',
    'workspaces:read',
    'workspaces:write',
    'scans:execute',
    'configs:write',
    'policies:approve',
    'audit_logs:read',
    'audit_logs:export',
    'compliance:write',
    'members:invite',
    'members:mutate',
    'tenant:metadata:write'
  ]
};

/**
 * Express route-level permissions guard.
 */
function enforcePermissions(requiredPermission) {
  return (req, res, next) => {
    if (!req.authContext || !req.authContext.role) {
      return res.status(403).json({ error: 'Access Denied: Missing operational authentication context' });
    }

    const assignedRole = req.authContext.role;
    const authorizedActions = ROLE_PERMISSIONS[assignedRole] || [];

    if (!authorizedActions.includes(requiredPermission)) {
      return res.status(403).json({ error: `Forbidden: Role '${assignedRole}' lacks access to '${requiredPermission}'` });
    }

    return next();
  };
}

module.exports = { enforcePermissions, ROLE_PERMISSIONS };
