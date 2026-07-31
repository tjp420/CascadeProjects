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

// ── Compliance Bundle Upload Verifier ─────────────────────────────────────
// Validates an uploaded compliance bundle against the live system state.

function verifyBundle(uploaded, orgId) {
  const checks = [];
  let passed = 0;
  let failed = 0;
  let warnings = 0;

  function check(name, condition, detail) {
    if (condition) {
      passed++;
      checks.push({ name, status: 'pass', detail: detail || null });
    } else {
      failed++;
      checks.push({ name, status: 'fail', detail: detail || null });
    }
  }

  function warn(name, detail) {
    warnings++;
    checks.push({ name, status: 'warn', detail: detail || null });
  }

  // Structural checks
  check('bundle.hasBundleId', !!uploaded.bundleId, uploaded.bundleId || 'missing');
  check('bundle.hasGeneratedAt', !!uploaded.generatedAt, uploaded.generatedAt || 'missing');
  check('bundle.hasOrgId', !!uploaded.orgId, uploaded.orgId || 'missing');
  check('bundle.hasSections', !!uploaded.sections, 'sections object present');

  if (!uploaded.sections) {
    return {
      valid: false,
      passed,
      failed,
      warnings,
      checks,
      summary: 'Bundle structure invalid — missing sections object',
    };
  }

  const sections = uploaded.sections;

  // Section 1: PII Policy Config
  check('piiConfig.present', !!sections.piiPolicyConfig, 'PII policy config section present');
  if (sections.piiPolicyConfig) {
    const uploadedPolicies = sections.piiPolicyConfig.policies || [];
    check('piiConfig.hasPolicies', Array.isArray(uploadedPolicies), `${uploadedPolicies.length} policies in bundle`);

    // Cross-check: compare policy count with live system
    try {
      const livePolicies = piiPolicyStore.getPolicies(orgId);
      const liveCount = livePolicies.length;
      const bundleCount = uploadedPolicies.length;
      if (bundleCount === liveCount) {
        check('piiConfig.policyCountMatch', true, `${liveCount} policies match live system`);
      } else {
        warn('piiConfig.policyCountMatch', `Bundle has ${bundleCount} policies, live system has ${liveCount}`);
      }

      // Check for compliance framework coverage
      const bundleFws = new Set();
      for (const p of uploadedPolicies) {
        for (const fw of p.compliance || []) bundleFws.add(fw);
      }
      check('piiConfig.hasComplianceTags', bundleFws.size > 0, `Frameworks: ${Array.from(bundleFws).join(', ') || 'none'}`);
    } catch {
      warn('piiConfig.liveCheck', 'Could not compare with live system');
    }
  }

  // Section 2: Audit Chain Integrity
  check('chainIntegrity.present', !!sections.auditChainIntegrity, 'Audit chain section present');
  if (sections.auditChainIntegrity) {
    const chain = sections.auditChainIntegrity;
    check('chainIntegrity.hasValidField', typeof chain.valid === 'boolean', `valid=${chain.valid}`);

    // Cross-check: compare with live chain verification
    try {
      const liveChain = auditLogger.verifyChain(orgId);
      if (chain.valid === liveChain.valid) {
        check('chainIntegrity.matchesLive', true, `Bundle and live both report valid=${chain.valid}`);
      } else {
        warn(
          'chainIntegrity.matchesLive',
          `Bundle reports valid=${chain.valid}, live system reports valid=${liveChain.valid}`
        );
      }

      if (chain.totalEntries !== undefined && liveChain.totalEntries !== undefined) {
        if (chain.totalEntries === liveChain.totalEntries) {
          check('chainIntegrity.entryCountMatch', true, `${chain.totalEntries} entries`);
        } else {
          warn(
            'chainIntegrity.entryCountMatch',
            `Bundle: ${chain.totalEntries} entries, live: ${liveChain.totalEntries} entries`
          );
        }
      }
    } catch {
      warn('chainIntegrity.liveCheck', 'Could not verify against live system');
    }
  }

  // Section 3: Compliance Report
  check('complianceReport.present', !!sections.complianceReport, 'Compliance report section present');
  if (sections.complianceReport) {
    const report = sections.complianceReport;
    check('complianceReport.hasTotalEntries', typeof report.totalEntries === 'number', `${report.totalEntries} total entries`);
    check('complianceReport.hasCriticalCount', typeof report.criticalActionCount === 'number', `${report.criticalActionCount} critical actions`);
    check('complianceReport.hasSummary', !!report.summary, 'Summary object present');
  }

  // Section 4: Security Monitor
  check('securityMonitor.present', !!sections.securityMonitor, 'Security monitor section present');
  if (sections.securityMonitor) {
    const sm = sections.securityMonitor;
    if (sm.error) {
      warn('securityMonitor.status', `Section reports error: ${sm.error}`);
    } else {
      check('securityMonitor.hasRunningField', typeof sm.running === 'boolean', `running=${sm.running}`);
      check('securityMonitor.hasAutoHealField', typeof sm.autoHealEnabled === 'boolean', `autoHeal=${sm.autoHealEnabled}`);
    }
  }

  // Overall validity
  const valid = failed === 0;

  return {
    valid,
    passed,
    failed,
    warnings,
    checks,
    bundleMetadata: {
      bundleId: uploaded.bundleId || 'unknown',
      generatedAt: uploaded.generatedAt || 'unknown',
      orgId: uploaded.orgId || 'unknown',
    },
    summary: valid
      ? `Bundle verified — ${passed} checks passed, ${warnings} warnings`
      : `Bundle verification failed — ${failed} checks failed, ${warnings} warnings`,
  };
}

// POST /api/pii/compliance-bundle/verify — verify an uploaded compliance bundle (admin only)
router.post('/compliance-bundle/verify', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const bundle = req.body;

    if (!bundle || typeof bundle !== 'object') {
      return sendError(res, 400, 'Invalid bundle — expected JSON object');
    }

    const result = verifyBundle(bundle, orgId);
    logger.info(
      `[PII] Compliance bundle verified: ${result.passed} passed, ${result.failed} failed, ${result.warnings} warnings`
    );
    res.json({ success: true, ...result });
  } catch (err) {
    logger.warn('[PII] bundle_verify_failed:', err.message);
    sendError(res, 500, 'bundle_verify_failed', { message: err.message });
  }
});

// GET /api/pii/orgs — list all known organization IDs that have PII policies (admin only)
router.get('/orgs', authorize('admin:all'), (req, res) => {
  try {
    const orgIds = piiPolicyStore.getAllOrgIds();
    const currentOrg = getOrgId(req);
    // Annotate each org with its policy count for UI convenience
    const orgs = orgIds.map((orgId) => ({
      orgId,
      policyCount: piiPolicyStore.getPolicies(orgId).length,
      isCurrent: orgId === currentOrg,
    }));
    // Ensure current org is always present even if it has no policies yet
    if (!orgIds.includes(currentOrg)) {
      orgs.unshift({ orgId: currentOrg, policyCount: 0, isCurrent: true });
    }
    res.json({ success: true, orgs, currentOrg });
  } catch (err) {
    logger.warn('[PII] orgs_list_failed:', err.message);
    sendError(res, 500, 'pii_orgs_list_failed', { message: err.message });
  }
});

// POST /api/pii/sync-policies — sync (clone) PII policies from source org to target orgs (admin only)
//
// Body:
//   sourceOrgId:  string  (defaults to caller's org)
//   targetOrgIds: string[]  (explicit list — required unless allKnown=true)
//   allKnown:     boolean   (if true, sync to every org returned by getAllOrgIds except source)
//   mode:         'merge' | 'replace'  (default 'merge')
//   filter: {
//     compliance: string[]  (only sync policies tagged with one of these frameworks)
//     severity:   string[]  (only sync policies with one of these severities)
//     isDefault:  boolean   (only sync policies where isDefault === true)
//   }
//   dryRun:       boolean   (if true, returns a preview without writing)
router.post('/sync-policies', authorize('admin:all'), (req, res) => {
  try {
    const currentOrg = getOrgId(req);
    const sourceOrgId = req.body.sourceOrgId || currentOrg;
    const mode = req.body.mode === 'replace' ? 'replace' : 'merge';
    const filter = req.body.filter || {};
    const dryRun = Boolean(req.body.dryRun);

    // Resolve target org list
    let targetOrgIds;
    if (req.body.allKnown) {
      const allOrgs = piiPolicyStore.getAllOrgIds();
      targetOrgIds = allOrgs.filter((o) => o !== sourceOrgId);
      if (targetOrgIds.length === 0) {
        return sendError(res, 400, 'no_target_orgs', {
          message: 'No other organizations with PII policies found to sync to.',
        });
      }
    } else if (Array.isArray(req.body.targetOrgIds) && req.body.targetOrgIds.length > 0) {
      targetOrgIds = req.body.targetOrgIds;
    } else {
      return sendError(res, 400, 'missing_targets', {
        message: 'Provide targetOrgIds array or set allKnown=true.',
      });
    }

    // Reject any target equal to source (the store also guards, but we surface it clearly)
    const sameAsSource = targetOrgIds.filter((t) => t === sourceOrgId);
    if (sameAsSource.length > 0) {
      return sendError(res, 400, 'target_includes_source', {
        message: `targetOrgIds must not include the source org (${sourceOrgId}).`,
      });
    }

    if (dryRun) {
      // Preview: compute counts without writing
      const sourcePolicies = piiPolicyStore.getPolicies(sourceOrgId);
      let filtered = sourcePolicies;
      if (Array.isArray(filter.compliance) && filter.compliance.length > 0) {
        filtered = filtered.filter(
          (p) => Array.isArray(p.compliance) && p.compliance.some((c) => filter.compliance.includes(c))
        );
      }
      if (Array.isArray(filter.severity) && filter.severity.length > 0) {
        filtered = filtered.filter((p) => filter.severity.includes(p.severity));
      }
      if (typeof filter.isDefault === 'boolean') {
        filtered = filtered.filter((p) => Boolean(p.isDefault) === filter.isDefault);
      }

      const targetsPreview = targetOrgIds.map((orgId) => {
        const existing = piiPolicyStore.getPolicies(orgId);
        const existingKeys = new Set(existing.map((p) => `${p.name}::${p.pattern}`));
        let toClone = filtered.length;
        let toSkip = 0;
        let toRemove = 0;
        if (mode === 'merge') {
          toSkip = filtered.filter((p) => existingKeys.has(`${p.name}::${p.pattern}`)).length;
          toClone = filtered.length - toSkip;
        } else {
          toRemove = existing.length;
        }
        return {
          orgId,
          mode,
          sourcePolicyCount: sourcePolicies.length,
          filteredPolicyCount: filtered.length,
          existingPolicyCount: existing.length,
          toClone,
          toSkip,
          toRemove,
        };
      });

      logger.info(
        `[PII] Sync dry-run: source=${sourceOrgId}, targets=${targetOrgIds.length}, mode=${mode}, filtered=${filtered.length}`
      );
      return res.json({
        success: true,
        dryRun: true,
        sourceOrg: sourceOrgId,
        mode,
        filter,
        sourcePolicyCount: sourcePolicies.length,
        filteredPolicyCount: filtered.length,
        targets: targetsPreview,
      });
    }

    const result = piiPolicyStore.syncPoliciesToOrgs(sourceOrgId, targetOrgIds, {
      mode,
      compliance: filter.compliance,
      severity: filter.severity,
      isDefault: filter.isDefault,
    });

    // Audit log the sync operation
    try {
      auditLogger.log({
        orgId: currentOrg,
        actorId: req.user?.id || 'system',
        actorEmail: req.user?.email || 'system',
        action: 'pii_policy_sync',
        entity: 'pii_policy',
        entityId: sourceOrgId,
        metadata: {
          sourceOrg: sourceOrgId,
          targetCount: targetOrgIds.length,
          mode,
          filter,
          totalCloned: result.totalCloned,
          totalSkipped: result.totalSkipped,
          totalRemoved: result.totalRemoved,
        },
      });
    } catch (logErr) {
      logger.warn('[PII] Failed to audit-log policy sync:', logErr.message);
    }

    logger.info(
      `[PII] Policy sync complete: source=${sourceOrgId}, targets=${targetOrgIds.length}, cloned=${result.totalCloned}, skipped=${result.totalSkipped}, removed=${result.totalRemoved}, mode=${mode}`
    );
    res.json({ success: true, ...result });
  } catch (err) {
    logger.warn('[PII] sync_policies_failed:', err.message);
    sendError(res, 500, 'pii_sync_failed', { message: err.message });
  }
});

module.exports = router;
