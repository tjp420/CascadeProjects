/**
 * Repository health page export bundle — browser mirror of server/lib/repository-health-export.js
 */
import {
  redactProjectPathForExport,
  normalizeSimpleBeaconBranding,
} from './quality-export.browser.js?v=20260716cachefix1';
/**
 * Dedupe export notes.
 * @param {Array} notes
 * @returns {any}
 */
function dedupeExportNotes(notes = []) {
  return [...new Set(notes.filter(Boolean))].slice(0, 8);
}
/**
 * Dedupe disclaimers.
 * @param {Array} notes
 * @returns {any}
 */
function dedupeDisclaimers(notes = []) {
  const seen = new Set();
  const out = [];
  for (const note of notes) {
    const normalized = String(note).replace(/\s+/g, ' ').trim().toLowerCase();
    const key = /security gate|gate results/i.test(normalized)
      ? 'not-gate-results'
      : /github-cache|audit inventory|benchmark clones/i.test(normalized)
        ? 'audit-inventory-scope'
        : /potential savings|opportunities — review/i.test(normalized)
          ? 'savings-opportunities'
          : /merge candidates|preview/i.test(normalized)
            ? 'merge-advisory'
            : /redacted to project label/i.test(normalized)
              ? 'path-redaction'
              : normalized;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(String(note).trim());
  }
  return out;
}
/**
 * Redact snapshot path.
 * @param {any} value
 * @param {any} defaultLabel
 * @returns {any}
 */
function redactSnapshotPath(value, defaultLabel = 'ai-platform') {
  if (value == null || value === '') return null;
  const normalized = String(value).replace(/\\/g, '/');
  if (/ai-platform/i.test(normalized)) return 'ai-platform';
  if (/cascadeprojects/i.test(normalized) && !/ai-platform/i.test(normalized))
    return 'CascadeProjects';
  if (
    /^[a-zA-Z]:\//.test(normalized) ||
    normalized.startsWith('/Users/') ||
    normalized.startsWith('/home/') ||
    normalized.includes('CascadeProjects')
  ) {
    return redactProjectPathForExport(normalized, defaultLabel);
  }
  if (normalized.startsWith('…/')) {
    const tail = normalized.slice(2);
    if (/ai-platform/i.test(tail)) return 'ai-platform';
    if (/cascadeprojects/i.test(tail)) return 'CascadeProjects';
    const parts = tail.split('/').filter(Boolean);
    return parts[parts.length - 1] || defaultLabel;
  }
  return normalized;
}
/**
 * Resolve headline metric.
 * @param {any} headline
 * @param {any} platform
 * @param {any} key
 * @returns {any}
 */
function resolveHeadlineMetric(headline, platform, key) {
  var _a, _b;
  return (_b = (_a = headline[key]) !== null && _a !== void 0 ? _a : platform[key]) !== null &&
    _b !== void 0
    ? _b
    : null;
}
/**
 * Headline monorepo metrics diverge.
 * @param {any} headline
 * @param {any} platform
 * @param {any} monorepo
 * @returns {any}
 */
function headlineMonorepoMetricsDiverge(headline, platform, monorepo) {
  if (!(monorepo === null || monorepo === void 0 ? void 0 : monorepo.generatedAt)) return false;
  const pairs = [
    ['repositoryHealthScore', resolveHeadlineMetric(headline, platform, 'repositoryHealthScore')],
    ['duplicateGroups', resolveHeadlineMetric(headline, platform, 'duplicateGroups')],
    ['mergeCandidates', resolveHeadlineMetric(headline, platform, 'mergeCandidates')],
    [
      'optimizationPotentialBytes',
      resolveHeadlineMetric(headline, platform, 'optimizationPotentialBytes'),
    ],
    ['reductionOpportunities', resolveHeadlineMetric(headline, platform, 'reductionOpportunities')],
  ];
  return pairs.some(
    ([key, headlineVal]) =>
      headlineVal != null && monorepo[key] != null && headlineVal !== monorepo[key]
  );
}
/**
 * Build repository health summary.
 * @param {any} health
 * @param {Object} options
 * @param {any} preview }
 * @returns {any}
 */
export function buildRepositoryHealthSummary(health = {}, { candidates, preview } = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
  const headline = health.headline || {};
  const platform = health.platform || {};
  const monorepo = health.monorepo || {};
  const hasMonorepo = Boolean(
    monorepo === null || monorepo === void 0 ? void 0 : monorepo.generatedAt
  );
  let scanFreshnessNote = null;
  if (
    platform.generatedAt &&
    monorepo.generatedAt &&
    platform.generatedAt !== monorepo.generatedAt
  ) {
    scanFreshnessNote = `Platform consolidation scan ${platform.generatedAt}; monorepo scan ${monorepo.generatedAt}.`;
  }
  const headlineScopeNote = headlineMonorepoMetricsDiverge(headline, platform, monorepo)
    ? 'Headline metrics reflect the platform (ai-platform) consolidation report; monorepo scope may differ — see platform and monorepo sections.'
    : null;
  return {
    repositoryHealthScore: resolveHeadlineMetric(headline, platform, 'repositoryHealthScore'),
    platformHealthScore:
      (_a = platform.repositoryHealthScore) !== null && _a !== void 0 ? _a : null,
    monorepoHealthScore: hasMonorepo
      ? (_b = monorepo.repositoryHealthScore) !== null && _b !== void 0
        ? _b
        : null
      : null,
    optimizationPotential: resolveHeadlineMetric(headline, platform, 'optimizationPotential'),
    optimizationPotentialBytes: resolveHeadlineMetric(
      headline,
      platform,
      'optimizationPotentialBytes'
    ),
    duplicateGroups: resolveHeadlineMetric(headline, platform, 'duplicateGroups'),
    oversizedFiles: resolveHeadlineMetric(headline, platform, 'oversizedFiles'),
    reductionOpportunities: resolveHeadlineMetric(headline, platform, 'reductionOpportunities'),
    mergeCandidates: resolveHeadlineMetric(headline, platform, 'mergeCandidates'),
    repositoryFilesTotal: resolveHeadlineMetric(headline, platform, 'repositoryFilesTotal'),
    repositoryFoldersTotal: resolveHeadlineMetric(headline, platform, 'repositoryFoldersTotal'),
    monorepoDuplicateGroups: hasMonorepo
      ? (_c = monorepo.duplicateGroups) !== null && _c !== void 0
        ? _c
        : null
      : null,
    monorepoMergeCandidates: hasMonorepo
      ? (_d = monorepo.mergeCandidates) !== null && _d !== void 0
        ? _d
        : null
      : null,
    platformLastScan: (_e = platform.generatedAt) !== null && _e !== void 0 ? _e : null,
    monorepoLastScan: hasMonorepo
      ? (_f = monorepo.generatedAt) !== null && _f !== void 0
        ? _f
        : null
      : null,
    lastScan:
      (_j =
        (_h = (_g = headline.lastScan) !== null && _g !== void 0 ? _g : platform.generatedAt) !==
          null && _h !== void 0
          ? _h
          : monorepo.generatedAt) !== null && _j !== void 0
        ? _j
        : null,
    headlineScopeNote,
    scanFreshnessNote,
    mergeCandidateCount: Array.isArray(candidates) ? candidates.length : 0,
    mergePreviewAvailable: Boolean(preview),
    staticHost: Boolean(health.staticHost),
    monorepoReportStatus:
      (_k = health.monorepoStatus) !== null && _k !== void 0 ? _k : hasMonorepo ? 'loaded' : null,
  };
}
/**
 * Sanitize snapshot export.
 * @param {any} snapshot
 * @returns {any}
 */
function sanitizeSnapshotExport(snapshot) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
  if (!snapshot) return null;
  return {
    label: (_a = snapshot.label) !== null && _a !== void 0 ? _a : null,
    projectRoot: redactSnapshotPath(snapshot.projectRoot),
    platformRoot: snapshot.platformRoot ? redactSnapshotPath(snapshot.platformRoot) : null,
    generatedAt: (_b = snapshot.generatedAt) !== null && _b !== void 0 ? _b : null,
    reportVersion: (_c = snapshot.reportVersion) !== null && _c !== void 0 ? _c : null,
    repositoryHealthScore:
      (_d = snapshot.repositoryHealthScore) !== null && _d !== void 0 ? _d : null,
    optimizationPotential:
      (_e = snapshot.optimizationPotential) !== null && _e !== void 0 ? _e : null,
    optimizationPotentialBytes:
      (_f = snapshot.optimizationPotentialBytes) !== null && _f !== void 0 ? _f : null,
    duplicateGroups: (_g = snapshot.duplicateGroups) !== null && _g !== void 0 ? _g : null,
    mergeCandidates: (_h = snapshot.mergeCandidates) !== null && _h !== void 0 ? _h : null,
    oversizedFiles: (_j = snapshot.oversizedFiles) !== null && _j !== void 0 ? _j : null,
    reductionOpportunities:
      (_k = snapshot.reductionOpportunities) !== null && _k !== void 0 ? _k : null,
    repositoryFilesTotal:
      (_l = snapshot.repositoryFilesTotal) !== null && _l !== void 0 ? _l : null,
    repositoryFoldersTotal:
      (_m = snapshot.repositoryFoldersTotal) !== null && _m !== void 0 ? _m : null,
    repositoryFilesAudited:
      (_o = snapshot.repositoryFilesAudited) !== null && _o !== void 0 ? _o : null,
    jsonFilesAnalyzed: (_p = snapshot.jsonFilesAnalyzed) !== null && _p !== void 0 ? _p : null,
    scopeNote: (_q = snapshot.scopeNote) !== null && _q !== void 0 ? _q : null,
    provenance: 'consolidation-report',
  };
}
/**
 * Sanitize recommendations export.
 * @param {Array} recommendations
 * @returns {any}
 */
function sanitizeRecommendationsExport(recommendations = []) {
  if (!Array.isArray(recommendations) || !recommendations.length) return [];
  return recommendations.map((item) => {
    var _a, _b, _c, _d, _e, _f;
    return {
      priority: (_a = item.priority) !== null && _a !== void 0 ? _a : null,
      action: (_b = item.action) !== null && _b !== void 0 ? _b : null,
      savings: (_c = item.savings) !== null && _c !== void 0 ? _c : null,
      effort: (_d = item.effort) !== null && _d !== void 0 ? _d : null,
      risk: (_e = item.risk) !== null && _e !== void 0 ? _e : null,
      description: normalizeSimpleBeaconBranding(
        (_f = item.description) !== null && _f !== void 0 ? _f : null
      ),
    };
  });
}
/**
 * Sanitize candidates export.
 * @param {Array} candidates
 * @returns {any}
 */
function sanitizeCandidatesExport(candidates = []) {
  if (!Array.isArray(candidates) || !candidates.length) return [];
  return candidates.map((item) => {
    var _a, _b, _c, _d;
    return {
      id: (_a = item.id) !== null && _a !== void 0 ? _a : null,
      mergeType: (_b = item.mergeType) !== null && _b !== void 0 ? _b : null,
      savingsLabel: (_c = item.savingsLabel) !== null && _c !== void 0 ? _c : null,
      savingsBytes: (_d = item.savingsBytes) !== null && _d !== void 0 ? _d : null,
      files: Array.isArray(item.files)
        ? item.files.map((f) => {
            var _a, _b;
            return {
              path: (_a = f.path) !== null && _a !== void 0 ? _a : null,
              sizeLabel: (_b = f.sizeLabel) !== null && _b !== void 0 ? _b : null,
            };
          })
        : [],
    };
  });
}
/**
 * Sanitize preview export.
 * @param {any} preview
 * @returns {any}
 */
function sanitizePreviewExport(preview) {
  var _a, _b, _c, _d, _e, _f, _g;
  if (!preview) return null;
  return {
    keepFile: (_a = preview.keepFile) !== null && _a !== void 0 ? _a : null,
    removeFiles: (_b = preview.removeFiles) !== null && _b !== void 0 ? _b : [],
    conflicts: (_c = preview.conflicts) !== null && _c !== void 0 ? _c : [],
    safeToExecute: (_d = preview.safeToExecute) !== null && _d !== void 0 ? _d : null,
    executionMode: (_e = preview.executionMode) !== null && _e !== void 0 ? _e : null,
    riskAssessment: preview.riskAssessment
      ? {
          level: (_f = preview.riskAssessment.level) !== null && _f !== void 0 ? _f : null,
          factors: (_g = preview.riskAssessment.factors) !== null && _g !== void 0 ? _g : [],
        }
      : null,
  };
}
/**
 * Build export provenance.
 * @param {any} health
 * @param {Object} options
 * @param {any} preview
 * @param {string} candidatesScope }
 * @returns {any}
 */
function buildExportProvenance(health = {}, { candidates, preview, candidatesScope } = {}) {
  var _a, _b, _c, _d;
  let mergeCandidatesProvenance = 'missing';
  if (Array.isArray(candidates) && candidates.length) {
    mergeCandidatesProvenance =
      candidatesScope === 'monorepo'
        ? 'monorepo-consolidation-report'
        : 'platform-consolidation-report';
  } else if (
    ((_b = (_a = health.monorepo) === null || _a === void 0 ? void 0 : _a.mergeCandidates) !==
      null && _b !== void 0
      ? _b
      : 0) > 0 ||
    ((_d = (_c = health.platform) === null || _c === void 0 ? void 0 : _c.mergeCandidates) !==
      null && _d !== void 0
      ? _d
      : 0) > 0
  ) {
    mergeCandidatesProvenance = 'consolidation-report-count-only';
  }
  return {
    health: health.staticHost
      ? 'static-fallback'
      : health.headline
        ? 'live-consolidation-scan'
        : 'missing',
    platform: health.platform ? 'consolidation-report' : 'missing',
    monorepo: health.monorepo ? 'consolidation-report' : 'missing',
    mergeCandidates: mergeCandidatesProvenance,
    mergePreview: preview ? 'live-merge-preview' : 'missing',
    candidatesScope:
      Array.isArray(candidates) && candidates.length && candidatesScope ? candidatesScope : null,
  };
}
/**
 * Build export notes.
 * @param {any} health
 * @param {any} summary
 * @param {Object} options
 * @param {string} candidatesScope
 * @param {any} preview }
 * @returns {any}
 */
function buildExportNotes(
  health = {},
  summary = {},
  { candidates, candidatesScope, preview } = {}
) {
  var _a;
  const monorepo = (health === null || health === void 0 ? void 0 : health.monorepo) || {};
  const platform = (health === null || health === void 0 ? void 0 : health.platform) || {};
  const notes = [];
  if (summary.headlineScopeNote) {
    notes.push(summary.headlineScopeNote);
  }
  if (summary.scanFreshnessNote) {
    notes.push(summary.scanFreshnessNote);
  }
  if (
    ((_a = monorepo.mergeCandidates) !== null && _a !== void 0 ? _a : 0) > 0 &&
    (!Array.isArray(candidates) || !candidates.length)
  ) {
    notes.push(
      `Monorepo consolidation report lists ${monorepo.mergeCandidates} merge candidate(s) but no detail rows were attached — reload the page before export or use candidates?scope=monorepo.`
    );
  }
  if (Array.isArray(candidates) && candidates.length && candidatesScope === 'monorepo') {
    notes.push(
      'Merge candidate detail rows sourced from monorepo (CascadeProjects) consolidation report.'
    );
  }
  if (preview) {
    notes.push(
      'Merge preview included from active dashboard session — advisory only; confirm before executing.'
    );
  }
  if (
    (health.recommendations || []).length &&
    !(platform.recommendations || []).length &&
    (monorepo.recommendations || []).length
  ) {
    notes.push(
      'Recommendations sourced from monorepo consolidation report because platform scan had none.'
    );
  }
  if (health.monorepoStatus === 'platform-scoped-copy') {
    notes.push(
      'Monorepo consolidation snapshot omitted — parent .simplebeacon/consolidation-report.json matches platform scope. Run consolidation scan from the monorepo root to refresh distinct monorepo metrics.'
    );
  } else if (!health.monorepo && health.platform && health.monorepoStatus === 'missing') {
    notes.push(
      'Export reflects platform (ai-platform) consolidation scan only — no distinct monorepo snapshot loaded.'
    );
  }
  notes.push(
    'Repository health export — consolidation metrics only, not SimpleBeacon vendor handoff clearance.'
  );
  return dedupeExportNotes(notes.map((line) => normalizeSimpleBeaconBranding(line)));
}
/**
 * Build export disclaimers.
 * @param {any} health
 * @returns {any}
 */
function buildExportDisclaimers(health = {}) {
  /**
   * From health.
   * @param {any} health.disclaimers || []
   * @returns {any}
   */
  const fromHealth = (health.disclaimers || []).filter((note) => {
    const text = String(note).toLowerCase();
    return !/merge candidates and previews are advisory/i.test(text);
  });
  return dedupeDisclaimers([
    ...fromHealth,
    'Repository health reflects duplicate detection and oversized-file analysis — not security gate results.',
    'Merge candidates and previews are advisory; confirm before executing any merge.',
    'Absolute host paths are redacted to project labels in exports.',
  ]);
}
export function buildRepositoryHealthExportBundle({
  health,
  candidates,
  preview,
  candidatesProjectPath,
  candidatesScope,
} = {}) {
  const sanitizedPlatform = sanitizeSnapshotExport(
    health === null || health === void 0 ? void 0 : health.platform
  );
  const sanitizedMonorepo = sanitizeSnapshotExport(
    health === null || health === void 0 ? void 0 : health.monorepo
  );
  const summary = buildRepositoryHealthSummary(health || {}, { candidates, preview });
  const sanitizedCandidates = sanitizeCandidatesExport(candidates);
  const sanitizedPreview = sanitizePreviewExport(preview);
  const sanitizedRecommendations = sanitizeRecommendationsExport(
    health === null || health === void 0 ? void 0 : health.recommendations
  );
  const redactedCandidatesPath = candidatesProjectPath
    ? redactProjectPathForExport(
        candidatesProjectPath,
        candidatesScope === 'monorepo' ? 'CascadeProjects' : 'ai-platform'
      )
    : null;
  const exportNotes = buildExportNotes(health || {}, summary, {
    candidates,
    candidatesScope,
    preview,
  });
  return {
    type: 'simplebeacon-repository-health-export',
    version: '1.1.0',
    generatedBy: 'SimpleBeacon',
    title: 'SimpleBeacon Repository Health Export',
    generatedAt: new Date().toISOString(),
    summary,
    platform: sanitizedPlatform,
    monorepo: sanitizedMonorepo,
    recommendations: sanitizedRecommendations,
    ...(sanitizedCandidates.length ? { mergeCandidates: sanitizedCandidates } : {}),
    ...(sanitizedPreview ? { mergePreview: sanitizedPreview } : {}),
    ...(sanitizedCandidates.length && redactedCandidatesPath
      ? { candidatesProjectPath: redactedCandidatesPath }
      : {}),
    ...(sanitizedCandidates.length && candidatesScope ? { candidatesScope } : {}),
    provenance: buildExportProvenance(health || {}, { candidates, preview, candidatesScope }),
    exportNotes,
    exportSanitized: true,
    handoffEligible: false,
    disclaimers: buildExportDisclaimers(health || {}),
  };
}
/**
 * Csv escape.
 * @param {any} cell
 * @returns {any}
 */
function csvEscape(cell) {
  return `"${String(cell !== null && cell !== void 0 ? cell : '').replace(/"/g, '""')}"`;
}
/**
 * Build repository health summary csv.
 * @param {any} summary
 * @returns {any}
 */
function buildRepositoryHealthSummaryCsv(summary) {
  if (!summary) return null;
  const header = ['metric', 'value'];
  const rows = Object.entries(summary).map(([key, value]) =>
    [key, value == null ? '' : String(value)].map(csvEscape).join(',')
  );
  return [header.join(','), ...rows].join('\n');
}
/**
 * Build recommendations csv.
 * @param {Array} recommendations
 * @returns {any}
 */
function buildRecommendationsCsv(recommendations = []) {
  if (!recommendations.length) return null;
  const header = ['priority', 'action', 'savings', 'effort', 'risk', 'description'];
  const rows = recommendations.map((item) =>
    [
      item.priority || '',
      item.action || '',
      item.savings || '',
      item.effort || '',
      item.risk || '',
      item.description || '',
    ]
      .map(csvEscape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}
/**
 * Build snapshots csv.
 * @param {any} platform
 * @param {any} monorepo
 * @returns {any}
 */
function buildSnapshotsCsv(platform, monorepo) {
  const snaps = [
    platform ? { scope: 'platform', ...platform } : null,
    monorepo ? { scope: 'monorepo', ...monorepo } : null,
  ].filter(Boolean);
  if (!snaps.length) return null;
  const header = [
    'scope',
    'label',
    'healthScore',
    'optimizationPotential',
    'duplicateGroups',
    'oversizedFiles',
    'repositoryFilesTotal',
    'generatedAt',
  ];
  const rows = snaps.map((snap) => {
    var _a, _b, _c, _d, _e, _f;
    return [
      snap.scope,
      snap.label || '',
      (_a = snap.repositoryHealthScore) !== null && _a !== void 0 ? _a : '',
      (_b = snap.optimizationPotential) !== null && _b !== void 0 ? _b : '',
      (_c = snap.duplicateGroups) !== null && _c !== void 0 ? _c : '',
      (_d = snap.oversizedFiles) !== null && _d !== void 0 ? _d : '',
      (_e = snap.repositoryFilesTotal) !== null && _e !== void 0 ? _e : '',
      (_f = snap.generatedAt) !== null && _f !== void 0 ? _f : '',
    ]
      .map(csvEscape)
      .join(',');
  });
  return [header.join(','), ...rows].join('\n');
}
/**
 * Build repository health csv.
 * @param {Object} options
 * @param {Array} recommendations
 * @param {any} platform
 * @param {any} monorepo }
 * @returns {any}
 */
export function buildRepositoryHealthCsv({ summary, recommendations, platform, monorepo } = {}) {
  const parts = [];
  const summaryCsv = buildRepositoryHealthSummaryCsv(summary);
  const recCsv = buildRecommendationsCsv(recommendations);
  const snapshotsCsv = !recCsv ? buildSnapshotsCsv(platform, monorepo) : null;
  if (summaryCsv) {
    parts.push('Repository health summary');
    parts.push(summaryCsv);
  }
  if (snapshotsCsv) {
    if (parts.length) parts.push('');
    parts.push('Consolidation snapshots');
    parts.push(snapshotsCsv);
  }
  if (recCsv) {
    if (parts.length) parts.push('');
    parts.push('Recommendations');
    parts.push(recCsv);
  }
  return parts.length ? parts.join('\n') : null;
}
/**
 * Repository health export filename.
 * @param {any} ext
 * @returns {any}
 */
export function repositoryHealthExportFilename(ext = 'json') {
  const stamp = new Date().toISOString().slice(0, 10);
  if (ext === 'csv') return `repository-health-metrics-${stamp}.csv`;
  return `repository-health-export-${stamp}.json`;
}
