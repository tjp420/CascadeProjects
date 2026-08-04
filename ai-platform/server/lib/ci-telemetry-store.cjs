/**
 * Lightweight CI telemetry store for Team tier dashboards.
 * Metadata only — no source code, file paths, or issue descriptions.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE_PATH = process.env.SIMPLEBEACON_CI_TELEMETRY_STORE
  || path.join(__dirname, '../../.simplebeacon', 'ci-telemetry.json');
const MAX_EVENTS = Number(process.env.SIMPLEBEACON_CI_TELEMETRY_MAX || 50000);

/** Rolling retention for team telemetry events (Phase 1 constant). */
const TEAM_TELEMETRY_RETENTION_DAYS = Number(
  process.env.SIMPLEBEACON_TEAM_TELEMETRY_RETENTION_DAYS || 90
);

/**
 * k-anonymity floor — enforced in summarizeTeamTelemetry (Phase 2).
 * Documented here so ingest and rollup share the same default.
 */
const K_ANONYMITY_MIN_WORKSPACES = Number(
  process.env.SIMPLEBEACON_TEAM_TELEMETRY_K_MIN || 3
);

const TEAM_TELEMETRY_ALLOWED_FIELDS = [
  'event', 'timestamp', 'tier', 'scan_source', 'workspace_fingerprint',
  'gate_pass', 'gates_tripped', 'blocking_count', 'critical_blocked',
  'high_blocked', 'medium_count', 'files_scanned', 'diff_only', 'diff_files',
  'quality_score', 'severity_rollup', 'category_rollup', 'rules_fingerprint'
];

const TEAM_TELEMETRY_LEGACY_FIELDS = [
  'repository', 'workflow', 'run_id', 'ref', 'pull_request'
];

const TEAM_TELEMETRY_FORBIDDEN_FIELDS = [
  'projectRoot', 'project_path', 'repo_path', 'file_path', 'filePath',
  'file_paths', 'snippet', 'snippets', 'description', 'descriptions',
  'branch', 'branch_name', 'commit_sha', 'commitSha', 'sha', 'pr_number',
  'pull_request_number', 'issues', 'rawIssues', 'detectedIssues',
  'org_fingerprint', 'orgKey', 'email', 'user', 'display_name'
];

const PATH_LIKE = /(?:^|[/\\])[A-Za-z0-9._-]+(?:[/\\][A-Za-z0-9._-]+)+/;
const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;
const WORKSPACE_FINGERPRINT = /^[0-9a-f]{24}$/i;

function readStore() {
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.events) ? parsed : { events: [] };
  } catch {
    return { events: [] };
  }
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, STORE_PATH);
}

function accountKey(email) {
  return crypto.createHash('sha256').update(String(email || '').toLowerCase()).digest('hex').slice(0, 16);
}

/**
 * Resolve org bucket key from license email + subscription metadata.
 * @param {string} email
 * @param {Object|null} [subscription]
 * @returns {string}
 */
function resolveOrgKey(email, subscription = null) {
  const salt = process.env.SIMPLEBEACON_ANON_SALT || 'simplebeacon-anon-v1';
  const subject = subscription?.certOrgId
    || subscription?.stripeCustomerId
    || String(email || '').toLowerCase();
  return crypto.createHash('sha256')
    .update(`${salt}:${String(subject)}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Hash a raw repo identifier into a workspace fingerprint (24 hex).
 * @param {string} rawRepo
 * @returns {string}
 */
function hashWorkspaceFingerprint(rawRepo) {
  const salt = process.env.SIMPLEBEACON_ANON_SALT || 'simplebeacon-anon-v1';
  return crypto.createHash('sha256')
    .update(`${salt}:${String(rawRepo || '').replace(/\\/g, '/')}`)
    .digest('hex')
    .slice(0, 24);
}

/**
 * @param {*} value
 * @returns {boolean}
 */
function isForbiddenScalar(value) {
  if (value == null) return false;
  const text = String(value);
  if (PATH_LIKE.test(text)) return true;
  if (COMMIT_SHA.test(text.trim())) return true;
  if (/^refs\/heads\//.test(text)) return true;
  if (/^refs\/pull\//.test(text)) return true;
  return false;
}

/**
 * Strip forbidden fields and coerce team telemetry payload to allowlist.
 * @param {Object} input
 * @param {{ legacyFields?: boolean }} [options]
 * @returns {{ payload: Object, stripped: string[], rejected: string[] }}
 */
function sanitizeTeamTelemetryPayload(input, options = {}) {
  const body = input && typeof input === 'object' ? input : {};
  const legacyFields = options.legacyFields === true;
  const allowed = new Set([
    ...TEAM_TELEMETRY_ALLOWED_FIELDS,
    ...(legacyFields ? TEAM_TELEMETRY_LEGACY_FIELDS : [])
  ]);
  const stripped = [];
  const rejected = [];
  const payload = {};

  for (const key of Object.keys(body)) {
    if (TEAM_TELEMETRY_FORBIDDEN_FIELDS.includes(key)) {
      rejected.push(key);
      continue;
    }
    if (!allowed.has(key)) {
      stripped.push(key);
      continue;
    }
    const value = body[key];
    if (key !== 'workspace_fingerprint' && key !== 'rules_fingerprint' && isForbiddenScalar(value)) {
      rejected.push(key);
      continue;
    }
    payload[key] = value;
  }

  if (!payload.workspace_fingerprint) {
    const rawRepo = body.projectRoot || body.project_path || body.repo_path
      || (legacyFields ? body.repository : null);
    if (rawRepo) {
      payload.workspace_fingerprint = hashWorkspaceFingerprint(rawRepo);
    } else if (body.repository && !legacyFields) {
      payload.workspace_fingerprint = hashWorkspaceFingerprint(body.repository);
      if (!stripped.includes('repository')) {
        stripped.push('repository');
      }
    }
  } else if (!WORKSPACE_FINGERPRINT.test(String(payload.workspace_fingerprint))) {
    rejected.push('workspace_fingerprint');
    delete payload.workspace_fingerprint;
  }

  if (!legacyFields) {
    for (const key of TEAM_TELEMETRY_LEGACY_FIELDS) {
      if (payload[key] !== undefined) {
        if (!stripped.includes(key)) {
          stripped.push(key);
        }
        delete payload[key];
      }
    }
  }

  return { payload, stripped, rejected };
}

function purgeExpiredEvents(events) {
  const cutoff = Date.now() - (TEAM_TELEMETRY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return events.filter((ev) => {
    const ts = Date.parse(ev.recordedAt || ev.timestamp || '');
    return Number.isFinite(ts) && ts >= cutoff;
  });
}

/**
 * @param {string} email
 * @param {Object} payload
 * @param {{ orgKey?: string, subscription?: Object|null }} [options]
 */
function recordCiTelemetryEvent(email, payload, options = {}) {
  const { payload: sanitized } = sanitizeTeamTelemetryPayload(payload, {
    legacyFields: process.env.SIMPLEBEACON_CI_TELEMETRY_LEGACY_FIELDS === '1'
      || process.env.SIMPLEBEACON_CI_TELEMETRY_LEGACY_FIELDS === 'true'
  });
  const store = readStore();
  const event = {
    id: `ci_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    accountKey: accountKey(email),
    orgKey: options.orgKey || resolveOrgKey(email, options.subscription || null),
    recordedAt: new Date().toISOString(),
    ...sanitized
  };
  // Privacy (D-03): never persist raw email — accountKey + orgKey only.
  if (Object.prototype.hasOwnProperty.call(event, 'email')) {
    delete event.email;
  }
  store.events.push(event);
  store.events = purgeExpiredEvents(store.events);
  if (store.events.length > MAX_EVENTS) {
    store.events = store.events.slice(-MAX_EVENTS);
  }
  writeStore(store);
  return event;
}

/**
 * @param {string} email
 * @param {{ days?: number }} [options]
 */
function summarizeCiTelemetry(email, options = {}) {
  const days = Number(options.days) || 7;
  const since = Date.now() - (days * 24 * 60 * 60 * 1000);
  const key = accountKey(email);
  const events = readStore().events.filter((ev) => {
    if (ev.accountKey !== key) return false;
    const ts = Date.parse(ev.recordedAt || ev.timestamp || '');
    return Number.isFinite(ts) && ts >= since;
  });

  const repos = new Set();
  let gatesTripped = 0;
  let criticalsBlocked = 0;
  let diffsAnalyzed = 0;

  for (const ev of events) {
    if (ev.workspace_fingerprint) repos.add(ev.workspace_fingerprint);
    else if (ev.repository) repos.add(ev.repository);
    if (ev.gate_pass === false || (ev.gates_tripped || 0) > 0) gatesTripped += 1;
    criticalsBlocked += Number(ev.critical_blocked || 0);
    diffsAnalyzed += Number(ev.diff_files || ev.files_scanned || 0);
  }

  return {
    periodDays: days,
    total_scans: events.length,
    repositories: repos.size,
    diffs_analyzed: diffsAnalyzed,
    gates_tripped: gatesTripped,
    criticals_blocked: criticalsBlocked,
    merges_blocked_this_week: gatesTripped,
    updatedAt: new Date().toISOString()
  };
}

/**
 * @param {string} orgKey
 * @param {number} days
 * @returns {Object[]}
 */
function filterOrgEvents(orgKey, days) {
  const windowDays = Number(days) || 7;
  const since = Date.now() - (windowDays * 24 * 60 * 60 * 1000);
  const key = String(orgKey || '');
  return readStore().events.filter((ev) => {
    if (ev.orgKey !== key) return false;
    const ts = Date.parse(ev.recordedAt || ev.timestamp || '');
    return Number.isFinite(ts) && ts >= since;
  });
}

/**
 * Linear interpolation percentile on a sorted numeric array (p in 0..100).
 * @param {number[]} sorted
 * @param {number} p
 * @returns {number|null}
 */
function percentileLinear(sorted, p) {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const position = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  const weight = position - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

/**
 * @param {Object[]} events
 * @returns {{ p10: number|null, p25: number|null, p50: number|null, p75: number|null, p90: number|null, sampleSize: number }}
 */
function computeQualityDistribution(events) {
  const scores = events
    .map((ev) => ev.quality_score)
    .filter((score) => score != null && Number.isFinite(Number(score)))
    .map((score) => Number(score))
    .sort((a, b) => a - b);

  const round = (value) => (value == null ? null : Math.round(value * 1000) / 1000);

  return {
    p10: round(percentileLinear(scores, 10)),
    p25: round(percentileLinear(scores, 25)),
    p50: round(percentileLinear(scores, 50)),
    p75: round(percentileLinear(scores, 75)),
    p90: round(percentileLinear(scores, 90)),
    sampleSize: scores.length
  };
}

/**
 * @param {Object[]} events
 * @returns {{ critical: number, high: number, medium: number, low: number }}
 */
function aggregateSeverityTotals(events) {
  const totals = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const ev of events) {
    const rollup = ev.severity_rollup && typeof ev.severity_rollup === 'object'
      ? ev.severity_rollup
      : null;
    if (rollup) {
      totals.critical += Number(rollup.critical || 0);
      totals.high += Number(rollup.high || 0);
      totals.medium += Number(rollup.medium || 0);
      totals.low += Number(rollup.low || 0);
    } else {
      totals.critical += Number(ev.critical_blocked || 0);
      totals.high += Number(ev.high_blocked || 0);
      totals.medium += Number(ev.medium_count || 0);
    }
  }
  return totals;
}

/**
 * @param {Object[]} events
 * @returns {{ ci: number, ide: number, dashboard: number }}
 */
function aggregateScanSources(events) {
  const sources = { ci: 0, ide: 0, dashboard: 0 };
  for (const ev of events) {
    const source = String(ev.scan_source || 'ci').toLowerCase();
    if (source === 'ide') sources.ide += 1;
    else if (source === 'dashboard') sources.dashboard += 1;
    else sources.ci += 1;
  }
  return sources;
}

/**
 * @param {Object[]} events
 * @returns {Set<string>}
 */
function collectDistinctWorkspaces(events) {
  const workspaces = new Set();
  for (const ev of events) {
    if (ev.workspace_fingerprint) workspaces.add(String(ev.workspace_fingerprint));
    else if (ev.repository) workspaces.add(String(ev.repository));
  }
  return workspaces;
}

/**
 * @param {string} orgKey
 * @param {{ days?: number, minWorkspaces?: number }} [options]
 */
function summarizeTeamTelemetry(orgKey, options = {}) {
  const days = Number(options.days) || 7;
  const minWorkspaces = Number(options.minWorkspaces) || K_ANONYMITY_MIN_WORKSPACES;
  const events = filterOrgEvents(orgKey, days);
  const workspaces = collectDistinctWorkspaces(events);

  let gatesTripped = 0;
  let criticalsBlocked = 0;
  let gatePassCount = 0;

  for (const ev of events) {
    if (ev.gate_pass === false || (ev.gates_tripped || 0) > 0) gatesTripped += 1;
    if (ev.gate_pass === true) gatePassCount += 1;
    criticalsBlocked += Number(ev.critical_blocked || 0);
  }

  const totalScans = events.length;
  const gatePassRate = totalScans > 0
    ? Math.round((gatePassCount / totalScans) * 1000) / 1000
    : 0;

  const kAnonymityMet = workspaces.size >= minWorkspaces;
  const summary = {
    periodDays: days,
    total_scans: totalScans,
    gates_tripped: gatesTripped,
    criticals_blocked: criticalsBlocked,
    gate_pass_rate: gatePassRate,
    quality_distribution: computeQualityDistribution(events),
    severity_totals: aggregateSeverityTotals(events),
    scan_sources: aggregateScanSources(events),
    distinct_workspaces: workspaces.size,
    k_anonymity_met: kAnonymityMet
  };

  if (kAnonymityMet) {
    summary.workspace_breakdown = [...workspaces].sort().map((fingerprint) => ({
      workspace_fingerprint: fingerprint,
      scan_count: events.filter((ev) => (
        ev.workspace_fingerprint === fingerprint
        || (!ev.workspace_fingerprint && ev.repository === fingerprint)
      )).length
    }));
  }

  return summary;
}

/**
 * @param {string} orgKey
 * @param {{ days?: number, granularity?: 'day' }} [options]
 * @returns {Array<{ date: string, scan_count: number, gate_pass_count: number, gate_pass_rate: number }>}
 */
function getTeamTrend(orgKey, options = {}) {
  const days = Number(options.days) || 7;
  const granularity = options.granularity === 'day' ? 'day' : 'day';
  if (granularity !== 'day') {
    throw new Error('Only day granularity is supported');
  }

  const events = filterOrgEvents(orgKey, days);
  const buckets = new Map();

  for (const ev of events) {
    const ts = Date.parse(ev.recordedAt || ev.timestamp || '');
    if (!Number.isFinite(ts)) continue;
    const date = new Date(ts).toISOString().slice(0, 10);
    const bucket = buckets.get(date) || { scan_count: 0, gate_pass_count: 0 };
    bucket.scan_count += 1;
    if (ev.gate_pass === true) bucket.gate_pass_count += 1;
    buckets.set(date, bucket);
  }

  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const trend = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(end.getTime() - (offset * 24 * 60 * 60 * 1000));
    const date = day.toISOString().slice(0, 10);
    const bucket = buckets.get(date) || { scan_count: 0, gate_pass_count: 0 };
    const gatePassRate = bucket.scan_count > 0
      ? Math.round((bucket.gate_pass_count / bucket.scan_count) * 1000) / 1000
      : 0;
    trend.push({
      date,
      scan_count: bucket.scan_count,
      gate_pass_count: bucket.gate_pass_count,
      gate_pass_rate: gatePassRate
    });
  }

  return trend;
}

/**
 * @param {string} orgKey
 * @param {{ days?: number }} [options]
 */
function getQualityDistribution(orgKey, options = {}) {
  const days = Number(options.days) || 7;
  return computeQualityDistribution(filterOrgEvents(orgKey, days));
}

module.exports = {
  recordCiTelemetryEvent,
  summarizeCiTelemetry,
  summarizeTeamTelemetry,
  getTeamTrend,
  getQualityDistribution,
  sanitizeTeamTelemetryPayload,
  hashWorkspaceFingerprint,
  resolveOrgKey,
  accountKey,
  percentileLinear,
  computeQualityDistribution,
  TEAM_TELEMETRY_RETENTION_DAYS,
  K_ANONYMITY_MIN_WORKSPACES,
  TEAM_TELEMETRY_ALLOWED_FIELDS,
  TEAM_TELEMETRY_FORBIDDEN_FIELDS
};
