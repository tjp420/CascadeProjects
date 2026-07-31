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
 *   GET  /api/analytics/violations/ticket-statuses — Get all ticketed violation statuses
 *   POST /api/analytics/record             — Record a scan (internal/CI)
 *
 * @module analytics-routes
 */

const express = require('express');
const logger = require('../lib/app-logger.cjs');
const analyticsStore = require('../lib/usage-analytics-store.cjs');
const ticketStatusStore = require('../lib/ticket-status-store.cjs');

const router = express.Router();

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
router.get('/org/:orgId', (req, res) => {
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
      limit: parseInt(req.query.limit, 10) || 50,
      offset: parseInt(req.query.offset, 10) || 0,
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
    const limit = parseInt(req.query.limit, 10) || 10;
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
    const days = parseInt(String(req.query.days || '90'), 10) || 90;
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

// GET /api/analytics/violations — paginated violation rows with remediation guidance
//   Query params: orgId, repository, branch, startDate, endDate, limit, offset,
//                 ticketStatus (all|ticketed|unticketed), ticketTarget (jira|linear|github)
router.get('/violations', (req, res) => {
  try {
    const filters = {
      orgId: req.query.orgId,
      repository: req.query.repository,
      branch: req.query.branch,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit, 10) || 50,
      offset: parseInt(req.query.offset, 10) || 0,
    };
    const ticketStatusFilter = (req.query.ticketStatus || 'all').toLowerCase();
    const ticketTargetFilter = (req.query.ticketTarget || '').toLowerCase();

    const result = analyticsStore.getScans(filters);
    const ticketedKeys = ticketStatusStore.getTicketedKeys();
    const allStatuses = ticketStatusStore.getAllTicketStatuses();

    const violations = [];
    for (const scan of result.scans) {
      const cats = scan.categoryCounts || {};
      for (const [category, count] of Object.entries(cats)) {
        if (count <= 0) continue;
        const ticketKey = `${scan.scanId}::${category}`;
        const isTicketed = ticketedKeys.has(ticketKey);
        const ticketEntry = allStatuses[ticketKey];

        // Filter by ticket status
        if (ticketStatusFilter === 'unticketed' && isTicketed) continue;
        if (ticketStatusFilter === 'ticketed' && !isTicketed) continue;
        // Filter by ticket target
        if (ticketTargetFilter && (!ticketEntry || ticketEntry.ticketTarget !== ticketTargetFilter)) continue;

        const guidance = REMEDIATION_GUIDANCE[category] || REMEDIATION_GUIDANCE._default;
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

    const ticketTarget = (target || 'jira').toLowerCase();
    const result = analyticsStore.getScans({ limit: 100000, offset: 0 });
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

    const entry = ticketStatusStore.markTicketed(scanId, category, ticketRef, ticketTarget);
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

    const result = ticketStatusStore.unmarkTicketed(scanId, category);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('[Analytics] Unmark ticketed failed:', err.message);
    res.status(500).json({ error: 'unmark_ticketed_failed', message: err.message });
  }
});

// GET /api/analytics/violations/ticket-statuses — get all ticketed violation statuses
router.get('/violations/ticket-statuses', (req, res) => {
  try {
    const statuses = ticketStatusStore.getAllTicketStatuses();
    res.json({ success: true, statuses });
  } catch (err) {
    logger.error('[Analytics] Ticket statuses failed:', err.message);
    res.status(500).json({ error: 'ticket_statuses_failed', message: err.message });
  }
});

// POST /api/analytics/record — record a scan (called by CLI/CI)
router.post('/record', (req, res) => {
  try {
    const { orgId, summary, projectPath, categoryCounts, languageBreakdown, scanDurationMs, gateStatus, repository, branch, commitSha, triggeredBy } = req.body || {};

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
