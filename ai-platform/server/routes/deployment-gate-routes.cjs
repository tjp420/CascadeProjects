"use strict";

const express = require("express");
const crypto = require("crypto");
const {
  authenticate,
  optionalAuthenticate,
} = require("../middleware/auth.cjs");
const deploymentGateStore = require("../lib/deployment-gate-store.cjs");
const ticketStatusStore = require("../lib/ticket-status-store.cjs");
const auditLogger = require("../lib/audit-logger.cjs");
const { sendError } = require("../lib/response-helpers.cjs");

// Lazy-load analytics store to avoid circular deps
let analyticsStoreRef = null;
function getAnalyticsStore() {
  if (!analyticsStoreRef)
    analyticsStoreRef = require("../lib/usage-analytics-store.cjs");
  return analyticsStoreRef;
}

const router = express.Router();

// SLA thresholds (mirrors analytics-routes.cjs)
const SLA_THRESHOLDS = {
  critical: 2,
  high: 7,
  medium: 30,
  low: 60,
};

const REMEDIATION_PRIORITIES = {
  "insecure-transport": "critical",
  "missing-security-headers": "high",
  "hardcoded-secrets": "critical",
  "debug-artifacts": "medium",
  "outdated-dependencies": "high",
  "missing-rate-limit": "high",
  "prototype-pollution": "high",
  "eval-usage": "high",
  "insecure-random": "medium",
  "config-drift": "low",
  _default: "medium",
};

function getOrgId(req) {
  return req.user?.id || req.user?.email || "default";
}

// Apply authentication to all deployment-gate endpoints.
// Use optionalAuthenticate so CI runners with API tokens can also access
// (they'll get req.user from the token, or fall through with req.authError).
router.use(authenticate);

// ── Helper: Find latest scan for a repository/branch ────────────────────────

function findLatestScan(orgId, repository, branch, commitSha) {
  const store = getAnalyticsStore();
  const filters = { orgId, limit: 10000, offset: 0 };
  if (repository) filters.repository = repository;
  if (branch) filters.branch = branch;
  const result = store.getScans(filters);
  let scans = result.scans || [];
  if (commitSha) {
    const matched = scans.filter((s) => s.commitSha === commitSha);
    if (matched.length > 0) scans = matched;
  }
  if (scans.length === 0) return null;
  // Sort by timestamp descending
  scans.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return scans[0];
}

// ── Helper: Compute SLA breaches for a scan ─────────────────────────────────

function computeSlaBreaches(orgId, scan) {
  const ticketedKeys = ticketStatusStore.getTicketedKeys(orgId);
  const now = Date.now();
  const breaches = [];
  const cats = scan.categoryCounts || {};
  for (const [category, count] of Object.entries(cats)) {
    if (count <= 0) continue;
    const ticketKey = ticketStatusStore.buildTicketKey(
      orgId,
      scan.scanId,
      category,
    );
    const isTicketed = ticketedKeys.has(ticketKey);
    if (isTicketed) continue;
    const priority =
      REMEDIATION_PRIORITIES[category] || REMEDIATION_PRIORITIES._default;
    const slaLimit = SLA_THRESHOLDS[priority] || SLA_THRESHOLDS.medium;
    const scanDate = new Date(scan.timestamp);
    const daysOpen = Math.floor((now - scanDate.getTime()) / 86400000);
    if (daysOpen > slaLimit) {
      breaches.push({
        category,
        priority,
        daysOpen,
        slaLimit,
        daysOver: daysOpen - slaLimit,
      });
    }
  }
  return breaches;
}

// ── Helper: Count unticketed critical violations ────────────────────────────

function countUnticketedCritical(orgId, scan) {
  const ticketedKeys = ticketStatusStore.getTicketedKeys(orgId);
  let count = 0;
  const cats = scan.categoryCounts || {};
  for (const [category, catCount] of Object.entries(cats)) {
    if (catCount <= 0) continue;
    const priority =
      REMEDIATION_PRIORITIES[category] || REMEDIATION_PRIORITIES._default;
    if (priority !== "critical") continue;
    const ticketKey = ticketStatusStore.buildTicketKey(
      orgId,
      scan.scanId,
      category,
    );
    if (!ticketedKeys.has(ticketKey)) count += catCount;
  }
  return count;
}

// ── Helper: Run gate evaluation ─────────────────────────────────────────────

function evaluateGate(orgId, scan, policy, overrides) {
  const effectivePolicy = { ...policy, ...overrides };
  const failures = [];

  if (!scan) {
    return {
      pass: false,
      failures: [
        {
          rule: "no_scan_found",
          message:
            "No scan record found for the specified repository/branch/commit",
        },
      ],
      scan: null,
    };
  }

  const severityCounts = scan.severityCounts || {};
  const criticalCount = severityCounts.critical || 0;
  const highCount = severityCounts.high || 0;
  const mediumCount = severityCounts.medium || 0;
  const lowCount = severityCounts.low || 0;

  // Rule: posture score threshold
  if (
    effectivePolicy.minPostureScore !== undefined &&
    scan.postureScore !== null
  ) {
    if (scan.postureScore < effectivePolicy.minPostureScore) {
      failures.push({
        rule: "min_posture_score",
        message: `Posture score ${scan.postureScore} is below minimum ${effectivePolicy.minPostureScore}`,
        actual: scan.postureScore,
        threshold: effectivePolicy.minPostureScore,
      });
    }
  }

  // Rule: max critical findings
  if (
    effectivePolicy.maxCritical !== undefined &&
    criticalCount > effectivePolicy.maxCritical
  ) {
    failures.push({
      rule: "max_critical",
      message: `Critical findings (${criticalCount}) exceed maximum (${effectivePolicy.maxCritical})`,
      actual: criticalCount,
      threshold: effectivePolicy.maxCritical,
    });
  }

  // Rule: max high findings
  if (
    effectivePolicy.maxHigh !== undefined &&
    highCount > effectivePolicy.maxHigh
  ) {
    failures.push({
      rule: "max_high",
      message: `High findings (${highCount}) exceed maximum (${effectivePolicy.maxHigh})`,
      actual: highCount,
      threshold: effectivePolicy.maxHigh,
    });
  }

  // Rule: max medium findings
  if (
    effectivePolicy.maxMedium !== undefined &&
    mediumCount > effectivePolicy.maxMedium
  ) {
    failures.push({
      rule: "max_medium",
      message: `Medium findings (${mediumCount}) exceed maximum (${effectivePolicy.maxMedium})`,
      actual: mediumCount,
      threshold: effectivePolicy.maxMedium,
    });
  }

  // Rule: max low findings
  if (
    effectivePolicy.maxLow !== undefined &&
    lowCount > effectivePolicy.maxLow
  ) {
    failures.push({
      rule: "max_low",
      message: `Low findings (${lowCount}) exceed maximum (${effectivePolicy.maxLow})`,
      actual: lowCount,
      threshold: effectivePolicy.maxLow,
    });
  }

  // Rule: block on gate fail
  if (effectivePolicy.blockOnGateFail && scan.gateStatus === "fail") {
    failures.push({
      rule: "gate_status_fail",
      message: "Scan gate status is fail",
      actual: scan.gateStatus,
      threshold: "pass",
    });
  }

  // Rule: block on SLA breached
  if (effectivePolicy.blockOnSlaBreached) {
    const slaBreaches = computeSlaBreaches(orgId, scan);
    if (slaBreaches.length > 0) {
      failures.push({
        rule: "sla_breached",
        message: `${slaBreaches.length} SLA-breached unticketed violation(s) found`,
        actual: slaBreaches.length,
        threshold: 0,
        details: slaBreaches,
      });
    }
  }

  // Rule: block on unticketed critical
  if (effectivePolicy.blockOnUnticketedCritical) {
    const unticketedCritical = countUnticketedCritical(orgId, scan);
    if (unticketedCritical > 0) {
      failures.push({
        rule: "unticketed_critical",
        message: `${unticketedCritical} unticketed critical violation(s) found`,
        actual: unticketedCritical,
        threshold: 0,
      });
    }
  }

  return {
    pass: failures.length === 0,
    failures,
    scan: {
      scanId: scan.scanId,
      timestamp: scan.timestamp,
      repository: scan.repository,
      branch: scan.branch,
      commitSha: scan.commitSha,
      postureScore: scan.postureScore,
      gateStatus: scan.gateStatus,
      totalFindings: scan.totalFindings,
      severityCounts,
    },
  };
}

// ── GET /api/deployment-gate/evaluate ───────────────────────────────────────
//   Query params: repository, branch, commitSha (optional),
//                 minPostureScore, maxCritical, maxHigh, maxMedium, maxLow,
//                 blockOnGateFail, blockOnSlaBreached, blockOnUnticketedCritical,
//                 triggeredBy (optional — identifies the CI runner)
//   Returns: { pass, failures, scan, policy, evaluationId, evaluatedAt }
router.get("/evaluate", (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { repository, branch, commitSha, triggeredBy } = req.query;

    if (!repository) {
      return sendError(res, 400, "repository is required", {
        message: "Specify the repository to evaluate",
      });
    }

    // Load org policy, then apply any query-param overrides
    const policy = deploymentGateStore.getPolicy(orgId);
    const overrides = {};
    if (req.query.minPostureScore !== undefined)
      overrides.minPostureScore = parseInt(req.query.minPostureScore, 10);
    if (req.query.maxCritical !== undefined)
      overrides.maxCritical = parseInt(req.query.maxCritical, 10);
    if (req.query.maxHigh !== undefined)
      overrides.maxHigh = parseInt(req.query.maxHigh, 10);
    if (req.query.maxMedium !== undefined)
      overrides.maxMedium = parseInt(req.query.maxMedium, 10);
    if (req.query.maxLow !== undefined)
      overrides.maxLow = parseInt(req.query.maxLow, 10);
    if (req.query.blockOnGateFail !== undefined)
      overrides.blockOnGateFail = req.query.blockOnGateFail === "true";
    if (req.query.blockOnSlaBreached !== undefined)
      overrides.blockOnSlaBreached = req.query.blockOnSlaBreached === "true";
    if (req.query.blockOnUnticketedCritical !== undefined)
      overrides.blockOnUnticketedCritical =
        req.query.blockOnUnticketedCritical === "true";

    const scan = findLatestScan(
      orgId,
      repository,
      branch || null,
      commitSha || null,
    );
    const result = evaluateGate(orgId, scan, policy, overrides);
    const evaluationId = `eval-${crypto.randomBytes(6).toString("hex")}`;
    const evaluatedAt = new Date().toISOString();

    const response = {
      ...result,
      policy: { ...policy, ...overrides },
      evaluationId,
      evaluatedAt,
      triggeredBy: triggeredBy || null,
    };

    // Record in history
    deploymentGateStore.recordEvaluation(orgId, response);

    const status = result.pass ? 200 : 403;
    res.status(status).json(response);
  } catch (err) {
    sendError(res, 500, "gate_evaluation_failed", { message: err.message });
  }
});

// ── GET /api/deployment-gate/policy ─────────────────────────────────────────
router.get("/policy", (req, res) => {
  try {
    const orgId = getOrgId(req);
    const policy = deploymentGateStore.getPolicy(orgId);
    res.json({ success: true, policy });
  } catch (err) {
    sendError(res, 500, "policy_fetch_failed", { message: err.message });
  }
});

// ── POST /api/deployment-gate/policy ────────────────────────────────────────
router.post("/policy", (req, res) => {
  try {
    const orgId = getOrgId(req);
    const {
      minPostureScore,
      maxCritical,
      maxHigh,
      maxMedium,
      maxLow,
      blockOnGateFail,
      blockOnSlaBreached,
      blockOnUnticketedCritical,
    } = req.body || {};
    const oldPolicy = deploymentGateStore.getPolicy(orgId);
    const policy = deploymentGateStore.setPolicy(orgId, {
      minPostureScore,
      maxCritical,
      maxHigh,
      maxMedium,
      maxLow,
      blockOnGateFail,
      blockOnSlaBreached,
      blockOnUnticketedCritical,
    });
    auditLogger.log({
      orgId,
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: "UPDATE",
      entity: "deployment_gate_policy",
      entityId: orgId,
      oldValue: oldPolicy,
      newValue: policy,
      metadata: { route: req.originalUrl },
    });
    res.json({ success: true, policy });
  } catch (err) {
    sendError(res, 500, "policy_save_failed", { message: err.message });
  }
});

// ── GET /api/deployment-gate/history ────────────────────────────────────────
//   Query params: limit (default 50, max 200)
router.get("/history", (req, res) => {
  try {
    const orgId = getOrgId(req);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 50, 1),
      200,
    );
    const history = deploymentGateStore.getHistory(orgId, limit);
    res.json({ success: true, history, count: history.length });
  } catch (err) {
    sendError(res, 500, "history_fetch_failed", { message: err.message });
  }
});

module.exports = router;
