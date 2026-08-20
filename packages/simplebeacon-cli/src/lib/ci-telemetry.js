/**
 * Post anonymized CI scan metadata to SimpleBeacon Team dashboard (paid tokens only).
 * Never transmits source code, file paths, or issue descriptions.
 */

const {
  buildRepoFingerprint,
  buildRulesFingerprint,
  buildAnonymizedAggregate,
} = require("./anonymized-export");

const DEFAULT_TELEMETRY_URL =
  process.env.SIMPLEBEACON_CI_TELEMETRY_URL ||
  "https://simplebeacon.ai/api/simplebeacon/ci/telemetry";

const TELEMETRY_POST_TIMEOUT_MS =
  Number(process.env.SIMPLEBEACON_CI_TELEMETRY_TIMEOUT_MS) || 3000;

const LEGACY_FIELDS_ENABLED =
  process.env.SIMPLEBEACON_CI_TELEMETRY_LEGACY_FIELDS === "1" ||
  process.env.SIMPLEBEACON_CI_TELEMETRY_LEGACY_FIELDS === "true";

const VALID_SCAN_SOURCES = new Set(["ci", "ide", "dashboard"]);

/**
 * @param {Object} report
 * @returns {{ critical: number, high: number, medium: number, low: number }}
 */
function buildSeverityRollup(report) {
  const counts = report.severityCounts || {};
  return {
    critical: Number(counts.critical || 0),
    high: Number(counts.high || 0),
    medium: Number(counts.medium || 0),
    low: Number(counts.low || 0),
  };
}

/**
 * @param {Object} report
 * @returns {Record<string, number>}
 */
function buildCategoryRollup(report) {
  const rawIssues = report.rawIssues || report.detectedIssues || [];
  if (rawIssues.length > 0) {
    return buildAnonymizedAggregate(rawIssues).byCategory;
  }
  if (report.categoryCounts && typeof report.categoryCounts === "object") {
    return { ...report.categoryCounts };
  }
  if (
    report.aggregate?.byCategory &&
    typeof report.aggregate.byCategory === "object"
  ) {
    return { ...report.aggregate.byCategory };
  }
  return {};
}

/**
 * @param {Object} report
 * @param {Object} license
 * @param {Object} [context]
 * @returns {Object}
 */
function buildCiTelemetryPayload(report, license, context = {}) {
  const gate = report.gate || {};
  const counts = report.severityCounts || {};
  const gateFailed = gate.pass === false || (gate.blockingCount || 0) > 0;
  const scanSource = VALID_SCAN_SOURCES.has(context.scanSource)
    ? context.scanSource
    : process.env.GITHUB_ACTIONS
      ? "ci"
      : "ci";
  const projectRoot = context.projectRoot || report.projectRoot || null;
  const rulesFingerprint = buildRulesFingerprint(report.scanScope || {});

  const payload = {
    event: context.event || "team_scan",
    timestamp: new Date().toISOString(),
    tier: license?.tier || "developer",
    scan_source: scanSource,
    gate_pass: !gateFailed,
    gates_tripped: gateFailed ? 1 : 0,
    blocking_count: gate.blockingCount || 0,
    critical_blocked: counts.critical || 0,
    high_blocked: counts.high || 0,
    medium_count: counts.medium || 0,
    files_scanned: report.totalFiles || report.filesAnalyzed || 0,
    diff_only: Boolean(report.scanScope?.diffOnly),
    diff_files: report.scanScope?.diffFileCount || 0,
    quality_score: report.qualityScore ?? null,
    severity_rollup: buildSeverityRollup(report),
    category_rollup: buildCategoryRollup(report),
  };

  if (projectRoot) {
    payload.workspace_fingerprint = buildRepoFingerprint(projectRoot);
  } else if (context.workspaceFingerprint) {
    payload.workspace_fingerprint = String(context.workspaceFingerprint);
  }

  if (rulesFingerprint) {
    payload.rules_fingerprint = rulesFingerprint;
  }

  if (LEGACY_FIELDS_ENABLED) {
    payload.repository =
      context.repository || process.env.GITHUB_REPOSITORY || null;
    payload.workflow = context.workflow || process.env.GITHUB_WORKFLOW || null;
    payload.run_id = context.runId || process.env.GITHUB_RUN_ID || null;
    payload.ref = context.ref || process.env.GITHUB_REF || null;
    payload.pull_request =
      context.pullRequest ||
      process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER ||
      null;
  }

  return payload;
}

/**
 * @param {Object} report
 * @param {Object} license
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function postCiTelemetry(report, license, options = {}) {
  if (options.airGapped === true) {
    return { skipped: true, reason: "air_gapped" };
  }
  if (options.offline === true) {
    return { skipped: true, reason: "offline" };
  }
  if (!license?.paid) {
    return { skipped: true, reason: "community_tier" };
  }
  const token = process.env.SIMPLEBEACON_LICENSE_TOKEN;
  if (!token) {
    return { skipped: true, reason: "missing_token" };
  }
  if (typeof globalThis.fetch !== "function") {
    return { skipped: true, reason: "fetch_unavailable" };
  }

  const payload = buildCiTelemetryPayload(
    report,
    license,
    options.context || {},
  );
  const url = options.url || DEFAULT_TELEMETRY_URL;
  const timeoutMs = TELEMETRY_POST_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await globalThis.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { ok: false, status: response.status, error: text.slice(0, 200) };
    }
    const data = await response.json().catch(() => ({}));
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, networkError: true, error: err.message || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Team aggregation telemetry — same endpoint, anonymized team_scan payload.
 * @param {Object} report
 * @param {Object} license
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function postTeamTelemetry(report, license, options = {}) {
  const context = {
    ...(options.context || {}),
    event: "team_scan",
    scanSource: options.scanSource || options.context?.scanSource || "ci",
  };
  return postCiTelemetry(report, license, { ...options, context });
}

module.exports = {
  buildCiTelemetryPayload,
  postCiTelemetry,
  postTeamTelemetry,
  DEFAULT_TELEMETRY_URL,
  TELEMETRY_POST_TIMEOUT_MS,
  LEGACY_FIELDS_ENABLED,
};
