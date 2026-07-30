/**
 * RBAC middleware — role-based access control for organization-scoped endpoints.
 *
 * Roles hierarchy:
 *   owner              — full control (delete org, manage billing, manage all members)
 *   team_lead          — manage members, view all metrics, manage settings
 *   compliance_officer — view all metrics, export reports, manage compliance rules
 *   auditor            — view metrics only (read-only)
 *
 * Usage:
 *   const { requireOrgRole, requireOrgMember } = require('./lib/rbac.cjs');
 *   router.get('/api/orgs/:orgId/metrics', requireOrgRole('auditor'), handler);
 */

'use strict';

const jwt = require('jsonwebtoken');
const db = require('./db.cjs');

const secret = process.env.SIMPLEBEACON_LICENSE_SECRET;

const ROLE_HIERARCHY = {
    owner: 4,
    team_lead: 3,
    compliance_officer: 2,
    auditor: 1,
};

function verifySessionToken(token) {
    if (!secret || !token) return null;
    try {
        const payload = jwt.verify(token, secret, { clockTolerance: 60 });
        return payload && payload.type === 'session' ? payload : null;
    } catch {
        return null;
    }
}

function extractToken(req) {
    const authHeader = req.headers.authorization || '';
    return authHeader.replace(/^Bearer\s+/i, '').trim();
}

function getAuthPayload(req) {
    const token = extractToken(req);
    if (!token) return null;
    return verifySessionToken(token);
}

function hasMinRole(userRole, requiredRole) {
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
    return userLevel >= requiredLevel;
}

/**
 * Middleware: require authenticated session.
 * Sets req.authPayload = { email, tier, role }.
 */
function requireAuth(req, res, next) {
    const payload = getAuthPayload(req);
    if (!payload) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.authPayload = payload;
    next();
}

/**
 * Middleware: require organization membership with at least the specified role.
 * Reads :orgId from route params.
 * Sets req.orgRole and req.organization on the request object.
 *
 * @param {string} minRole - Minimum role required ('auditor', 'compliance_officer', 'team_lead', 'owner')
 */
function requireOrgRole(minRole) {
    return (req, res, next) => {
        const payload = getAuthPayload(req);
        if (!payload) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        req.authPayload = payload;

        const orgId = req.params.orgId;
        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        const org = db.getOrganizationById(orgId);
        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        const memberInfo = db.getMemberRole(orgId, payload.email);
        if (!memberInfo) {
            return res.status(403).json({ error: 'You are not a member of this organization' });
        }
        if (memberInfo.status !== 'active') {
            return res.status(403).json({ error: 'Your membership is not active. Accept the invitation first.' });
        }

        if (!hasMinRole(memberInfo.role, minRole)) {
            return res.status(403).json({
                error: `This action requires the ${minRole} role or higher`,
                yourRole: memberInfo.role,
                requiredRole: minRole,
            });
        }

        req.orgRole = memberInfo.role;
        req.organization = org;
        next();
    };
}

/**
 * Middleware: require organization membership (any role, including pending).
 * Used for invitation acceptance endpoints.
 */
function requireOrgMember(req, res, next) {
    const payload = getAuthPayload(req);
    if (!payload) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.authPayload = payload;

    const orgId = req.params.orgId;
    if (!orgId) {
        return res.status(400).json({ error: 'Organization ID required' });
    }

    const org = db.getOrganizationById(orgId);
    if (!org) {
        return res.status(404).json({ error: 'Organization not found' });
    }

    const memberInfo = db.getMemberRole(orgId, payload.email);
    if (!memberInfo) {
        return res.status(403).json({ error: 'You are not a member of this organization' });
    }

    req.orgRole = memberInfo.role;
    req.orgMemberStatus = memberInfo.status;
    req.organization = org;
    next();
}

/**
 * Middleware: require site-wide admin (tier=admin or role=admin).
 */
function requireSiteAdmin(req, res, next) {
    const payload = getAuthPayload(req);
    if (!payload) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.authPayload = payload;

    const email = String(payload.email || '').toLowerCase();
    const role = String(payload.role || '').toLowerCase();
    const tier = String(payload.tier || '').toLowerCase();

    if (email === 'admin@simplebeacon.ai' || role === 'admin' || tier === 'admin') {
        return next();
    }
    return res.status(403).json({ error: 'Site administrator access required' });
}

module.exports = {
    requireAuth,
    requireOrgRole,
    requireOrgMember,
    requireSiteAdmin,
    hasMinRole,
    ROLE_HIERARCHY,
    getAuthPayload,
};
