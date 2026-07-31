'use strict';

/**
 * PII Redaction Policy API — CRUD endpoints for managing per-organization
 * custom regex-based PII masking patterns.
 *
 * Endpoints:
 *   GET    /api/pii/policies           — List policies for org
 *   GET    /api/pii/policies/:id       — Get a specific policy
 *   POST   /api/pii/policies           — Create a new policy
 *   PUT    /api/pii/policies/:id       — Update a policy
 *   DELETE /api/pii/policies/:id       — Delete a policy
 *   POST   /api/pii/test               — Test a pattern against sample text
 *   GET    /api/pii/stats              — Policy stats for org
 *
 * @module pii-policy-routes
 */

const express = require('express');
const piiPolicyStore = require('../lib/pii-policy-store.cjs');
const auditLogger = require('../lib/audit-logger.cjs');
let securityMonitor;
try {
  securityMonitor = require('../lib/security-monitor.cjs');
} catch {
  securityMonitor = null;
}
const { authenticate } = require('../middleware/auth.cjs');
const { authorize } = require('../middleware/authorize.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs');

const router = express.Router();

function getOrgId(req) {
  return req.user?.id || req.user?.email || 'default';
}

// All routes require authentication
router.use(authenticate);

// GET /api/pii/policies — list policies for org
router.get('/policies', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const policies = piiPolicyStore.getPolicies(orgId);
    res.json({ success: true, policies });
  } catch (err) {
    logger.warn('[PII] list_failed:', err.message);
    sendError(res, 500, 'pii_list_failed', { message: err.message });
  }
});

// GET /api/pii/policies/:id — get a specific policy
router.get('/policies/:id', (req, res) => {
  try {
    const policy = piiPolicyStore.getPolicy(req.params.id);
    if (!policy) return sendError(res, 404, 'pii_policy_not_found');
    const orgId = getOrgId(req);
    if (policy.orgId !== orgId) return sendError(res, 403, 'pii_policy_access_denied');
    res.json({ success: true, policy });
  } catch (err) {
    logger.warn('[PII] get_failed:', err.message);
    sendError(res, 500, 'pii_get_failed', { message: err.message });
  }
});

// POST /api/pii/policies — create a new policy (admin only)
router.post('/policies', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const result = piiPolicyStore.createPolicy({
      orgId,
      name: req.body.name,
      description: req.body.description,
      pattern: req.body.pattern,
      flags: req.body.flags,
      replacement: req.body.replacement,
      severity: req.body.severity,
      enabled: req.body.enabled,
      compliance: req.body.compliance,
    });
    if (!result.success) {
      return sendError(res, 400, 'pii_create_failed', { message: result.error });
    }
    logger.info(`[PII] Policy created: ${result.policy.id} by ${req.user?.email || 'admin'}`);
    res.json({ success: true, policy: result.policy });
  } catch (err) {
    logger.warn('[PII] create_failed:', err.message);
    sendError(res, 500, 'pii_create_failed', { message: err.message });
  }
});

// PUT /api/pii/policies/:id — update a policy (admin only)
router.put('/policies/:id', authorize('admin:all'), (req, res) => {
  try {
    const policy = piiPolicyStore.getPolicy(req.params.id);
    if (!policy) return sendError(res, 404, 'pii_policy_not_found');
    const orgId = getOrgId(req);
    if (policy.orgId !== orgId) return sendError(res, 403, 'pii_policy_access_denied');

    const updates = {};
    const allowedFields = ['name', 'description', 'pattern', 'flags', 'replacement', 'severity', 'enabled', 'compliance'];
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const result = piiPolicyStore.updatePolicy(req.params.id, updates);
    if (!result.success) {
      return sendError(res, 400, 'pii_update_failed', { message: result.error });
    }
    logger.info(`[PII] Policy updated: ${req.params.id} by ${req.user?.email || 'admin'}`);
    res.json({ success: true, policy: result.policy });
  } catch (err) {
    logger.warn('[PII] update_failed:', err.message);
    sendError(res, 500, 'pii_update_failed', { message: err.message });
  }
});

// DELETE /api/pii/policies/:id — delete a policy (admin only)
router.delete('/policies/:id', authorize('admin:all'), (req, res) => {
  try {
    const policy = piiPolicyStore.getPolicy(req.params.id);
    if (!policy) return sendError(res, 404, 'pii_policy_not_found');
    const orgId = getOrgId(req);
    if (policy.orgId !== orgId) return sendError(res, 403, 'pii_policy_access_denied');

    const deleted = piiPolicyStore.deletePolicy(req.params.id);
    if (!deleted) return sendError(res, 404, 'pii_policy_not_found');
    logger.info(`[PII] Policy deleted: ${req.params.id} by ${req.user?.email || 'admin'}`);
    res.json({ success: true });
  } catch (err) {
    logger.warn('[PII] delete_failed:', err.message);
    sendError(res, 500, 'pii_delete_failed', { message: err.message });
  }
});

// POST /api/pii/test — test a pattern against sample text
router.post('/test', authorize('admin:all'), (req, res) => {
  try {
    const { pattern, flags, replacement, text } = req.body;
    if (!pattern || !text) {
      return sendError(res, 400, 'pattern and text are required');
    }

    const validation = piiPolicyStore.validateRegex(pattern, flags || 'gi');
    if (!validation.valid) {
      return res.json({ success: true, valid: false, error: validation.error });
    }

    const regex = new RegExp(pattern, flags || 'gi');
    const matches = [];
    let match;
    const regexForMatches = new RegExp(pattern, flags || 'gi');
    while ((match = regexForMatches.exec(text)) !== null) {
      matches.push({
        value: match[0],
        index: match.index,
        length: match[0].length,
      });
      if (match.index === regexForMatches.lastIndex) regexForMatches.lastIndex++;
    }

    const redacted = text.replace(regex, replacement || '[REDACTED]');

    res.json({
      success: true,
      valid: true,
      matchCount: matches.length,
      matches: matches.slice(0, 20),
      redactedPreview: redacted.slice(0, 500),
    });
  } catch (err) {
    logger.warn('[PII] test_failed:', err.message);
    sendError(res, 500, 'pii_test_failed', { message: err.message });
  }
});

// GET /api/pii/stats — policy stats for org
router.get('/stats', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const stats = piiPolicyStore.getStats(orgId);
    res.json({ success: true, ...stats });
  } catch (err) {
    logger.warn('[PII] stats_failed:', err.message);
    sendError(res, 500, 'pii_stats_failed', { message: err.message });
  }
});

// POST /api/pii/seed — seed default PII patterns for org (admin only)
router.post('/seed', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const seeded = piiPolicyStore.seedDefaults(orgId);
    logger.info(`[PII] Seeded ${seeded} default patterns for org ${orgId}`);
    res.json({ success: true, seeded });
  } catch (err) {
    logger.warn('[PII] seed_failed:', err.message);
    sendError(res, 500, 'pii_seed_failed', { message: err.message });
  }
});

// GET /api/pii/frameworks — list supported compliance frameworks
router.get('/frameworks', (req, res) => {
  res.json({ success: true, frameworks: piiPolicyStore.COMPLIANCE_FRAMEWORKS });
});

// POST /api/pii/scrub/preview — dry-run preview of PII scrubbing on historical audit entries (admin only)
router.post('/scrub/preview', authorize('admin:all'), (req, res) => {
  try {
    const orgId = req.body.orgId || getOrgId(req);
    const result = auditLogger.previewPiiScrub(orgId);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.warn('[PII] scrub_preview_failed:', err.message);
    sendError(res, 500, 'pii_scrub_preview_failed', { message: err.message });
  }
});

// POST /api/pii/scrub/run — execute PII scrubbing on historical audit entries (admin only)
router.post('/scrub/run', authorize('admin:all'), (req, res) => {
  try {
    const orgId = req.body.orgId || getOrgId(req);
    const result = auditLogger.runPiiScrub(orgId);
    logger.info(
      `[PII] Scrub run for org ${orgId}: ${result.scrubbed}/${result.scanned} entries scrubbed, seal: ${result.sealEntryId}`
    );
    res.json({ success: true, ...result });
  } catch (err) {
    logger.warn('[PII] scrub_run_failed:', err.message);
    sendError(res, 500, 'pii_scrub_run_failed', { message: err.message });
  }
});

// GET /api/pii/scrub/status — get last scrub operation status (admin only)
router.get('/scrub/status', authorize('admin:all'), (req, res) => {
  try {
    const status = auditLogger.getScrubStatus();
    res.json({ success: true, status });
  } catch (err) {
    logger.warn('[PII] scrub_status_failed:', err.message);
    sendError(res, 500, 'pii_scrub_status_failed', { message: err.message });
  }
});

// ── Compliance Bundle Export ──────────────────────────────────────────────
// Aggregates PII policy config, audit chain status, security monitor
// settings, and compliance report summary into a single downloadable
// bundle for corporate data-officer verification.

function buildComplianceBundle(orgId) {
  const generatedAt = new Date().toISOString();

  // Section 1: PII Policy Configuration
  const piiPolicies = piiPolicyStore.getPolicies(orgId);
  const piiStats = piiPolicyStore.getStats(orgId);

  // Section 2: Audit Chain Integrity
  let chainVerification = null;
  let complianceReport = null;
  let scrubStatus = null;
  try {
    chainVerification = auditLogger.verifyChain(orgId);
  } catch {
    chainVerification = { valid: false, reason: 'verification_failed' };
  }
  try {
    complianceReport = auditLogger.generateComplianceReport(orgId);
  } catch {
    complianceReport = { error: 'report_generation_failed' };
  }
  try {
    scrubStatus = auditLogger.getScrubStatus();
  } catch {
    scrubStatus = null;
  }

  // Section 3: Security Monitor Status
  let securityStatus = null;
  if (securityMonitor) {
    try {
      securityStatus = securityMonitor.getStatus();
    } catch {
      securityStatus = { error: 'status_unavailable' };
    }
  }

  return {
    bundleId: `compliance-bundle-${Date.now()}`,
    generatedAt,
    orgId,
    sections: {
      piiPolicyConfig: {
        summary: piiStats,
        policies: piiPolicies.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          pattern: p.pattern,
          flags: p.flags,
          replacement: p.replacement,
          severity: p.severity,
          enabled: p.enabled,
          compliance: p.compliance || [],
          isDefault: p.isDefault || false,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
      },
      auditChainIntegrity: {
        valid: chainVerification?.valid ?? false,
        reason: chainVerification?.reason ?? null,
        totalEntries: chainVerification?.totalEntries ?? 0,
        verifiedEntries: chainVerification?.verifiedEntries ?? 0,
        brokenAt: chainVerification?.brokenAt ?? null,
        brokenEntryId: chainVerification?.brokenEntryId ?? null,
        lastScrubOperation: scrubStatus,
      },
      complianceReport: {
        orgId: complianceReport?.orgId ?? orgId,
        generatedAt: complianceReport?.generatedAt ?? generatedAt,
        totalEntries: complianceReport?.totalEntries ?? 0,
        criticalActionCount: complianceReport?.criticalActionCount ?? 0,
        summary: complianceReport?.summary ?? {},
        topActors: complianceReport?.topActors ?? [],
        topEntities: complianceReport?.topEntities ?? [],
      },
      securityMonitor: securityStatus
        ? {
            running: securityStatus.running,
            pollIntervalMs: securityStatus.pollIntervalMs,
            autoHealEnabled: securityStatus.autoHealEnabled,
            chainIntegrityCheckEnabled: securityStatus.chainIntegrityCheckEnabled,
            guardrailAnomalyCheckEnabled: securityStatus.guardrailAnomalyCheckEnabled,
            lastRunAt: securityStatus.lastRunAt,
            runCount: securityStatus.runCount,
            orgsTracked: securityStatus.orgsTracked,
          }
        : { error: 'security_monitor_unavailable' },
    },
  };
}

function bundleToCsv(bundle) {
  const rows = [];
  const { sections } = bundle;

  // Header
  rows.push('# SimpleBeacon Compliance Bundle');
  rows.push(`# Bundle ID: ${bundle.bundleId}`);
  rows.push(`# Generated: ${bundle.generatedAt}`);
  rows.push(`# Organization: ${bundle.orgId}`);
  rows.push('');

  // Section 1: PII Policy Summary
  rows.push('# Section 1: PII Policy Configuration');
  rows.push('Metric,Value');
  rows.push(`Total Policies,${sections.piiPolicyConfig.summary.totalPolicies}`);
  rows.push(`Enabled Policies,${sections.piiPolicyConfig.summary.enabledPolicies}`);
  rows.push(`Default Patterns,${sections.piiPolicyConfig.summary.defaultCount}`);
  rows.push(`High Severity,${sections.piiPolicyConfig.summary.bySeverity?.high || 0}`);
  rows.push(`Medium Severity,${sections.piiPolicyConfig.summary.bySeverity?.medium || 0}`);
  rows.push(`Low Severity,${sections.piiPolicyConfig.summary.bySeverity?.low || 0}`);
  const byComp = sections.piiPolicyConfig.summary.byCompliance || {};
  for (const [fw, count] of Object.entries(byComp)) {
    rows.push(`Framework: ${fw},${count}`);
  }
  rows.push('');

  // PII Policy Details
  rows.push('Policy ID,Name,Severity,Enabled,Compliance,Is Default,Pattern,Replacement');
  for (const p of sections.piiPolicyConfig.policies) {
    const compStr = (p.compliance || []).join(';');
    const pattern = `"${(p.pattern || '').replace(/"/g, '""')}"`;
    const replacement = `"${(p.replacement || '').replace(/"/g, '""')}"`;
    rows.push(`${p.id},${p.name},${p.severity},${p.enabled},${compStr},${p.isDefault},${pattern},${replacement}`);
  }
  rows.push('');

  // Section 2: Audit Chain Integrity
  rows.push('# Section 2: Audit Chain Integrity');
  rows.push('Metric,Value');
  rows.push(`Chain Valid,${sections.auditChainIntegrity.valid}`);
  rows.push(`Total Entries,${sections.auditChainIntegrity.totalEntries}`);
  rows.push(`Verified Entries,${sections.auditChainIntegrity.verifiedEntries}`);
  rows.push(`Reason,${sections.auditChainIntegrity.reason || 'N/A'}`);
  if (sections.auditChainIntegrity.lastScrubOperation) {
    const scrub = sections.auditChainIntegrity.lastScrubOperation;
    rows.push(`Last Scrub Ran At,${scrub.ranAt || 'N/A'}`);
    rows.push(`Last Scrub Scanned,${scrub.scanned ?? 'N/A'}`);
    rows.push(`Last Scrub Scrubbed,${scrub.scrubbed ?? 'N/A'}`);
  }
  rows.push('');

  // Section 3: Compliance Report Summary
  rows.push('# Section 3: Audit Activity Compliance Report');
  rows.push('Metric,Value');
  rows.push(`Total Audit Entries,${sections.complianceReport.totalEntries}`);
  rows.push(`Critical Actions,${sections.complianceReport.criticalActionCount}`);
  const byAction = sections.complianceReport.summary?.byAction || {};
  for (const [action, count] of Object.entries(byAction)) {
    rows.push(`Action: ${action},${count}`);
  }
  rows.push('');

  // Top Actors
  rows.push('# Top Actors');
  rows.push('Actor ID,Event Count');
  for (const a of sections.complianceReport.topActors) {
    rows.push(`${a.actorId},${a.count}`);
  }
  rows.push('');

  // Top Entities
  rows.push('# Top Entities');
  rows.push('Entity,Event Count');
  for (const e of sections.complianceReport.topEntities) {
    rows.push(`${e.entity},${e.count}`);
  }
  rows.push('');

  // Section 4: Security Monitor
  rows.push('# Section 4: Security Monitor Status');
  rows.push('Metric,Value');
  const sm = sections.securityMonitor;
  if (sm.error) {
    rows.push(`Status,${sm.error}`);
  } else {
    rows.push(`Running,${sm.running}`);
    rows.push(`Poll Interval (ms),${sm.pollIntervalMs}`);
    rows.push(`Auto-Heal Enabled,${sm.autoHealEnabled}`);
    rows.push(`Chain Check Enabled,${sm.chainIntegrityCheckEnabled}`);
    rows.push(`Guardrail Check Enabled,${sm.guardrailAnomalyCheckEnabled}`);
    rows.push(`Last Run At,${sm.lastRunAt || 'N/A'}`);
    rows.push(`Run Count,${sm.runCount}`);
    rows.push(`Orgs Tracked,${sm.orgsTracked}`);
  }
  rows.push('');

  return rows.join('\n');
}

// GET /api/pii/compliance-bundle — download compliance bundle (admin only)
// Query params: format (csv|json, default csv)
router.get('/compliance-bundle', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const format = (req.query.format || 'csv').toLowerCase();
    const bundle = buildComplianceBundle(orgId);
    const dateStr = new Date().toISOString().slice(0, 10);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="compliance-bundle-${dateStr}.json"`
      );
      res.send(JSON.stringify(bundle, null, 2));
      return;
    }

    // CSV format
    const csv = bundleToCsv(bundle);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="compliance-bundle-${dateStr}.csv"`
    );
    res.send(csv);

    logger.info(`[PII] Compliance bundle exported for org ${orgId} (format: ${format})`);
  } catch (err) {
    logger.warn('[PII] compliance_bundle_failed:', err.message);
    sendError(res, 500, 'compliance_bundle_failed', { message: err.message });
  }
});

module.exports = router;
