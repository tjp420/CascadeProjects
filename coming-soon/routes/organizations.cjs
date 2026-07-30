/**
 * Organization API routes — multi-tenant RBAC management.
 *
 * Endpoints:
 *   POST   /api/orgs                              — create organization (owner)
 *   GET    /api/orgs                              — list user's organizations
 *   GET    /api/orgs/:orgId                       — get organization details
 *   PATCH  /api/orgs/:orgId                       — update organization (team_lead+)
 *   DELETE /api/orgs/:orgId                       — delete organization (owner only)
 *   GET    /api/orgs/:orgId/members               — list members (auditor+)
 *   POST   /api/orgs/:orgId/members               — invite member (team_lead+)
 *   PATCH  /api/orgs/:orgId/members/:email        — update member role (team_lead+)
 *   DELETE /api/orgs/:orgId/members/:email        — remove member (team_lead+)
 *   POST   /api/orgs/:orgId/accept                — accept invitation (any member)
 *   GET    /api/orgs/:orgId/metrics               — view org metrics (auditor+)
 *   GET    /api/orgs/:orgId/reports               — view org reports (compliance_officer+)
 */

'use strict';

const express = require('express');
const router = express.Router();
const db = require('../lib/db.cjs');
const { requireAuth, requireOrgRole, requireOrgMember } = require('../lib/rbac.cjs');

// POST /api/orgs — create a new organization
router.post('/api/orgs', requireAuth, express.json(), (req, res) => {
    try {
        const { name, slug, plan, maxSeats } = req.body || {};
        if (!name || typeof name !== 'string' || name.trim().length < 2) {
            return res.status(400).json({ error: 'Organization name required (min 2 characters)' });
        }
        if (!slug || typeof slug !== 'string' || slug.trim().length < 2) {
            return res.status(400).json({ error: 'Organization slug required (min 2 characters)' });
        }

        const existing = db.getOrganizationBySlug(slug);
        if (existing) {
            return res.status(409).json({ error: 'Organization slug already in use' });
        }

        const org = db.createOrganization(name, slug, req.authPayload.email, plan || 'team', maxSeats || 10);
        res.status(201).json({ success: true, organization: org });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create organization', detail: err.message });
    }
});

// GET /api/orgs — list organizations for the authenticated user
router.get('/api/orgs', requireAuth, (req, res) => {
    try {
        const orgs = db.getOrganizationsForUser(req.authPayload.email);
        res.json({ success: true, organizations: orgs, total: orgs.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list organizations', detail: err.message });
    }
});

// GET /api/orgs/:orgId — get organization details
router.get('/api/orgs/:orgId', requireOrgRole('auditor'), (req, res) => {
    res.json({ success: true, organization: req.organization, yourRole: req.orgRole });
});

// PATCH /api/orgs/:orgId — update organization settings
router.patch('/api/orgs/:orgId', requireOrgRole('team_lead'), express.json(), (req, res) => {
    try {
        const { name, plan, maxSeats } = req.body || {};
        const updated = db.updateOrganization(req.params.orgId, { name, plan, maxSeats });
        if (!updated) {
            return res.status(404).json({ error: 'Organization not found' });
        }
        res.json({ success: true, organization: updated });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update organization', detail: err.message });
    }
});

// DELETE /api/orgs/:orgId — delete organization (owner only)
router.delete('/api/orgs/:orgId', requireOrgRole('owner'), (req, res) => {
    try {
        db.deleteOrganization(req.params.orgId);
        res.json({ success: true, deleted: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete organization', detail: err.message });
    }
});

// GET /api/orgs/:orgId/members — list organization members
router.get('/api/orgs/:orgId/members', requireOrgRole('auditor'), (req, res) => {
    try {
        const members = db.getOrganizationMembers(req.params.orgId);
        res.json({ success: true, members, total: members.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list members', detail: err.message });
    }
});

// POST /api/orgs/:orgId/members — invite a member
router.post('/api/orgs/:orgId/members', requireOrgRole('team_lead'), express.json(), (req, res) => {
    try {
        const { email, role } = req.body || {};
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Valid email required' });
        }
        const validRoles = ['team_lead', 'compliance_officer', 'auditor'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: `Invalid role. Use one of: ${validRoles.join(', ')}` });
        }

        const memberCount = db.countOrganizationMembers(req.params.orgId);
        const org = req.organization;
        if (memberCount >= org.max_seats) {
            return res.status(403).json({ error: 'Organization has reached its seat limit', maxSeats: org.max_seats });
        }

        const member = db.addOrganizationMember(req.params.orgId, email, role, req.authPayload.email);
        res.status(201).json({ success: true, member });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add member', detail: err.message });
    }
});

// PATCH /api/orgs/:orgId/members/:email — update member role
router.patch('/api/orgs/:orgId/members/:email', requireOrgRole('team_lead'), express.json(), (req, res) => {
    try {
        const { email } = req.params;
        const { role } = req.body || {};

        const targetMember = db.getMemberRole(req.params.orgId, email);
        if (!targetMember) {
            return res.status(404).json({ error: 'Member not found' });
        }
        if (targetMember.role === 'owner') {
            return res.status(403).json({ error: 'Cannot modify the organization owner' });
        }

        const validRoles = ['team_lead', 'compliance_officer', 'auditor'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({ error: `Invalid role. Use one of: ${validRoles.join(', ')}` });
        }

        const updated = db.updateMemberRole(req.params.orgId, email, role);
        res.json({ success: true, member: updated });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update member role', detail: err.message });
    }
});

// DELETE /api/orgs/:orgId/members/:email — remove member
router.delete('/api/orgs/:orgId/members/:email', requireOrgRole('team_lead'), (req, res) => {
    try {
        const { email } = req.params;

        const targetMember = db.getMemberRole(req.params.orgId, email);
        if (!targetMember) {
            return res.status(404).json({ error: 'Member not found' });
        }
        if (targetMember.role === 'owner') {
            return res.status(403).json({ error: 'Cannot remove the organization owner' });
        }

        db.removeOrganizationMember(req.params.orgId, email);
        res.json({ success: true, removed: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove member', detail: err.message });
    }
});

// POST /api/orgs/:orgId/accept — accept pending invitation
router.post('/api/orgs/:orgId/accept', requireOrgMember, (req, res) => {
    try {
        if (req.orgMemberStatus === 'active') {
            return res.json({ success: true, message: 'Already an active member', role: req.orgRole });
        }
        const member = db.acceptInvitation(req.params.orgId, req.authPayload.email);
        res.json({ success: true, member });
    } catch (err) {
        res.status(500).json({ error: 'Failed to accept invitation', detail: err.message });
    }
});

// GET /api/orgs/:orgId/metrics — view organization metrics (auditor+)
router.get('/api/orgs/:orgId/metrics', requireOrgRole('auditor'), (req, res) => {
    try {
        const members = db.getOrganizationMembers(req.params.orgId);
        const activeMembers = members.filter(m => m.status === 'active');
        res.json({
            success: true,
            metrics: {
                organization: {
                    id: req.organization.id,
                    name: req.organization.name,
                    slug: req.organization.slug,
                    plan: req.organization.plan,
                },
                members: {
                    total: members.length,
                    active: activeMembers.length,
                    pending: members.filter(m => m.status === 'pending').length,
                },
                seats: {
                    used: activeMembers.length,
                    max: req.organization.max_seats,
                },
                roles: activeMembers.reduce((acc, m) => {
                    acc[m.role] = (acc[m.role] || 0) + 1;
                    return acc;
                }, {}),
            },
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load metrics', detail: err.message });
    }
});

// GET /api/orgs/:orgId/reports — view organization reports (compliance_officer+)
router.get('/api/orgs/:orgId/reports', requireOrgRole('compliance_officer'), (req, res) => {
    try {
        const members = db.getOrganizationMembers(req.params.orgId);
        const memberEmails = members.filter(m => m.status === 'active').map(m => m.user_email);

        const reports = [];
        for (const email of memberEmails) {
            const userReports = db.getCliReportsByEmail(email);
            reports.push(...userReports);
        }

        res.json({
            success: true,
            reports: reports.slice(0, 100),
            total: reports.length,
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load reports', detail: err.message });
    }
});

module.exports = router;
