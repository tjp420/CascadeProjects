'use strict';

/**
 * Egress Guardrail Policy API — CRUD endpoints for managing outbound
 * leak detection and malicious payload patterns.
 *
 * Endpoints:
 *   GET    /api/egress/policies           — List policies for org
 *   GET    /api/egress/policies/:id       — Get a specific policy
 *   POST   /api/egress/policies           — Create a new policy
 *   PUT    /api/egress/policies/:id       — Update a policy
 *   DELETE /api/egress/policies/:id       — Delete a policy
 *   POST   /api/egress/test               — Test a pattern against sample text
 *   GET    /api/egress/stats              — Policy stats for org
 *
 * @module egress-policy-routes
 */

const express = require('express');
const egressGuardrailStore = require('../lib/egress-guardrail-store.cjs');
const { authenticate, authorize } = require('../middleware/auth.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs');

const router = express.Router();

function getOrgId(req) {
  return req.user?.id || req.user?.email || 'default';
}

router.use(authenticate);

// GET /api/egress/policies
router.get('/policies', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const policies = egressGuardrailStore.getPolicies(orgId);
    res.json({ success: true, policies });
  } catch (err) {
    logger.warn('[Egress] list_failed:', err.message);
    sendError(res, 500, 'egress_list_failed', { message: err.message });
  }
});

// GET /api/egress/policies/:id
router.get('/policies/:id', (req, res) => {
  try {
    const policy = egressGuardrailStore.getPolicy(req.params.id);
    if (!policy) return sendError(res, 404, 'egress_policy_not_found');
    const orgId = getOrgId(req);
    if (policy.orgId !== orgId) return sendError(res, 403, 'egress_policy_access_denied');
    res.json({ success: true, policy });
  } catch (err) {
    logger.warn('[Egress] get_failed:', err.message);
    sendError(res, 500, 'egress_get_failed', { message: err.message });
  }
});

// POST /api/egress/policies
router.post('/policies', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const result = egressGuardrailStore.createPolicy({
      orgId,
      name: req.body.name,
      description: req.body.description,
      pattern: req.body.pattern,
      flags: req.body.flags,
      category: req.body.category,
      action: req.body.action,
      severity: req.body.severity,
      replacement: req.body.replacement,
      enabled: req.body.enabled,
    });
    if (!result.success) {
      return sendError(res, 400, 'egress_create_failed', { message: result.error });
    }
    logger.info(`[Egress] Policy created: ${result.policy.id} by ${req.user?.email || 'admin'}`);
    res.json({ success: true, policy: result.policy });
  } catch (err) {
    logger.warn('[Egress] create_failed:', err.message);
    sendError(res, 500, 'egress_create_failed', { message: err.message });
  }
});

// PUT /api/egress/policies/:id
router.put('/policies/:id', authorize('admin:all'), (req, res) => {
  try {
    const policy = egressGuardrailStore.getPolicy(req.params.id);
    if (!policy) return sendError(res, 404, 'egress_policy_not_found');
    const orgId = getOrgId(req);
    if (policy.orgId !== orgId) return sendError(res, 403, 'egress_policy_access_denied');

    const allowedFields = ['name', 'description', 'pattern', 'flags', 'category', 'action', 'severity', 'replacement', 'enabled'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const result = egressGuardrailStore.updatePolicy(req.params.id, updates);
    if (!result.success) {
      return sendError(res, 400, 'egress_update_failed', { message: result.error });
    }
    logger.info(`[Egress] Policy updated: ${req.params.id} by ${req.user?.email || 'admin'}`);
    res.json({ success: true, policy: result.policy });
  } catch (err) {
    logger.warn('[Egress] update_failed:', err.message);
    sendError(res, 500, 'egress_update_failed', { message: err.message });
  }
});

// DELETE /api/egress/policies/:id
router.delete('/policies/:id', authorize('admin:all'), (req, res) => {
  try {
    const policy = egressGuardrailStore.getPolicy(req.params.id);
    if (!policy) return sendError(res, 404, 'egress_policy_not_found');
    const orgId = getOrgId(req);
    if (policy.orgId !== orgId) return sendError(res, 403, 'egress_policy_access_denied');

    const deleted = egressGuardrailStore.deletePolicy(req.params.id);
    if (!deleted) return sendError(res, 404, 'egress_policy_not_found');
    logger.info(`[Egress] Policy deleted: ${req.params.id} by ${req.user?.email || 'admin'}`);
    res.json({ success: true });
  } catch (err) {
    logger.warn('[Egress] delete_failed:', err.message);
    sendError(res, 500, 'egress_delete_failed', { message: err.message });
  }
});

// POST /api/egress/test
router.post('/test', authorize('admin:all'), (req, res) => {
  try {
    const { pattern, flags, replacement, text } = req.body;
    if (!pattern || !text) {
      return sendError(res, 400, 'pattern and text are required');
    }

    const validation = egressGuardrailStore.validateRegex(pattern, flags || 'gi');
    if (!validation.valid) {
      return res.json({ success: true, valid: false, error: validation.error });
    }

    const regex = new RegExp(pattern, flags || 'gi');
    const matches = [];
    let match;
    const regexForMatches = new RegExp(pattern, flags || 'gi');
    while ((match = regexForMatches.exec(text)) !== null) {
      matches.push({ value: match[0], index: match.index, length: match[0].length });
      if (match.index === regexForMatches.lastIndex) regexForMatches.lastIndex++;
    }

    const redacted = replacement
      ? text.replace(regex, replacement)
      : text;

    res.json({
      success: true,
      valid: true,
      matchCount: matches.length,
      matches: matches.slice(0, 20),
      redactedPreview: redacted.slice(0, 500),
    });
  } catch (err) {
    logger.warn('[Egress] test_failed:', err.message);
    sendError(res, 500, 'egress_test_failed', { message: err.message });
  }
});

// GET /api/egress/stats
router.get('/stats', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const stats = egressGuardrailStore.getStats(orgId);
    res.json({ success: true, ...stats });
  } catch (err) {
    logger.warn('[Egress] stats_failed:', err.message);
    sendError(res, 500, 'egress_stats_failed', { message: err.message });
  }
});

module.exports = router;
