'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');
const { authorize } = require('../middleware/authorize.cjs');
const rbacStore = require('../lib/rbac-store.cjs');
const auditLogger = require('../lib/audit-logger.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

const router = express.Router();

function getOrgId(req) {
  return req.user?.id || req.user?.email || 'default';
}

router.use(authenticate);

// ── GET /api/rbac/roles ─────────────────────────────────────────────────────
//   List all available roles with their permissions
router.get('/roles', (req, res) => {
  const roles = Object.values(rbacStore.ROLES);
  res.json({ success: true, roles });
});

// ── GET /api/rbac/permissions ───────────────────────────────────────────────
//   List all available permissions
router.get('/permissions', (req, res) => {
  res.json({ success: true, permissions: rbacStore.PERMISSIONS });
});

// ── GET /api/rbac/assignments ───────────────────────────────────────────────
//   List all role assignments for the org (requires admin:all)
router.get('/assignments', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const assignments = rbacStore.getAllAssignments(orgId);
    res.json({ success: true, assignments });
  } catch (err) {
    sendError(res, 500, 'assignments_fetch_failed', { message: err.message });
  }
});

// ── POST /api/rbac/assignments ──────────────────────────────────────────────
//   Assign a role to a user (requires admin:all)
router.post('/assignments', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { userId, role } = req.body || {};
    if (!userId) return sendError(res, 400, 'userId is required');
    if (!role) return sendError(res, 400, 'role is required');
    if (!rbacStore.ROLES[role]) return sendError(res, 400, `Invalid role. Valid roles: ${rbacStore.ALL_ROLE_IDS.join(', ')}`);

    const assignment = rbacStore.setAssignment(userId, role, orgId, req.user?.email);
    auditLogger.log({
      orgId,
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'CREATE',
      entity: 'rbac_assignment',
      entityId: userId,
      newValue: assignment,
      metadata: { route: req.originalUrl, roleAssigned: role },
    });
    res.json({ success: true, assignment });
  } catch (err) {
    sendError(res, 500, 'assignment_save_failed', { message: err.message });
  }
});

// ── DELETE /api/rbac/assignments/:userId ────────────────────────────────────
//   Remove a user's role assignment (requires admin:all)
router.delete('/assignments/:userId', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const oldAssignment = rbacStore.getAssignment(req.params.userId, orgId);
    rbacStore.deleteAssignment(req.params.userId, orgId);
    auditLogger.log({
      orgId,
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'DELETE',
      entity: 'rbac_assignment',
      entityId: req.params.userId,
      oldValue: oldAssignment,
      metadata: { route: req.originalUrl },
    });
    res.json({ success: true, deleted: req.params.userId });
  } catch (err) {
    sendError(res, 500, 'assignment_delete_failed', { message: err.message });
  }
});

// ── GET /api/rbac/assignments/:userId ───────────────────────────────────────
//   Get a specific user's role assignment
router.get('/assignments/:userId', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const assignment = rbacStore.getAssignment(req.params.userId, orgId);
    // Also resolve from JWT fallback
    const resolved = rbacStore.resolveUserRole(req.params.userId, orgId, req.user?.role);
    res.json({ success: true, assignment, resolved });
  } catch (err) {
    sendError(res, 500, 'assignment_fetch_failed', { message: err.message });
  }
});

// ── GET /api/rbac/me ────────────────────────────────────────────────────────
//   Get the current user's resolved role and permissions
router.get('/me', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const userId = req.user?.id || req.user?.email;
    const resolved = rbacStore.resolveUserRole(userId, orgId, req.user?.role);
    res.json({ success: true, userId, ...resolved });
  } catch (err) {
    sendError(res, 500, 'role_resolve_failed', { message: err.message });
  }
});

// ── POST /api/rbac/check ────────────────────────────────────────────────────
//   Check if the current user has a specific permission
router.post('/check', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const userId = req.user?.id || req.user?.email;
    const { permission } = req.body || {};
    if (!permission) return sendError(res, 400, 'permission is required');

    const { role, permissions, source } = rbacStore.resolveUserRole(userId, orgId, req.user?.role);
    const allowed = rbacStore.hasPermission(permissions, permission);
    res.json({ success: true, allowed, permission, role, source });
  } catch (err) {
    sendError(res, 500, 'permission_check_failed', { message: err.message });
  }
});

// ── GET /api/rbac/stats ─────────────────────────────────────────────────────
//   Get aggregate stats for the org (requires admin:all)
router.get('/stats', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const stats = rbacStore.getStats(orgId);
    res.json({ success: true, stats });
  } catch (err) {
    sendError(res, 500, 'rbac_stats_failed', { message: err.message });
  }
});

module.exports = router;
