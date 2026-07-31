/**
 * Post anonymized CI scan metadata to SimpleBeacon Team dashboard (paid tokens only).
 * Never transmits source code, file paths, or issue descriptions.
 */

const DEFAULT_TELEMETRY_URL =
  process.env.SIMPLEBEACON_CI_TELEMETRY_URL ||
  'https://simplebeacon.ai/api/simplebeacon/ci/telemetry';

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
  return {
    event: 'pipeline_scan',
    timestamp: new Date().toISOString(),
    tier: license?.tier || 'developer',
    repository: context.repository || process.env.GITHUB_REPOSITORY || null,
    workflow: context.workflow || process.env.GITHUB_WORKFLOW || null,
    run_id: context.runId || process.env.GITHUB_RUN_ID || null,
    ref: context.ref || process.env.GITHUB_REF || null,
    pull_request: context.pullRequest || process.env.GITHUB_EVENT_PULL_REQUEST_NUMBER || null,
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
  };
}

/**
 * @param {Object} report
 * @param {Object} license
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
async function postCiTelemetry(report, license, options = {}) {
  if (options.airGapped === true) {
    return { skipped: true, reason: 'air_gapped' };
  }
  if (!license?.paid) {
    return { skipped: true, reason: 'community_tier' };
  }
  const token = process.env.SIMPLEBEACON_LICENSE_TOKEN;
  if (!token) {
    return { skipped: true, reason: 'missing_token' };
  }
  if (typeof globalThis.fetch !== 'function') {
    return { skipped: true, reason: 'fetch_unavailable' };
  }

  const payload = buildCiTelemetryPayload(report, license, options.context || {});
  const url = options.url || DEFAULT_TELEMETRY_URL;
  const timeoutMs = Number(process.env.SIMPLEBEACON_CI_TELEMETRY_TIMEOUT_MS) || 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await globalThis.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
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

module.exports = {
  buildCiTelemetryPayload,
  postCiTelemetry,
  DEFAULT_TELEMETRY_URL,
};
