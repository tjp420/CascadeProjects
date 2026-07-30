'use strict';

const db = require('../../lib/db.cjs');

function resolveAuthenticatedContext(req) {
  const authPayload = req.authPayload || {};
  const requestUser = req.user || {};

  return {
    email: String(
      authPayload.email || authPayload.id || requestUser.email || requestUser.id || ''
    ).trim(),
    role: String(
      authPayload.role || authPayload.tier || requestUser.role || requestUser.tier || 'auditor'
    ).trim(),
    tenantId: String(
      req.headers['x-tenant-id']
      || req.params?.orgId
      || req.query?.orgId
      || authPayload.tenantId
      || requestUser.tenantId
      || ''
    ).trim()
  };
}

/**
 * Express tenant context extractor.
 * Binds user, tenant, and role context to the request for downstream RBAC checks.
 */
function extractTenantContext(req, res, next) {
  try {
    const resolved = resolveAuthenticatedContext(req);
    const userEmail = resolved.email;
    if (!userEmail) {
      return res.status(401).json({ error: 'Unauthenticated: Missing user token context' });
    }

    const activeTenantId = resolved.tenantId;
    const fallbackRole = resolved.role;

    if (!activeTenantId) {
      return res.status(400).json({ error: 'Bad Request: Missing target context identifier' });
    }

    const memberInfo = db.getMemberRole(activeTenantId, String(userEmail).toLowerCase());
    if (!memberInfo) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this tenant context' });
    }
    if (memberInfo.status !== 'active') {
      return res.status(403).json({ error: 'Forbidden: Tenant membership is not active' });
    }

    req.authContext = {
      userId: String(userEmail).toLowerCase(),
      tenantId: activeTenantId,
      role: memberInfo.role || fallbackRole
    };

    return next();
  } catch (_err) {
    return res.status(500).json({ error: 'Internal Server Error during context initialization' });
  }
}

module.exports = { extractTenantContext, resolveAuthenticatedContext };
