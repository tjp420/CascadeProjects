'use strict';

/**
 * Usage Analytics API — Endpoints for scan metrics, violation trends,
 * compliance posture scores, and global usage statistics.
 *
 * Endpoints:
 *   GET  /api/analytics/stats              — Global stats across all orgs
 *   GET  /api/analytics/org/:orgId         — Per-org summary
 *   GET  /api/analytics/scans              — Paginated scan history
 *   GET  /api/analytics/trends             — Time-series trend data
 *   GET  /api/analytics/heatmap            — Violation heatmap by category
 *   GET  /api/analytics/repositories       — Top repositories by scan count
 *   GET  /api/analytics/export             — Download analytics as CSV or JSON
 *   GET  /api/analytics/violations         — Paginated violation rows with remediation guidance
 *   POST /api/analytics/violations/ticket-payload  — Generate pre-filled ticket payload
 *   POST /api/analytics/violations/mark-ticketed   — Mark a violation as ticketed
 *   POST /api/analytics/violations/unmark-ticketed — Remove ticket status from a violation
 *   POST /api/analytics/violations/bulk-mark-ticketed   — Mark multiple violations as ticketed
 *   POST /api/analytics/violations/bulk-unmark-ticketed — Remove ticket status from multiple violations
 *   GET  /api/analytics/violations/ticket-statuses — Get all ticketed violation statuses
 *   GET  /api/analytics/violations/summary       — Remediation coverage summary with per-category breakdown
 *   GET  /api/analytics/violations/export         — Download filtered violations as CSV or JSON compliance ledger
 *   POST /api/analytics/violations/dispatch-ticket — Dispatch a ticket payload to an external tracker via webhook
 *   POST /api/analytics/violations/bulk-dispatch-ticket — Dispatch tickets to multiple violations with rate limiting and retry backoff
 *   GET  /api/analytics/report/schedules            — Get all report schedules
 *   POST /api/analytics/report/schedules            — Create or update a report schedule
 *   DELETE /api/analytics/report/schedules/:id      — Delete a report schedule
 *   POST /api/analytics/report/schedules/:id/run    — Manually trigger a report schedule
 *   GET  /api/analytics/webhook/configs            — Get all webhook configurations
 *   POST /api/analytics/webhook/configs            — Save a webhook configuration for a target platform
 *   DELETE /api/analytics/webhook/configs/:target  — Delete a webhook configuration
 *   POST /api/analytics/record             — Record a scan (internal/CI)
 *
 * @module analytics-routes
 */

const express = require('express');
const logger = require('../lib/app-logger.cjs');
const { authenticate } = require('../middleware/auth.cjs');
const { validateParam, VALIDATION_PATTERNS } = require('../middleware/validate-params.cjs');
const analyticsStore = require('../lib/usage-analytics-store.cjs');
const ticketStatusStore = require('../lib/ticket-status-store.cjs');
const webhookConfigStore = require('../lib/webhook-config-store.cjs');
const reportScheduleStore = require('../lib/report-schedule-store.cjs');
const reportScheduler = require('../lib/report-scheduler.cjs');

reportScheduler.setAnalyticsStore(analyticsStore);
reportScheduler.startScheduler();

const router = express.Router();

// Apply authentication to all analytics endpoints
router.use(authenticate);

// Helper: extract orgId from authenticated session
function getOrgId(req) {
  return req.user?.id || req.user?.email || 'default';
}

const REMEDIATION_GUIDANCE = {
  'EU AI Act — Prohibited Practices': {
    strategy: 'eliminate',
    priority: 'critical',
    description: 'Remove the prohibited AI practice entirely. EU AI Act Article 5 bans certain uses (social scoring, manipulative AI, real-time biometric ID in public spaces).',
    steps: ['Identify the prohibited use case in the codebase', 'Remove or replace the functionality with a compliant alternative', 'Document the decision in the AI conformity assessment'],
  },
  'EU AI Act — High-Risk Obligations': {
    strategy: 'comply',
    priority: 'critical',
    description: 'High-risk AI systems require risk management, data governance, transparency, and human oversight under EU AI Act Articles 8-15.',
    steps: ['Implement a risk management system', 'Ensure training data quality and bias mitigation', 'Add human oversight mechanisms', 'Create technical documentation and logging'],
  },
  'California SB 1047 — Critical Harm': {
    strategy: 'contain',
    priority: 'critical',
    description: 'SB 1047 requires safety evaluations for frontier models capable of causing critical harm. Implement safety shutdown protocols and red-team testing.',
    steps: ['Conduct safety evaluation before deployment', 'Implement emergency shutdown capability', 'Document critical harm risk assessment', 'Submit safety certification'],
  },
  'GDPR — Data Subject Rights': {
    strategy: 'implement',
    priority: 'high',
    description: 'Ensure data subject rights are implementable: right to access, rectification, erasure, and portability under GDPR Articles 15-20.',
    steps: ['Add data export endpoints for portability', 'Implement deletion workflows for erasure requests', 'Build consent management UI', 'Audit data retention policies'],
  },
  'HIPAA — PHI Exposure': {
    strategy: 'encrypt',
    priority: 'critical',
    description: 'Protected Health Information must be encrypted at rest and in transit. Implement access controls and audit logging per HIPAA Security Rule.',
    steps: ['Encrypt all PHI fields at rest (AES-256)', 'Enforce TLS 1.2+ for all PHI transit', 'Implement role-based access control', 'Enable audit logging for all PHI access'],
  },
  'OWASP — Injection': {
    strategy: 'parameterize',
    priority: 'high',
    description: 'Use parameterized queries and input validation to prevent SQL, NoSQL, and command injection attacks.',
    steps: ['Replace string concatenation with parameterized queries', 'Add input validation and sanitization', 'Use ORM query builders where possible', 'Implement allowlists for user input'],
  },
  'OWASP — Broken Access Control': {
    strategy: 'enforce',
    priority: 'high',
    description: 'Enforce proper authorization checks on every protected resource. Implement deny-by-default and principle of least privilege.',
    steps: ['Add authorization middleware to all protected routes', 'Implement deny-by-default access policies', 'Audit role assignments and permissions', 'Add ownership checks on resource access'],
  },
  'OWASP — Security Misconfiguration': {
    strategy: 'harden',
    priority: 'medium',
    description: 'Apply security hardening to all components: disable default credentials, remove unused features, set secure headers.',
    steps: ['Remove default credentials and change default ports', 'Set security headers (CSP, HSTS, X-Frame-Options)', 'Disable debug mode in production', 'Remove unused endpoints and features'],
  },
  'OWASP — Vulnerable Dependencies': {
    strategy: 'upgrade',
    priority: 'high',
    description: 'Update or replace dependencies with known CVEs. Use dependency scanning in CI to catch vulnerabilities early.',
    steps: ['Run npm audit / pip audit / snyk scan', 'Upgrade vulnerable packages to safe versions', 'Replace unmaintained dependencies', 'Add dependency scanning to CI pipeline'],
  },
  'Hardcoded Secrets': {
    strategy: 'externalize',
    priority: 'critical',
    description: 'Move all secrets to environment variables or a secrets manager. Never hardcode API keys, passwords, or tokens in source code.',
    steps: ['Identify all hardcoded secrets in the codebase', 'Move secrets to environment variables or vault', 'Rotate all exposed credentials', 'Add pre-commit hooks for secret detection'],
  },
  'Unsafe Deserialization': {
    strategy: 'validate',
    priority: 'high',
    description: 'Replace unsafe deserialization (pickle, eval, JSON.parse with reviver) with schema-validated parsing.',
    steps: ['Replace pickle with JSON or protobuf', 'Add schema validation before deserialization', 'Use allowlists for deserializable types', 'Implement integrity checks on serialized data'],
  },
  'Missing Input Validation': {
    strategy: 'validate',
    priority: 'medium',
    description: 'Add input validation on all API endpoints and user-facing forms. Use schema validation libraries.',
    steps: ['Define input schemas for all endpoints', 'Add validation middleware (zod, joi, pydantic)', 'Sanitize string inputs to prevent XSS', 'Return 400 with clear error messages on invalid input'],
  },
  'Improper Error Handling': {
    strategy: 'wrap',
    priority: 'low',
    description: 'Wrap operations in try/catch blocks with meaningful error messages. Avoid exposing stack traces to users.',
    steps: ['Add try/catch around all async operations', 'Return generic error messages to users', 'Log detailed errors server-side only', 'Add error monitoring (Sentry, Rollbar)'],
  },
  'Non-deterministic Output': {
    strategy: 'seed',
    priority: 'medium',
    description: 'AI model outputs must be reproducible for auditing. Set random seeds and log model parameters.',
    steps: ['Set fixed random seeds for reproducibility', 'Log model version and parameters with each output', 'Implement output caching for identical inputs', 'Add deterministic test cases'],
  },
  'Missing Model Card': {
    strategy: 'document',
    priority: 'medium',
    description: 'Create a model card documenting intended use, training data, performance metrics, and known limitations.',
    steps: ['Document model architecture and training data', 'Add performance metrics and evaluation results', 'List known limitations and biases', 'Publish model card with the model artifact'],
  },
  'Bias Detection Gap': {
    strategy: 'evaluate',
    priority: 'high',
    description: 'Implement bias evaluation across protected demographics. Add fairness metrics to the model evaluation pipeline.',
    steps: ['Define fairness metrics (demographic parity, equalized odds)', 'Test model outputs across demographic groups', 'Add bias detection to CI evaluation', 'Document mitigation strategies for detected biases'],
  },
  _default: {
    strategy: 'review',
    priority: 'medium',
    description: 'Review the finding and apply appropriate remediation based on severity and context.',
    steps: ['Analyze the finding in context of the codebase', 'Determine appropriate fix strategy', 'Implement the fix with tests', 'Verify the fix resolves the finding'],
  },
};

// GET /api/analytics/stats — global stats
router.get('/stats', (req, res) => {
  try {
    const stats = analyticsStore.getGlobalStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    logger.error('[Analytics] Stats failed:', err.message);
    res.status(500).json({ error: 'stats_failed', message: err.message });
  }
});

// GET /api/analytics/org/:orgId — per-org summary
router.get('/org/:orgId', validateParam('orgId', VALIDATION_PATTERNS.orgId), (req, res) => {
  try {
    const summary = analyticsStore.getOrgSummary(req.params.orgId);
    if (!summary) return res.status(404).json({ error: 'org_not_found', message: 'No scans recorded for this organization' });
    res.json({ success: true, ...summary });
  } catch (err) {
    res.status(500).json({ error: 'org_summary_failed', message: err.message });
  }
});

// GET /api/analytics/scans — paginated scan history
router.get('/scans', (req, res) => {
  try {
    const filters = {
      orgId: req.query.orgId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      repository: req.query.repository,
      limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 1000),
      offset: Math.max(parseInt(req.query.offset, 10) || 0, 0),
    };
    const result = analyticsStore.getScans(filters);
    res.json({
      success: true,
      scans: result.scans,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasNext: result.offset + result.limit < result.total,
        hasPrev: result.offset > 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'scans_query_failed', message: err.message });
  }
});

// GET /api/analytics/trends — time-series trend data
router.get('/trends', (req, res) => {
  try {
    const filters = {
      orgId: req.query.orgId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      granularity: req.query.granularity || 'day',
    };
    const trend = analyticsStore.getTrendData(filters);
    res.json({ success: true, trend, granularity: filters.granularity });
  } catch (err) {
    res.status(500).json({ error: 'trends_failed', message: err.message });
  }
});

// GET /api/analytics/heatmap — violation heatmap by category
router.get('/heatmap', (req, res) => {
  try {
    const filters = {
      orgId: req.query.orgId,
      startDate: req.query.startDate,
    };
    const heatmap = analyticsStore.getViolationHeatmap(filters);
    res.json({ success: true, heatmap });
  } catch (err) {
    res.status(500).json({ error: 'heatmap_failed', message: err.message });
  }
});

// GET /api/analytics/repositories — top repositories
router.get('/repositories', (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const repos = analyticsStore.getTopRepositories(req.query.orgId, limit);
    res.json({ success: true, repositories: repos });
  } catch (err) {
    res.status(500).json({ error: 'repositories_failed', message: err.message });
  }
});

// GET /api/analytics/export — download analytics as CSV or JSON
router.get('/export', (req, res) => {
  try {
    const format = (req.query.format || 'csv').toLowerCase();
    const days = Math.min(Math.max(parseInt(String(req.query.days || '90'), 10) || 90, 1), 365);
    const orgId = req.query.orgId || null;
    const repository = req.query.repository || null;
    const branch = req.query.branch || null;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const filterOpts = { orgId, repository, branch, startDate };
    const stats = orgId ? analyticsStore.getOrgSummary(orgId) : analyticsStore.getGlobalStats(filterOpts);
    const trend = analyticsStore.getTrendData({ ...filterOpts, granularity: 'day' });
    const heatmap = analyticsStore.getViolationHeatmap(filterOpts);
    const repositories = analyticsStore.getTopRepositories(orgId, 50);
    const scanResult = analyticsStore.getScans({ orgId, repository, branch, startDate, limit: 10000, offset: 0 });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${new Date().toISOString().slice(0, 10)}.json"`);
      res.json({
        exportedAt: new Date().toISOString(),
        filters: { days, orgId, repository, branch, startDate },
        stats,
        trend,
        heatmap,
        repositories,
        scans: scanResult.scans,
        totalScans: scanResult.total,
      });
      return;
    }

    // CSV format — flatten scan records as rows
    const csvHeaders = [
      'scanId', 'orgId', 'timestamp', 'repository', 'branch', 'triggeredBy',
      'codeFilesAnalyzed', 'totalFindings', 'critical', 'high', 'medium', 'low', 'info',
      'gateStatus', 'postureScore', 'scanDurationMs',
    ];

    const escapeCsv = (val) => {
      if (val == null) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = [csvHeaders.join(',')];

    for (const scan of scanResult.scans) {
      rows.push([
        escapeCsv(scan.scanId),
        escapeCsv(scan.orgId),
        escapeCsv(scan.timestamp),
        escapeCsv(scan.repository),
        escapeCsv(scan.branch),
        escapeCsv(scan.triggeredBy),
        scan.codeFilesAnalyzed,
        scan.totalFindings,
        scan.severityCounts.critical,
        scan.severityCounts.high,
        scan.severityCounts.medium,
        scan.severityCounts.low,
        scan.severityCounts.info,
        escapeCsv(scan.gateStatus),
        scan.postureScore,
        scan.scanDurationMs,
      ].join(','));
    }

    // Append summary section
    rows.push('');
    rows.push(`# Summary Export — ${new Date().toISOString()}`);
    rows.push(`# Total Scans,${stats.totalScans}`);
    rows.push(`# Total Files,${stats.totalFilesAnalyzed ?? stats.totalFiles ?? ''}`);
    rows.push(`# Total Findings,${stats.totalFindings}`);
    rows.push(`# Avg Posture,${stats.avgPostureScore ?? ''}`);
    rows.push(`# Orgs,${stats.totalOrgs ?? (stats.orgId ? 1 : '')}`);
    rows.push(`# Trend Points,${trend.length}`);
    rows.push(`# Heatmap Categories,${Object.keys(heatmap).length}`);

    const csv = rows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    logger.error('[Analytics] Export failed:', err.message);
    res.status(500).json({ error: 'export_failed', message: err.message });
  }
});

const SLA_THRESHOLDS = {
  critical: 2,
  high: 7,
  medium: 30,
  low: 60,
};

// GET /api/analytics/violations — paginated violation rows with remediation guidance
//   Query params: orgId, repository, branch, category, startDate, endDate, limit, offset,
//                 ticketStatus (all|ticketed|unticketed), ticketTarget (jira|linear|github),
//                 slaBreached (true|false)
router.get('/violations', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const categoryFilter = req.query.category || '';
    const filters = {
      orgId,
      repository: req.query.repository,
      branch: req.query.branch,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 1000),
      offset: Math.max(parseInt(req.query.offset, 10) || 0, 0),
    };
    const ticketStatusFilter = (req.query.ticketStatus || 'all').toLowerCase();
    const ticketTargetFilter = (req.query.ticketTarget || '').toLowerCase();
    const slaBreachedFilter = (req.query.slaBreached || '').toLowerCase() === 'true';
    const now = Date.now();

    const result = analyticsStore.getScans(filters);
    const ticketedKeys = ticketStatusStore.getTicketedKeys(orgId);
    const allStatuses = ticketStatusStore.getAllTicketStatuses(orgId);

    const violations = [];
    for (const scan of result.scans) {
      const cats = scan.categoryCounts || {};
      for (const [category, count] of Object.entries(cats)) {
        if (count <= 0) continue;
        if (categoryFilter && category !== categoryFilter) continue;
        const ticketKey = ticketStatusStore.buildTicketKey(orgId, scan.scanId, category);
        const isTicketed = ticketedKeys.has(ticketKey);
        const ticketEntry = allStatuses[ticketKey];

        // Filter by ticket status
        if (ticketStatusFilter === 'unticketed' && isTicketed) continue;
        if (ticketStatusFilter === 'ticketed' && !isTicketed) continue;
        // Filter by ticket target
        if (ticketTargetFilter && (!ticketEntry || ticketEntry.ticketTarget !== ticketTargetFilter)) continue;

        const guidance = REMEDIATION_GUIDANCE[category] || REMEDIATION_GUIDANCE._default;
        const slaLimit = SLA_THRESHOLDS[guidance.priority] || SLA_THRESHOLDS.medium;
        const scanDate = new Date(scan.timestamp);
        const daysOpen = Math.floor((now - scanDate.getTime()) / 86400000);
        const slaBreached = !isTicketed && daysOpen > slaLimit;
        const slaDaysOver = slaBreached ? daysOpen - slaLimit : 0;

        if (slaBreachedFilter && !slaBreached) continue;

        violations.push({
          scanId: scan.scanId,
          orgId: scan.orgId,
          timestamp: scan.timestamp,
          repository: scan.repository,
          branch: scan.branch,
          commitSha: scan.commitSha,
          triggeredBy: scan.triggeredBy,
          category,
          count,
          postureScore: scan.postureScore,
          gateStatus: scan.gateStatus,
          remediation: guidance,
          ticketed: isTicketed,
          ticketRef: ticketEntry?.ticketRef || null,
          ticketTarget: ticketEntry?.ticketTarget || null,
          ticketMarkedAt: ticketEntry?.markedAt || null,
          daysOpen,
          slaLimit,
          slaBreached,
          slaDaysOver,
        });
      }
    }

    // Sort by timestamp descending (most recent first)
    violations.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const total = violations.length;
    const limit = filters.limit;
    const offset = filters.offset;
    const paged = violations.slice(offset, offset + limit);

    res.json({
      success: true,
      violations: paged,
      pagination: {
        total,
        limit,
        offset,
        hasNext: offset + limit < total,
        hasPrev: offset > 0,
      },
    });
  } catch (err) {
    logger.error('[Analytics] Violations failed:', err.message);
    res.status(500).json({ error: 'violations_failed', message: err.message });
  }
});

// POST /api/analytics/violations/ticket-payload — generate a pre-filled ticket payload
router.post('/violations/ticket-payload', (req, res) => {
  try {
    const { scanId, category, target } = req.body || {};
    if (!scanId) return res.status(400).json({ error: 'scanId is required' });
    if (!category) return res.status(400).json({ error: 'category is required' });

    const orgId = getOrgId(req);
    const ticketTarget = (target || 'jira').toLowerCase();
    const result = analyticsStore.getScans({ orgId, limit: 100000, offset: 0 });
    const scan = result.scans.find(s => s.scanId === scanId);
    if (!scan) return res.status(404).json({ error: 'scan_not_found', message: 'Scan not found' });

    const count = (scan.categoryCounts || {})[category] || 0;
    if (count === 0) return res.status(404).json({ error: 'category_not_found', message: 'Category not found in this scan' });

    const guidance = REMEDIATION_GUIDANCE[category] || REMEDIATION_GUIDANCE._default;
    const priorityMap = { critical: 'P0', high: 'P1', medium: 'P2', low: 'P3' };
    const priorityLabel = priorityMap[guidance.priority] || 'P2';

    const title = `[${priorityLabel}] ${category} — ${count} finding${count > 1 ? 's' : ''} in ${scan.repository}/${scan.branch}`;
    const descriptionLines = [
      `h2. Violation Summary`,
      ``,
      `*Category:* ${category}`,
      `*Findings:* ${count}`,
      `*Repository:* ${scan.repository}`,
      `*Branch:* ${scan.branch}`,
      `*Commit:* ${scan.commitSha}`,
      `*Scan ID:* ${scan.scanId}`,
      `*Scan Date:* ${scan.timestamp}`,
      `*Triggered By:* ${scan.triggeredBy}`,
      `*Gate Status:* ${scan.gateStatus}`,
      `*Posture Score:* ${scan.postureScore}/100`,
      ``,
      `h2. Remediation Strategy: ${guidance.strategy}`,
      ``,
      `${guidance.description}`,
      ``,
      `h2. Remediation Steps`,
      ``,
      ...guidance.steps.map((step, i) => `#${i + 1}. ${step}`),
    ];

    const markdownDescription = descriptionLines.join('\n').replace(/h2\.\s/g, '## ').replace(/\*/g, '**');

    const jiraPayload = {
      fields: {
        project: { key: 'SEC' },
        summary: title,
        description: descriptionLines.join('\n'),
        issuetype: { name: guidance.priority === 'critical' || guidance.priority === 'high' ? 'Bug' : 'Task' },
        priority: { name: guidance.priority === 'critical' ? 'Highest' : guidance.priority === 'high' ? 'High' : guidance.priority === 'medium' ? 'Medium' : 'Low' },
        labels: ['simplebeacon', 'compliance', guidance.strategy, `priority-${guidance.priority}`],
        assignee: null,
      },
    };

    const linearPayload = {
      title,
      description: markdownDescription,
      priority: guidance.priority === 'critical' ? 1 : guidance.priority === 'high' ? 2 : guidance.priority === 'medium' ? 3 : 4,
      labels: ['simplebeacon', 'compliance', guidance.strategy],
      metadata: { scanId: scan.scanId, category, repository: scan.repository, branch: scan.branch },
    };

    const githubPayload = {
      title,
      body: markdownDescription,
      labels: ['compliance', guidance.priority, guidance.strategy, 'simplebeacon'],
      assignees: [],
    };

    const payloads = { jira: jiraPayload, linear: linearPayload, github: githubPayload };

    res.json({
      success: true,
      scanId,
      category,
      target: ticketTarget,
      payload: payloads[ticketTarget] || payloads.jira,
      allPayloads: payloads,
    });
  } catch (err) {
    logger.error('[Analytics] Ticket payload failed:', err.message);
    res.status(500).json({ error: 'ticket_payload_failed', message: err.message });
  }
});

// POST /api/analytics/violations/mark-ticketed — mark a violation as ticketed
router.post('/violations/mark-ticketed', (req, res) => {
  try {
    const { scanId, category, ticketRef, ticketTarget } = req.body || {};
    if (!scanId) return res.status(400).json({ error: 'scanId is required' });
    if (!category) return res.status(400).json({ error: 'category is required' });
    if (!ticketRef) return res.status(400).json({ error: 'ticketRef is required' });

    const orgId = getOrgId(req);
    const entry = ticketStatusStore.markTicketed(scanId, category, ticketRef, ticketTarget, orgId);
    res.json({ success: true, ticket: entry });
  } catch (err) {
    logger.error('[Analytics] Mark ticketed failed:', err.message);
    res.status(500).json({ error: 'mark_ticketed_failed', message: err.message });
  }
});

// POST /api/analytics/violations/unmark-ticketed — remove ticket status from a violation
router.post('/violations/unmark-ticketed', (req, res) => {
  try {
    const { scanId, category } = req.body || {};
    if (!scanId) return res.status(400).json({ error: 'scanId is required' });
    if (!category) return res.status(400).json({ error: 'category is required' });

    const orgId = getOrgId(req);
    const result = ticketStatusStore.unmarkTicketed(scanId, category, orgId);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('[Analytics] Unmark ticketed failed:', err.message);
    res.status(500).json({ error: 'unmark_ticketed_failed', message: err.message });
  }
});

// POST /api/analytics/violations/bulk-mark-ticketed — mark multiple violations as ticketed
router.post('/violations/bulk-mark-ticketed', (req, res) => {
  try {
    const { violations, ticketRef, ticketTarget } = req.body || {};
    if (!Array.isArray(violations) || violations.length === 0) return res.status(400).json({ error: 'violations array is required' });
    if (!ticketRef) return res.status(400).json({ error: 'ticketRef is required' });

    const orgId = getOrgId(req);
    const results = [];
    let succeeded = 0;
    let failed = 0;
    for (const v of violations) {
      if (!v.scanId || !v.category) { failed++; continue; }
      try {
        const entry = ticketStatusStore.markTicketed(v.scanId, v.category, ticketRef, ticketTarget || 'jira', orgId);
        results.push(entry);
        succeeded++;
      } catch {
        failed++;
      }
    }

    res.json({ success: true, succeeded, failed, total: violations.length, results });
  } catch (err) {
    logger.error('[Analytics] Bulk mark ticketed failed:', err.message);
    res.status(500).json({ error: 'bulk_mark_failed', message: err.message });
  }
});

// POST /api/analytics/violations/bulk-unmark-ticketed — remove ticket status from multiple violations
router.post('/violations/bulk-unmark-ticketed', (req, res) => {
  try {
    const { violations } = req.body || {};
    if (!Array.isArray(violations) || violations.length === 0) return res.status(400).json({ error: 'violations array is required' });

    const orgId = getOrgId(req);
    let succeeded = 0;
    let failed = 0;
    for (const v of violations) {
      if (!v.scanId || !v.category) { failed++; continue; }
      try {
        ticketStatusStore.unmarkTicketed(v.scanId, v.category, orgId);
        succeeded++;
      } catch {
        failed++;
      }
    }

    res.json({ success: true, succeeded, failed, total: violations.length });
  } catch (err) {
    logger.error('[Analytics] Bulk unmark ticketed failed:', err.message);
    res.status(500).json({ error: 'bulk_unmark_failed', message: err.message });
  }
});

// GET /api/analytics/violations/ticket-statuses — get all ticketed violation statuses
router.get('/violations/ticket-statuses', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const statuses = ticketStatusStore.getAllTicketStatuses(orgId);
    res.json({ success: true, statuses });
  } catch (err) {
    logger.error('[Analytics] Ticket statuses failed:', err.message);
    res.status(500).json({ error: 'ticket_statuses_failed', message: err.message });
  }
});

// GET /api/analytics/violations/summary — remediation coverage summary with per-category breakdown
router.get('/violations/summary', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const filters = {
      orgId,
      repository: req.query.repository,
      branch: req.query.branch,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: 100000,
      offset: 0,
    };
    const result = analyticsStore.getScans(filters);
    const ticketedKeys = ticketStatusStore.getTicketedKeys(orgId);

    let totalViolations = 0;
    let ticketedViolations = 0;
    let slaBreachedCount = 0;
    const categoryMap = {};
    const now = Date.now();

    for (const scan of result.scans) {
      const cats = scan.categoryCounts || {};
      for (const [category, count] of Object.entries(cats)) {
        if (count <= 0) continue;
        const ticketKey = ticketStatusStore.buildTicketKey(orgId, scan.scanId, category);
        const isTicketed = ticketedKeys.has(ticketKey);
        totalViolations++;
        if (isTicketed) ticketedViolations++;

        const guidance = REMEDIATION_GUIDANCE[category] || REMEDIATION_GUIDANCE._default;
        const slaLimit = SLA_THRESHOLDS[guidance.priority] || SLA_THRESHOLDS.medium;
        const scanDate = new Date(scan.timestamp);
        const daysOpen = Math.floor((now - scanDate.getTime()) / 86400000);
        const slaBreached = !isTicketed && daysOpen > slaLimit;
        if (slaBreached) slaBreachedCount++;

        if (!categoryMap[category]) {
          categoryMap[category] = { category, total: 0, ticketed: 0, unticketed: 0, slaBreached: 0 };
        }
        categoryMap[category].total++;
        if (isTicketed) {
          categoryMap[category].ticketed++;
        } else {
          categoryMap[category].unticketed++;
          if (slaBreached) categoryMap[category].slaBreached++;
        }
      }
    }

    const categories = Object.values(categoryMap)
      .sort((a, b) => b.total - a.total)
      .map(c => ({
        ...c,
        coverage: c.total > 0 ? Math.round((c.ticketed / c.total) * 100) : 0,
      }));

    const coverage = totalViolations > 0 ? Math.round((ticketedViolations / totalViolations) * 100) : 0;

    res.json({
      success: true,
      summary: {
        totalViolations,
        ticketedViolations,
        unticketedViolations: totalViolations - ticketedViolations,
        slaBreachedCount,
        coverage,
        categories,
      },
    });
  } catch (err) {
    logger.error('[Analytics] Violations summary failed:', err.message);
    res.status(500).json({ error: 'violations_summary_failed', message: err.message });
  }
});

// GET /api/analytics/violations/export — download filtered violations as CSV or JSON compliance ledger
router.get('/violations/export', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const format = (req.query.format || 'csv').toLowerCase();
    const categoryFilter = req.query.category || '';
    const filters = {
      orgId,
      repository: req.query.repository,
      branch: req.query.branch,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: 100000,
      offset: 0,
    };
    const ticketStatusFilter = (req.query.ticketStatus || 'all').toLowerCase();
    const ticketTargetFilter = (req.query.ticketTarget || '').toLowerCase();
    const slaBreachedFilter = (req.query.slaBreached || '').toLowerCase() === 'true';

    const result = analyticsStore.getScans(filters);
    const ticketedKeys = ticketStatusStore.getTicketedKeys(orgId);
    const allStatuses = ticketStatusStore.getAllTicketStatuses(orgId);
    const now = Date.now();

    const violations = [];
    for (const scan of result.scans) {
      const cats = scan.categoryCounts || {};
      for (const [category, count] of Object.entries(cats)) {
        if (count <= 0) continue;
        if (categoryFilter && category !== categoryFilter) continue;
        const ticketKey = ticketStatusStore.buildTicketKey(orgId, scan.scanId, category);
        const isTicketed = ticketedKeys.has(ticketKey);
        const ticketEntry = allStatuses[ticketKey];

        if (ticketStatusFilter === 'unticketed' && isTicketed) continue;
        if (ticketStatusFilter === 'ticketed' && !isTicketed) continue;
        if (ticketTargetFilter && (!ticketEntry || ticketEntry.ticketTarget !== ticketTargetFilter)) continue;

        const guidance = REMEDIATION_GUIDANCE[category] || REMEDIATION_GUIDANCE._default;
        const slaLimit = SLA_THRESHOLDS[guidance.priority] || SLA_THRESHOLDS.medium;
        const scanDate = new Date(scan.timestamp);
        const daysOpen = Math.floor((now - scanDate.getTime()) / 86400000);
        const slaBreached = !isTicketed && daysOpen > slaLimit;
        const slaDaysOver = slaBreached ? daysOpen - slaLimit : 0;

        if (slaBreachedFilter && !slaBreached) continue;

        violations.push({
          scanId: scan.scanId,
          timestamp: scan.timestamp,
          repository: scan.repository,
          branch: scan.branch,
          commitSha: scan.commitSha,
          triggeredBy: scan.triggeredBy,
          category,
          count,
          postureScore: scan.postureScore,
          gateStatus: scan.gateStatus,
          priority: guidance.priority,
          remediationStrategy: guidance.strategy,
          remediationDescription: guidance.description,
          remediationSteps: guidance.steps.join(' | '),
          ticketed: isTicketed ? 'Yes' : 'No',
          ticketRef: ticketEntry?.ticketRef || '',
          ticketTarget: ticketEntry?.ticketTarget || '',
          ticketMarkedAt: ticketEntry?.markedAt || '',
          daysOpen,
          slaLimit,
          slaBreached: slaBreached ? 'Yes' : 'No',
          slaDaysOver,
        });
      }
    }

    violations.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="compliance-ledger-${new Date().toISOString().slice(0, 10)}.json"`);
      res.json({
        exportedAt: new Date().toISOString(),
        totalRecords: violations.length,
        filters: { repository: filters.repository || 'all', branch: filters.branch || 'all', ticketStatus: ticketStatusFilter, slaBreachedOnly: slaBreachedFilter },
        violations,
      });
      return;
    }

    // CSV format
    const headers = [
      'Scan ID', 'Timestamp', 'Repository', 'Branch', 'Commit SHA', 'Triggered By',
      'Category', 'Findings Count', 'Posture Score', 'Gate Status',
      'Priority', 'Remediation Strategy', 'Remediation Description', 'Remediation Steps',
      'Ticketed', 'Ticket Ref', 'Ticket Target', 'Ticket Marked At',
      'Days Open', 'SLA Limit (days)', 'SLA Breached', 'SLA Days Over',
    ];
    const escapeCsv = (val) => {
      let s = String(val ?? '');
      // CSV injection neutralization: prefix dangerous chars with single quote
      if (/^[=+\-@]/.test(s)) {
        s = `'${s}`;
      }
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };
    const rows = violations.map(v => [
      v.scanId, v.timestamp, v.repository, v.branch, v.commitSha, v.triggeredBy,
      v.category, v.count, v.postureScore, v.gateStatus,
      v.priority, v.remediationStrategy, v.remediationDescription, v.remediationSteps,
      v.ticketed, v.ticketRef, v.ticketTarget, v.ticketMarkedAt,
      v.daysOpen, v.slaLimit, v.slaBreached, v.slaDaysOver,
    ].map(escapeCsv).join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="compliance-ledger-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    logger.error('[Analytics] Violations export failed:', err.message);
    res.status(500).json({ error: 'violations_export_failed', message: err.message });
  }
});

// POST /api/analytics/violations/dispatch-ticket — dispatch a ticket to an external tracker via webhook
router.post('/violations/dispatch-ticket', async (req, res) => {
  try {
    const { scanId, category, target } = req.body || {};
    if (!scanId) return res.status(400).json({ error: 'scanId is required' });
    if (!category) return res.status(400).json({ error: 'category is required' });

    const orgId = getOrgId(req);
    const ticketTarget = (target || 'jira').toLowerCase();
    const config = webhookConfigStore.getConfig(ticketTarget, orgId);
    if (!config || !config.apiUrl) {
      return res.status(400).json({ error: 'webhook_not_configured', message: `No webhook configuration found for ${ticketTarget}. Configure it first.` });
    }

    // Generate the ticket payload (reuse the same logic as ticket-payload endpoint)
    const result = analyticsStore.getScans({ orgId, limit: 100000, offset: 0 });
    const scan = result.scans.find(s => s.scanId === scanId);
    if (!scan) return res.status(404).json({ error: 'scan_not_found', message: 'Scan not found' });

    const count = (scan.categoryCounts || {})[category] || 0;
    if (count === 0) return res.status(404).json({ error: 'category_not_found', message: 'Category not found in this scan' });

    const guidance = REMEDIATION_GUIDANCE[category] || REMEDIATION_GUIDANCE._default;
    const priorityMap = { critical: 'P0', high: 'P1', medium: 'P2', low: 'P3' };
    const priorityLabel = priorityMap[guidance.priority] || 'P2';
    const title = `[${priorityLabel}] ${category} — ${count} finding${count > 1 ? 's' : ''} in ${scan.repository}/${scan.branch}`;

    const descriptionLines = [
      `h2. Violation Summary`, ``,
      `*Category:* ${category}`, `*Findings:* ${count}`, `*Repository:* ${scan.repository}`,
      `*Branch:* ${scan.branch}`, `*Commit:* ${scan.commitSha}`, `*Scan ID:* ${scan.scanId}`,
      `*Scan Date:* ${scan.timestamp}`, `*Triggered By:* ${scan.triggeredBy}`,
      `*Gate Status:* ${scan.gateStatus}`, `*Posture Score:* ${scan.postureScore}/100`, ``,
      `h2. Remediation Strategy: ${guidance.strategy}`, ``, `${guidance.description}`, ``,
      `h2. Remediation Steps`, ``, ...guidance.steps.map((step, i) => `#${i + 1}. ${step}`),
    ];
    const markdownDescription = descriptionLines.join('\n').replace(/h2\.\s/g, '## ').replace(/\*/g, '**');

    let apiUrl = config.apiUrl;
    let headers = { 'Content-Type': 'application/json' };
    let body;

    if (ticketTarget === 'jira') {
      if (config.authToken) headers['Authorization'] = `Bearer ${config.authToken}`;
      if (config.projectKey) {
        apiUrl = config.apiUrl.replace('{projectKey}', config.projectKey);
      }
      body = {
        fields: {
          project: { key: config.projectKey || 'SEC' },
          summary: title,
          description: descriptionLines.join('\n'),
          issuetype: { name: guidance.priority === 'critical' || guidance.priority === 'high' ? 'Bug' : 'Task' },
          priority: { name: guidance.priority === 'critical' ? 'Highest' : guidance.priority === 'high' ? 'High' : guidance.priority === 'medium' ? 'Medium' : 'Low' },
          labels: ['simplebeacon', 'compliance', guidance.strategy, `priority-${guidance.priority}`],
        },
      };
    } else if (ticketTarget === 'linear') {
      headers['Authorization'] = config.authToken;
      body = {
        title,
        description: markdownDescription,
        priority: guidance.priority === 'critical' ? 1 : guidance.priority === 'high' ? 2 : guidance.priority === 'medium' ? 3 : 4,
        labels: ['simplebeacon', 'compliance', guidance.strategy],
        metadata: { scanId: scan.scanId, category, repository: scan.repository, branch: scan.branch },
      };
      if (config.teamId) body.teamId = config.teamId;
    } else if (ticketTarget === 'github') {
      headers['Authorization'] = `Bearer ${config.authToken}`;
      apiUrl = config.apiUrl
        .replace('{owner}', config.repoOwner || '')
        .replace('{repo}', config.repoName || '');
      body = {
        title,
        body: markdownDescription,
        labels: ['compliance', guidance.priority, guidance.strategy, 'simplebeacon'],
      };
    } else {
      return res.status(400).json({ error: 'invalid_target', message: `Unknown target: ${ticketTarget}` });
    }

    const apiResp = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const respText = await apiResp.text();
    let respData;
    try { respData = JSON.parse(respText); } catch { respData = { raw: respText }; }

    if (!apiResp.ok) {
      logger.error(`[Analytics] Dispatch to ${ticketTarget} failed: ${apiResp.status}`, respText.substring(0, 200));
      return res.status(502).json({
        error: 'dispatch_failed',
        message: `External API returned ${apiResp.status}`,
        target: ticketTarget,
        response: respData,
      });
    }

    // Extract ticket URL/ID from response
    let ticketRef = '';
    if (ticketTarget === 'jira' && respData.key) {
      ticketRef = respData.self ? `${config.apiUrl.split('/rest/')[0]}/browse/${respData.key}` : respData.key;
    } else if (ticketTarget === 'linear' && respData.data?.id) {
      ticketRef = respData.data.url || respData.data.id;
    } else if (ticketTarget === 'github' && respData.html_url) {
      ticketRef = respData.html_url;
    } else if (respData.id) {
      ticketRef = respData.id;
    }

    // Auto-mark as ticketed
    if (ticketRef) {
      ticketStatusStore.markTicketed(scanId, category, ticketRef, ticketTarget, orgId);
    }

    res.json({
      success: true,
      target: ticketTarget,
      ticketRef,
      response: respData,
    });
  } catch (err) {
    logger.error('[Analytics] Dispatch ticket failed:', err.message);
    res.status(500).json({ error: 'dispatch_error', message: err.message });
  }
});

// POST /api/analytics/violations/bulk-dispatch-ticket — dispatch tickets to multiple violations with rate limiting
router.post('/violations/bulk-dispatch-ticket', async (req, res) => {
  try {
    const { violations, target } = req.body || {};
    if (!Array.isArray(violations) || violations.length === 0) return res.status(400).json({ error: 'violations array is required' });
    const orgId = getOrgId(req);
    const ticketTarget = (target || 'jira').toLowerCase();
    const config = webhookConfigStore.getConfig(ticketTarget, orgId);
    if (!config || !config.apiUrl) {
      return res.status(400).json({ error: 'webhook_not_configured', message: `No webhook configuration found for ${ticketTarget}.` });
    }

    const MAX_CONCURRENT = 3;
    const BATCH_DELAY_MS = 500;
    const MAX_RETRIES = 3;
    const BASE_BACKOFF_MS = 1000;

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    async function dispatchOne(scanId, category) {
      // Generate payload
      const result = analyticsStore.getScans({ orgId, limit: 100000, offset: 0 });
      const scan = result.scans.find(s => s.scanId === scanId);
      if (!scan) return { scanId, category, success: false, error: 'scan_not_found' };
      const count = (scan.categoryCounts || {})[category] || 0;
      if (count === 0) return { scanId, category, success: false, error: 'category_not_found' };

      const guidance = REMEDIATION_GUIDANCE[category] || REMEDIATION_GUIDANCE._default;
      const priorityMap = { critical: 'P0', high: 'P1', medium: 'P2', low: 'P3' };
      const priorityLabel = priorityMap[guidance.priority] || 'P2';
      const title = `[${priorityLabel}] ${category} — ${count} finding${count > 1 ? 's' : ''} in ${scan.repository}/${scan.branch}`;
      const descriptionLines = [
        `h2. Violation Summary`, ``,
        `*Category:* ${category}`, `*Findings:* ${count}`, `*Repository:* ${scan.repository}`,
        `*Branch:* ${scan.branch}`, `*Commit:* ${scan.commitSha}`, `*Scan ID:* ${scan.scanId}`,
        `*Scan Date:* ${scan.timestamp}`, `*Triggered By:* ${scan.triggeredBy}`,
        `*Gate Status:* ${scan.gateStatus}`, `*Posture Score:* ${scan.postureScore}/100`, ``,
        `h2. Remediation Strategy: ${guidance.strategy}`, ``, `${guidance.description}`, ``,
        `h2. Remediation Steps`, ``, ...guidance.steps.map((step, i) => `#${i + 1}. ${step}`),
      ];
      const markdownDescription = descriptionLines.join('\n').replace(/h2\.\s/g, '## ').replace(/\*/g, '**');

      let apiUrl = config.apiUrl;
      let headers = { 'Content-Type': 'application/json' };
      let body;

      if (ticketTarget === 'jira') {
        if (config.authToken) headers['Authorization'] = `Bearer ${config.authToken}`;
        apiUrl = config.apiUrl.replace('{projectKey}', config.projectKey || '');
        body = { fields: { project: { key: config.projectKey || 'SEC' }, summary: title, description: descriptionLines.join('\n'), issuetype: { name: guidance.priority === 'critical' || guidance.priority === 'high' ? 'Bug' : 'Task' }, priority: { name: guidance.priority === 'critical' ? 'Highest' : guidance.priority === 'high' ? 'High' : guidance.priority === 'medium' ? 'Medium' : 'Low' }, labels: ['simplebeacon', 'compliance', guidance.strategy, `priority-${guidance.priority}`] } };
      } else if (ticketTarget === 'linear') {
        headers['Authorization'] = config.authToken;
        body = { title, description: markdownDescription, priority: guidance.priority === 'critical' ? 1 : guidance.priority === 'high' ? 2 : guidance.priority === 'medium' ? 3 : 4, labels: ['simplebeacon', 'compliance', guidance.strategy], metadata: { scanId: scan.scanId, category, repository: scan.repository, branch: scan.branch } };
        if (config.teamId) body.teamId = config.teamId;
      } else if (ticketTarget === 'github') {
        headers['Authorization'] = `Bearer ${config.authToken}`;
        apiUrl = config.apiUrl.replace('{owner}', config.repoOwner || '').replace('{repo}', config.repoName || '');
        body = { title, body: markdownDescription, labels: ['compliance', guidance.priority, guidance.strategy, 'simplebeacon'] };
      } else {
        return { scanId, category, success: false, error: 'invalid_target' };
      }

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const apiResp = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(body) });
          if (apiResp.status === 429 || apiResp.status >= 500) {
            if (attempt < MAX_RETRIES) {
              const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
              await sleep(backoff);
              continue;
            }
            const respText = await apiResp.text();
            return { scanId, category, success: false, error: `rate_limited_${apiResp.status}`, response: respText.substring(0, 200) };
          }
          const respText = await apiResp.text();
          let respData;
          try { respData = JSON.parse(respText); } catch { respData = { raw: respText }; }
          if (!apiResp.ok) {
            return { scanId, category, success: false, error: `api_${apiResp.status}`, response: respData };
          }
          let ticketRef = '';
          if (ticketTarget === 'jira' && respData.key) ticketRef = `${config.apiUrl.split('/rest/')[0]}/browse/${respData.key}`;
          else if (ticketTarget === 'linear' && respData.data?.id) ticketRef = respData.data.url || respData.data.id;
          else if (ticketTarget === 'github' && respData.html_url) ticketRef = respData.html_url;
          else if (respData.id) ticketRef = respData.id;
          if (ticketRef) ticketStatusStore.markTicketed(scanId, category, ticketRef, ticketTarget, orgId);
          return { scanId, category, success: true, ticketRef };
        } catch (fetchErr) {
          if (attempt < MAX_RETRIES) {
            await sleep(BASE_BACKOFF_MS * Math.pow(2, attempt));
            continue;
          }
          return { scanId, category, success: false, error: 'fetch_error', message: fetchErr.message };
        }
      }
      return { scanId, category, success: false, error: 'max_retries_exceeded' };
    }

    // Process in batches of MAX_CONCURRENT with BATCH_DELAY_MS between batches
    const results = [];
    let succeeded = 0;
    let failed = 0;
    let rateLimited = 0;
    for (let i = 0; i < violations.length; i += MAX_CONCURRENT) {
      const batch = violations.slice(i, i + MAX_CONCURRENT);
      const batchResults = await Promise.all(
        batch.map(v => dispatchOne(v.scanId, v.category))
      );
      for (const r of batchResults) {
        results.push(r);
        if (r.success) succeeded++;
        else {
          failed++;
          if (r.error?.startsWith('rate_limited')) rateLimited++;
        }
      }
      if (i + MAX_CONCURRENT < violations.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    res.json({
      success: true,
      target: ticketTarget,
      total: violations.length,
      succeeded,
      failed,
      rateLimited,
      results,
    });
  } catch (err) {
    logger.error('[Analytics] Bulk dispatch ticket failed:', err.message);
    res.status(500).json({ error: 'bulk_dispatch_error', message: err.message });
  }
});

// GET /api/analytics/webhook/configs — get all webhook configurations
router.get('/webhook/configs', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const configs = webhookConfigStore.getAllConfigs(orgId);
    // Mask auth tokens in response
    const masked = {};
    for (const [key, val] of Object.entries(configs)) {
      masked[key] = { ...val, authToken: val.authToken ? '••••••••' : '' };
    }
    res.json({ success: true, configs: masked });
  } catch (err) {
    logger.error('[Analytics] Get webhook configs failed:', err.message);
    res.status(500).json({ error: 'webhook_configs_failed', message: err.message });
  }
});

// POST /api/analytics/webhook/configs — save a webhook configuration
router.post('/webhook/configs', (req, res) => {
  try {
    const { target, apiUrl, authToken, projectKey, teamId, repoOwner, repoName } = req.body || {};
    if (!target) return res.status(400).json({ error: 'target is required' });
    if (!apiUrl) return res.status(400).json({ error: 'apiUrl is required' });

    const orgId = getOrgId(req);
    const config = webhookConfigStore.setConfig(target, { apiUrl, authToken, projectKey, teamId, repoOwner, repoName }, orgId);
    res.json({ success: true, config: { ...config, authToken: '••••••••' } });
  } catch (err) {
    logger.error('[Analytics] Save webhook config failed:', err.message);
    res.status(500).json({ error: 'webhook_config_save_failed', message: err.message });
  }
});

// DELETE /api/analytics/webhook/configs/:target — delete a webhook configuration
router.delete('/webhook/configs/:target', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { target } = req.params;
    webhookConfigStore.deleteConfig(target, orgId);
    res.json({ success: true, deleted: target });
  } catch (err) {
    logger.error('[Analytics] Delete webhook config failed:', err.message);
    res.status(500).json({ error: 'webhook_config_delete_failed', message: err.message });
  }
});

// GET /api/analytics/report/schedules — get all report schedules
router.get('/report/schedules', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const schedules = reportScheduleStore.getAllSchedules(orgId);
    res.json({ success: true, schedules });
  } catch (err) {
    logger.error('[Analytics] Get report schedules failed:', err.message);
    res.status(500).json({ error: 'report_schedules_failed', message: err.message });
  }
});

// POST /api/analytics/report/schedules — create or update a report schedule
router.post('/report/schedules', (req, res) => {
  try {
    const { id, name, enabled, frequency, dayOfWeek, dayOfMonth, hour, minute, format, recipients, filters } = req.body || {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (!Array.isArray(recipients) || recipients.length === 0) return res.status(400).json({ error: 'recipients array is required' });
    const validFreq = ['daily', 'weekly', 'monthly'];
    if (frequency && !validFreq.includes(frequency)) return res.status(400).json({ error: 'frequency must be daily, weekly, or monthly' });
    const orgId = getOrgId(req);
    const schedule = reportScheduleStore.setSchedule(id, { name, enabled, frequency, dayOfWeek, dayOfMonth, hour, minute, format, recipients, filters }, orgId);
    res.json({ success: true, schedule });
  } catch (err) {
    logger.error('[Analytics] Save report schedule failed:', err.message);
    res.status(500).json({ error: 'report_schedule_save_failed', message: err.message });
  }
});

// DELETE /api/analytics/report/schedules/:id — delete a report schedule
router.delete('/report/schedules/:id', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    reportScheduleStore.deleteSchedule(id, orgId);
    res.json({ success: true, deleted: id });
  } catch (err) {
    logger.error('[Analytics] Delete report schedule failed:', err.message);
    res.status(500).json({ error: 'report_schedule_delete_failed', message: err.message });
  }
});

// POST /api/analytics/report/schedules/:id/run — manually trigger a report schedule
router.post('/report/schedules/:id/run', async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { id } = req.params;
    const schedule = reportScheduleStore.getSchedule(id, orgId);
    if (!schedule) return res.status(404).json({ error: 'schedule_not_found' });
    const result = await reportScheduler.runSchedule(schedule, orgId);
    if (result.success) {
      res.json({ success: true, schedule: reportScheduleStore.getSchedule(id, orgId), result: result });
    } else {
      res.status(500).json({ success: false, error: 'run_failed', message: result.error, schedule: reportScheduleStore.getSchedule(id, orgId) });
    }
  } catch (err) {
    logger.error('[Analytics] Manual report run failed:', err.message);
    res.status(500).json({ error: 'report_run_failed', message: err.message });
  }
});

// POST /api/analytics/record — record a scan (called by CLI/CI)
router.post('/record', (req, res) => {
  try {
    const sessionOrgId = getOrgId(req);
    const { orgId: bodyOrgId, summary, projectPath, categoryCounts, languageBreakdown, scanDurationMs, gateStatus, repository, branch, commitSha, triggeredBy } = req.body || {};
    const orgId = bodyOrgId || sessionOrgId;

    if (!orgId) return res.status(400).json({ error: 'orgId is required' });
    if (!summary || typeof summary !== 'object') return res.status(400).json({ error: 'summary object is required' });

    const entry = analyticsStore.recordScan({
      orgId,
      summary,
      projectPath,
      categoryCounts,
      languageBreakdown,
      scanDurationMs,
      gateStatus,
      repository,
      branch,
      commitSha,
      triggeredBy,
    });

    res.status(201).json({ success: true, scanId: entry.scanId, postureScore: entry.postureScore });
  } catch (err) {
    logger.error('[Analytics] Record failed:', err.message);
    res.status(500).json({ error: 'record_failed', message: err.message });
  }
});

module.exports = router;
