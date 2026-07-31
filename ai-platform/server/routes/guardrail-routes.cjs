'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');
const incidentStore = require('../lib/guardrail-incident-store.cjs');
const { analyzePrompt } = require('../lib/prompt-firewall.cjs');
const auditLogger = require('../lib/audit-logger.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

const router = express.Router();

function getOrgId(req) {
  return req.user?.id || req.user?.email || 'default';
}

router.use(authenticate);

// ── GET /api/guardrails/incidents ───────────────────────────────────────────
//   Query: verdict, provider, actorId, startDate, endDate, limit, offset
router.get('/incidents', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const result = incidentStore.query({
      orgId,
      verdict: req.query.verdict || '',
      provider: req.query.provider || '',
      actorId: req.query.actorId || '',
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      limit: Math.min(parseInt(req.query.limit, 10) || 100, 500),
      offset: Math.max(parseInt(req.query.offset, 10) || 0, 0),
    });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.warn('[Guardrail] incidents_fetch_failed failed:', err.message);
    sendError(res, 500, 'incidents_fetch_failed', { message: err.message });
  }
});

// ── GET /api/guardrails/stats ───────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const stats = incidentStore.getStats(orgId);
    res.json({ success: true, stats });
  } catch (err) {
    logger.warn('[Guardrail] guardrail_stats_failed failed:', err.message);
    sendError(res, 500, 'guardrail_stats_failed', { message: err.message });
  }
});

// ── POST /api/guardrails/test ───────────────────────────────────────────────
//   Test a prompt against the firewall without sending to an LLM
router.post('/test', (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text || typeof text !== 'string') return sendError(res, 400, 'text is required');
    const result = analyzePrompt(text);
    res.json({ success: true, result });
  } catch (err) {
    logger.warn('[Guardrail] guardrail_test_failed failed:', err.message);
    sendError(res, 500, 'guardrail_test_failed', { message: err.message });
  }
});

module.exports = router;
