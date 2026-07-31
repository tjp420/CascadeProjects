/**
 * PR integration API — receive encrypted scan reports from the GitHub Action
 * and return structured annotations for the GitHub Checks / PR comments API.
 *
 * Privacy model: source code never touches this server. The action runs the
 * scanner locally and only posts a redacted JSON report with hashed metadata.
 */

const express = require('express');
const crypto = require('crypto');

const { authenticate } = require('../middleware/auth.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

// In-memory store for PR reports; production should use a durable store
const prReportStore = new Map();

const REPORT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Validate a PR report payload.
 * @param {any} body
 * @returns {string|null} Error message or null if valid
 */
function validateReport(body) {
  if (!body || typeof body !== 'object') return 'Payload must be a JSON object';
  if (!body.reportHash || typeof body.reportHash !== 'string') return 'Missing reportHash';
  if (!body.repository || typeof body.repository !== 'string') return 'Missing repository';
  if (!body.sha || typeof body.sha !== 'string') return 'Missing sha';
  if (!Array.isArray(body.detectedIssues) && !body.rawIssues && !body.issues && !body.findings) {
    return 'Report contains no issue findings';
  }
  return null;
}

/**
 * Normalize issues from the various SimpleBeacon report shapes.
 * @param {any} body
 * @returns {Array}
 */
function normalizeIssues(body) {
  const raw = body.detectedIssues || body.rawIssues || body.issues || body.findings || [];
  if (!Array.isArray(raw)) return [];
  return raw.map((issue) => ({
    id: issue.id || issue.type || issue.ruleId || crypto.randomUUID(),
    type: issue.type || issue.ruleId || 'issue',
    severity: issue.severity || 'low',
    description: issue.description || issue.message || issue.title || 'No description',
    filePath: issue.filePath || issue.file || issue.path || '',
    line: issue.line || issue.lineNumber || issue.startLine || null,
    recommendedAction: issue.recommendedAction || issue.fix || issue.suggestion || ''
  }));
}

/**
 * Convert an issue into a GitHub Checks annotation.
 * @param {any} issue
 * @returns {any}
 */
function toAnnotation(issue) {
  const level = issue.severity === 'high' ? 'failure' : issue.severity === 'medium' ? 'warning' : 'notice';
  return {
    path: issue.filePath,
    start_line: issue.line || 1,
    end_line: issue.line || 1,
    annotation_level: level,
    message: issue.description,
    title: `${issue.type} (${issue.severity})`,
    raw_details: issue.recommendedAction
  };
}

/**
 * Setup PR integration API routes.
 * @param {import('express').Application} app
 * @param {Object} _options
 */
function setupPrIntegrationAPI(app, _options = {}) {
  const router = express.Router();

  // Public-ish endpoint for GitHub Actions; protected by a bearer token
  router.post('/pr-report', express.json({ limit: REPORT_MAX_BYTES }), authenticate, (req, res) => {
    const body = req.body;
    const error = validateReport(body);
    if (error) {
      return res.status(400).json({ success: false, error });
    }

    const issues = normalizeIssues(body);
    const reportKey = `${body.repository}:${body.sha}`;
    const reportRecord = {
      repository: body.repository,
      ref: body.ref,
      sha: body.sha,
      prNumber: body.prNumber || req.headers['x-github-pr-number'] || null,
      actor: body.actor,
      workflowRunId: body.workflowRunId,
      collectedAt: body.collectedAt,
      reportHash: body.reportHash,
      issueCount: issues.length,
      issues,
      annotations: issues.map(toAnnotation),
      receivedAt: new Date().toISOString()
    };

    prReportStore.set(reportKey, reportRecord);

    // Return annotation payload for the GitHub Action to post as a check run
    res.json({
      success: true,
      reportKey,
      issueCount: reportRecord.issueCount,
      annotations: reportRecord.annotations.slice(0, 50), // GitHub Checks API limit per request
      summary: {
        title: 'SimpleBeacon PR Scan',
        summary: `${reportRecord.issueCount} issue(s) found in this PR.`,
        text: `Repository: ${body.repository}\nSHA: ${body.sha}\nRun: ${body.workflowRunId || 'n/a'}\nCollected: ${body.collectedAt || 'n/a'}\nReport hash: ${body.reportHash}`
      }
    });
  });

  // Dashboard-facing endpoint to retrieve the latest PR report for a repo/sha
  router.get('/pr-report/:repository/:sha', authenticate, (req, res) => {
    const { repository, sha } = req.params;
    const key = `${repository}:${sha}`;
    const report = prReportStore.get(key);
    if (!report) {
      return sendError(res, 404, 'Report not found');
    }
    res.json({ success: true, data: report });
  });

  // List recent reports for a repository
  router.get('/pr-reports/:repository', authenticate, (req, res) => {
    const { repository } = req.params;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const reports = [];
    for (const [key, value] of prReportStore) {
      if (key.startsWith(repository + ':')) {
        reports.push(value);
      }
    }
    reports.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
    res.json({ success: true, data: reports.slice(0, limit) });
  });

  app.use('/api/integrations', router);
}

module.exports = { setupPrIntegrationAPI, prReportStore };
