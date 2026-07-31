'use strict';

/**
 * Usage Analytics Store — Persistent store for scan metrics, violation
 * trends, file volume tracking, and compliance posture scores across
 * enterprise tenants.
 *
 * @module usage-analytics-store
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../lib/app-logger.cjs');

const STORE_PATH =
  process.env.USAGE_ANALYTICS_STORE_PATH ||
  path.join(__dirname, '../../.simplebeacon', 'usage-analytics.json');

let _cache = null;
let _cacheDirty = true;

function readStore() {
  if (_cache && !_cacheDirty) return _cache;
  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    _cache = JSON.parse(raw);
  } catch {
    _cache = { scans: [], orgs: {}, aggregated: {} };
  }
  _cacheDirty = false;
  return _cache;
}

function writeStore(store) {
  const dir = path.dirname(STORE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = STORE_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, STORE_PATH);
  _cache = store;
  _cacheDirty = false;
}

// ── Scan Record Management ──────────────────────────────────────────────────

/**
 * Record a completed scan with its metrics.
 * @param {object} params
 * @param {string} params.orgId - Organization ID
 * @param {string} params.scanId - Unique scan ID (auto-generated if absent)
 * @param {string} params.projectPath - Scanned project path
 * @param {object} params.summary - Scan summary from report.json
 * @param {number} params.summary.codeFilesAnalyzed
 * @param {number} params.summary.totalFindings
 * @param {object} params.summary.severityCounts
 * @param {object} [params.categoryCounts] - Findings by category
 * @param {object} [params.languageBreakdown] - Files by language
 * @param {number} [params.scanDurationMs] - Scan duration
 * @param {string} [params.gateStatus] - pass/fail
 * @param {string} [params.repository] - Repository name
 * @param {string} [params.branch] - Branch name
 * @param {string} [params.commitSha] - Commit SHA
 * @param {string} [params.triggeredBy] - User or CI that triggered
 * @returns {object} The recorded scan entry
 */
function recordScan(params) {
  const store = readStore();
  const scanId = params.scanId || `scan-${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date().toISOString();

  const severityCounts = params.summary?.severityCounts || {};
  const totalFindings = params.summary?.totalFindings || 0;
  const criticalCount = severityCounts.critical || 0;
  const highCount = severityCounts.high || 0;
  const mediumCount = severityCounts.medium || 0;
  const lowCount = severityCounts.low || 0;

  const postureScore = calculatePostureScore(
    totalFindings,
    criticalCount,
    highCount,
    mediumCount,
    lowCount
  );

  const entry = {
    scanId,
    orgId: params.orgId || 'unknown',
    timestamp: now,
    projectPath: params.projectPath || '',
    repository: params.repository || null,
    branch: params.branch || null,
    commitSha: params.commitSha || null,
    triggeredBy: params.triggeredBy || null,
    codeFilesAnalyzed: params.summary?.codeFilesAnalyzed || 0,
    totalFindings,
    severityCounts: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
      info: severityCounts.info || 0,
    },
    categoryCounts: params.categoryCounts || {},
    languageBreakdown: params.languageBreakdown || {},
    scanDurationMs: params.scanDurationMs || null,
    gateStatus: params.gateStatus || null,
    postureScore,
  };

  store.scans.push(entry);
  if (store.scans.length > 10000) {
    store.scans = store.scans.slice(-10000);
  }

  updateOrgAggregate(store, entry);
  writeStore(store);

  logger.info(
    `[Analytics] Recorded scan ${scanId} for org ${entry.orgId} — ${totalFindings} findings, posture ${postureScore}`
  );
  return entry;
}

// ── Posture Score Calculation ───────────────────────────────────────────────

function calculatePostureScore(totalFindings, critical, high, medium, low) {
  if (totalFindings === 0) return 100;
  const weighted = critical * 25 + high * 10 + medium * 3 + low * 1;
  const rawScore = 100 - (weighted / Math.max(totalFindings, 1)) * 50;
  return Math.max(0, Math.min(100, Math.round(rawScore)));
}

// ── Per-Org Aggregation ─────────────────────────────────────────────────────

function updateOrgAggregate(store, entry) {
  if (!store.orgs[entry.orgId]) {
    store.orgs[entry.orgId] = {
      totalScans: 0,
      totalFilesAnalyzed: 0,
      totalFindings: 0,
      severityTotals: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      postureScores: [],
      lastScanAt: null,
      firstScanAt: null,
      repositories: {},
    };
  }

  const org = store.orgs[entry.orgId];
  org.totalScans++;
  org.totalFilesAnalyzed += entry.codeFilesAnalyzed;
  org.totalFindings += entry.totalFindings;
  org.severityTotals.critical += entry.severityCounts.critical;
  org.severityTotals.high += entry.severityCounts.high;
  org.severityTotals.medium += entry.severityCounts.medium;
  org.severityTotals.low += entry.severityCounts.low;
  org.severityTotals.info += entry.severityCounts.info;
  org.postureScores.push(entry.postureScore);
  if (org.postureScores.length > 100) org.postureScores = org.postureScores.slice(-100);
  org.lastScanAt = entry.timestamp;
  if (!org.firstScanAt) org.firstScanAt = entry.timestamp;

  if (entry.repository) {
    if (!org.repositories[entry.repository]) {
      org.repositories[entry.repository] = { scans: 0, findings: 0, lastScanAt: null };
    }
    org.repositories[entry.repository].scans++;
    org.repositories[entry.repository].findings += entry.totalFindings;
    org.repositories[entry.repository].lastScanAt = entry.timestamp;
  }
}

// ── Query Functions ─────────────────────────────────────────────────────────

function getScans(filters = {}) {
  const store = readStore();
  let scans = store.scans;

  if (filters.orgId) scans = scans.filter((s) => s.orgId === filters.orgId);
  if (filters.startDate) scans = scans.filter((s) => s.timestamp >= filters.startDate);
  if (filters.endDate) scans = scans.filter((s) => s.timestamp <= filters.endDate);
  if (filters.repository) scans = scans.filter((s) => s.repository === filters.repository);

  const limit = filters.limit || 100;
  const offset = filters.offset || 0;
  const total = scans.length;
  scans = scans.slice(offset, offset + limit);

  return { scans, total, limit, offset };
}

function getOrgSummary(orgId) {
  const store = readStore();
  const org = store.orgs[orgId];
  if (!org) return null;

  const avgPosture =
    org.postureScores.length > 0
      ? Math.round(org.postureScores.reduce((a, b) => a + b, 0) / org.postureScores.length)
      : 0;
  const latestPosture =
    org.postureScores.length > 0 ? org.postureScores[org.postureScores.length - 1] : 0;
  const postureTrend =
    org.postureScores.length >= 2
      ? org.postureScores[org.postureScores.length - 1] -
        org.postureScores[org.postureScores.length - 2]
      : 0;

  return {
    orgId,
    totalScans: org.totalScans,
    totalFilesAnalyzed: org.totalFilesAnalyzed,
    totalFindings: org.totalFindings,
    severityTotals: org.severityTotals,
    avgPostureScore: avgPosture,
    latestPostureScore: latestPosture,
    postureTrend,
    firstScanAt: org.firstScanAt,
    lastScanAt: org.lastScanAt,
    repositories: Object.entries(org.repositories).map(([name, data]) => ({
      name,
      scans: data.scans,
      findings: data.findings,
      lastScanAt: data.lastScanAt,
    })),
  };
}

function getGlobalStats(filters = {}) {
  const store = readStore();
  const orgIds = Object.keys(store.orgs);
  let allScans = store.scans;

  if (filters.orgId) allScans = allScans.filter((s) => s.orgId === filters.orgId);
  if (filters.repository) allScans = allScans.filter((s) => s.repository === filters.repository);
  if (filters.branch) allScans = allScans.filter((s) => s.branch === filters.branch);
  if (filters.startDate) allScans = allScans.filter((s) => s.timestamp >= filters.startDate);
  if (filters.endDate) allScans = allScans.filter((s) => s.timestamp <= filters.endDate);

  const totalScans = allScans.length;
  const totalFiles = allScans.reduce((sum, s) => sum + s.codeFilesAnalyzed, 0);
  const totalFindings = allScans.reduce((sum, s) => sum + s.totalFindings, 0);

  const severityTotals = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const s of allScans) {
    for (const key of Object.keys(severityTotals)) {
      severityTotals[key] += s.severityCounts[key] || 0;
    }
  }

  const postureScores = allScans.map((s) => s.postureScore).filter((v) => v != null);
  const avgPosture =
    postureScores.length > 0
      ? Math.round(postureScores.reduce((a, b) => a + b, 0) / postureScores.length)
      : 0;

  const languageBreakdown = {};
  for (const s of allScans) {
    for (const [lang, count] of Object.entries(s.languageBreakdown || {})) {
      languageBreakdown[lang] = (languageBreakdown[lang] || 0) + count;
    }
  }

  const categoryBreakdown = {};
  for (const s of allScans) {
    for (const [cat, count] of Object.entries(s.categoryCounts || {})) {
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + count;
    }
  }

  return {
    totalOrgs: orgIds.length,
    totalScans,
    totalFilesAnalyzed: totalFiles,
    totalFindings,
    severityTotals,
    avgPostureScore: avgPosture,
    languageBreakdown,
    categoryBreakdown,
    orgIds,
  };
}

function getTrendData(filters = {}) {
  const store = readStore();
  let scans = store.scans;

  if (filters.orgId) scans = scans.filter((s) => s.orgId === filters.orgId);
  if (filters.repository) scans = scans.filter((s) => s.repository === filters.repository);
  if (filters.branch) scans = scans.filter((s) => s.branch === filters.branch);
  if (filters.startDate) scans = scans.filter((s) => s.timestamp >= filters.startDate);
  if (filters.endDate) scans = scans.filter((s) => s.timestamp <= filters.endDate);

  const granularity = filters.granularity || 'day';
  const buckets = {};

  for (const scan of scans) {
    const date = new Date(scan.timestamp);
    let key;
    if (granularity === 'hour') {
      key = date.toISOString().slice(0, 13) + ':00:00Z';
    } else if (granularity === 'day') {
      key = date.toISOString().slice(0, 10);
    } else if (granularity === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().slice(0, 10);
    } else if (granularity === 'month') {
      key = date.toISOString().slice(0, 7);
    } else {
      key = date.toISOString().slice(0, 10);
    }

    if (!buckets[key]) {
      buckets[key] = {
        period: key,
        scans: 0,
        filesAnalyzed: 0,
        totalFindings: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        postureScores: [],
      };
    }

    const b = buckets[key];
    b.scans++;
    b.filesAnalyzed += scan.codeFilesAnalyzed;
    b.totalFindings += scan.totalFindings;
    b.critical += scan.severityCounts.critical || 0;
    b.high += scan.severityCounts.high || 0;
    b.medium += scan.severityCounts.medium || 0;
    b.low += scan.severityCounts.low || 0;
    b.postureScores.push(scan.postureScore);
  }

  const trend = Object.values(buckets).sort((a, b) => a.period.localeCompare(b.period));
  for (const t of trend) {
    t.avgPosture =
      t.postureScores.length > 0
        ? Math.round(t.postureScores.reduce((a, b) => a + b, 0) / t.postureScores.length)
        : 0;
    delete t.postureScores;
  }

  return trend;
}

function getViolationHeatmap(filters = {}) {
  const store = readStore();
  let scans = store.scans;

  if (filters.orgId) scans = scans.filter((s) => s.orgId === filters.orgId);
  if (filters.repository) scans = scans.filter((s) => s.repository === filters.repository);
  if (filters.branch) scans = scans.filter((s) => s.branch === filters.branch);
  if (filters.startDate) scans = scans.filter((s) => s.timestamp >= filters.startDate);

  const heatmap = {};
  for (const scan of scans) {
    for (const [category, count] of Object.entries(scan.categoryCounts || {})) {
      if (!heatmap[category]) heatmap[category] = { category, totalFindings: 0, scanCount: 0 };
      heatmap[category].totalFindings += count;
      heatmap[category].scanCount++;
    }
  }

  return Object.values(heatmap).sort((a, b) => b.totalFindings - a.totalFindings);
}

function getTopRepositories(orgId, limit = 10) {
  const store = readStore();
  if (orgId) {
    const org = store.orgs[orgId];
    if (!org) return [];
    return Object.entries(org.repositories)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.scans - a.scans)
      .slice(0, limit);
  }

  const repos = {};
  for (const scan of store.scans) {
    if (!scan.repository) continue;
    if (!repos[scan.repository])
      repos[scan.repository] = { name: scan.repository, scans: 0, findings: 0 };
    repos[scan.repository].scans++;
    repos[scan.repository].findings += scan.totalFindings;
  }
  return Object.values(repos)
    .sort((a, b) => b.scans - a.scans)
    .slice(0, limit);
}

function getDistinctRepositories(orgId) {
  const store = readStore();
  let scans = store.scans;
  if (orgId) scans = scans.filter((s) => s.orgId === orgId);
  const repos = [...new Set(scans.map((s) => s.repository).filter(Boolean))];
  return repos.sort();
}

function getDistinctBranches(orgId, repository) {
  const store = readStore();
  let scans = store.scans;
  if (orgId) scans = scans.filter((s) => s.orgId === orgId);
  if (repository) scans = scans.filter((s) => s.repository === repository);
  const branches = [...new Set(scans.map((s) => s.branch).filter(Boolean))];
  return branches.sort();
}

module.exports = {
  recordScan,
  getScans,
  getOrgSummary,
  getGlobalStats,
  getTrendData,
  getViolationHeatmap,
  getTopRepositories,
  getDistinctRepositories,
  getDistinctBranches,
  calculatePostureScore,
};
