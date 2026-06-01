/**
 * Repository health page export bundle — browser mirror of server/lib/repository-health-export.js
 */

import { redactProjectPathForExport, normalizeSimpleBeaconBranding } from './quality-export.browser.js?v=20260531qualityexport8';

function dedupeExportNotes(notes = []) {
  return [...new Set(notes.filter(Boolean))].slice(0, 8);
}

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

function redactSnapshotPath(value, defaultLabel = 'ai-platform') {
  if (value == null || value === '') return null;
  const normalized = String(value).replace(/\\/g, '/');
  if (/ai-platform/i.test(normalized)) return 'ai-platform';
  if (/cascadeprojects/i.test(normalized) && !/ai-platform/i.test(normalized)) return 'CascadeProjects';
  if (/^[a-zA-Z]:\//.test(normalized) || normalized.startsWith('/Users/')
    || normalized.startsWith('/home/') || normalized.includes('CascadeProjects')) {
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

function resolveHeadlineMetric(headline, platform, key) {
  return headline[key] ?? platform[key] ?? null;
}

function headlineMonorepoMetricsDiverge(headline, platform, monorepo) {
  if (!monorepo?.generatedAt) return false;
  const pairs = [
    ['repositoryHealthScore', resolveHeadlineMetric(headline, platform, 'repositoryHealthScore')],
    ['duplicateGroups', resolveHeadlineMetric(headline, platform, 'duplicateGroups')],
    ['mergeCandidates', resolveHeadlineMetric(headline, platform, 'mergeCandidates')],
    ['optimizationPotentialBytes', resolveHeadlineMetric(headline, platform, 'optimizationPotentialBytes')],
    ['reductionOpportunities', resolveHeadlineMetric(headline, platform, 'reductionOpportunities')]
  ];
  return pairs.some(([key, headlineVal]) => headlineVal != null
    && monorepo[key] != null
    && headlineVal !== monorepo[key]);
}

export function buildRepositoryHealthSummary(health = {}, { candidates, preview } = {}) {
  const headline = health.headline || {};
  const platform = health.platform || {};
  const monorepo = health.monorepo || {};
  const hasMonorepo = Boolean(monorepo?.generatedAt);

  let scanFreshnessNote = null;
  if (platform.generatedAt && monorepo.generatedAt && platform.generatedAt !== monorepo.generatedAt) {
    scanFreshnessNote = `Platform consolidation scan ${platform.generatedAt}; monorepo scan ${monorepo.generatedAt}.`;
  }

  const headlineScopeNote = headlineMonorepoMetricsDiverge(headline, platform, monorepo)
    ? 'Headline metrics reflect the platform (ai-platform) consolidation report; monorepo scope may differ — see platform and monorepo sections.'
    : null;

  return {
    repositoryHealthScore: resolveHeadlineMetric(headline, platform, 'repositoryHealthScore'),
    platformHealthScore: platform.repositoryHealthScore ?? null,
    monorepoHealthScore: hasMonorepo ? (monorepo.repositoryHealthScore ?? null) : null,
    optimizationPotential: resolveHeadlineMetric(headline, platform, 'optimizationPotential'),
    optimizationPotentialBytes: resolveHeadlineMetric(headline, platform, 'optimizationPotentialBytes'),
    duplicateGroups: resolveHeadlineMetric(headline, platform, 'duplicateGroups'),
    oversizedFiles: resolveHeadlineMetric(headline, platform, 'oversizedFiles'),
    reductionOpportunities: resolveHeadlineMetric(headline, platform, 'reductionOpportunities'),
    mergeCandidates: resolveHeadlineMetric(headline, platform, 'mergeCandidates'),
    repositoryFilesTotal: resolveHeadlineMetric(headline, platform, 'repositoryFilesTotal'),
    repositoryFoldersTotal: resolveHeadlineMetric(headline, platform, 'repositoryFoldersTotal'),
    monorepoDuplicateGroups: hasMonorepo ? (monorepo.duplicateGroups ?? null) : null,
    monorepoMergeCandidates: hasMonorepo ? (monorepo.mergeCandidates ?? null) : null,
    platformLastScan: platform.generatedAt ?? null,
    monorepoLastScan: hasMonorepo ? (monorepo.generatedAt ?? null) : null,
    lastScan: headline.lastScan ?? platform.generatedAt ?? monorepo.generatedAt ?? null,
    headlineScopeNote,
    scanFreshnessNote,
    mergeCandidateCount: Array.isArray(candidates) ? candidates.length : 0,
    mergePreviewAvailable: Boolean(preview),
    staticHost: Boolean(health.staticHost),
    monorepoReportStatus: health.monorepoStatus ?? (hasMonorepo ? 'loaded' : null)
  };
}

function sanitizeSnapshotExport(snapshot) {
  if (!snapshot) return null;
  return {
    label: snapshot.label ?? null,
    projectRoot: redactSnapshotPath(snapshot.projectRoot),
    platformRoot: snapshot.platformRoot ? redactSnapshotPath(snapshot.platformRoot) : null,
    generatedAt: snapshot.generatedAt ?? null,
    reportVersion: snapshot.reportVersion ?? null,
    repositoryHealthScore: snapshot.repositoryHealthScore ?? null,
    optimizationPotential: snapshot.optimizationPotential ?? null,
    optimizationPotentialBytes: snapshot.optimizationPotentialBytes ?? null,
    duplicateGroups: snapshot.duplicateGroups ?? null,
    mergeCandidates: snapshot.mergeCandidates ?? null,
    oversizedFiles: snapshot.oversizedFiles ?? null,
    reductionOpportunities: snapshot.reductionOpportunities ?? null,
    repositoryFilesTotal: snapshot.repositoryFilesTotal ?? null,
    repositoryFoldersTotal: snapshot.repositoryFoldersTotal ?? null,
    repositoryFilesAudited: snapshot.repositoryFilesAudited ?? null,
    jsonFilesAnalyzed: snapshot.jsonFilesAnalyzed ?? null,
    scopeNote: snapshot.scopeNote ?? null,
    provenance: 'consolidation-report'
  };
}

function sanitizeRecommendationsExport(recommendations = []) {
  if (!Array.isArray(recommendations) || !recommendations.length) return [];
  return recommendations.map((item) => ({
    priority: item.priority ?? null,
    action: item.action ?? null,
    savings: item.savings ?? null,
    effort: item.effort ?? null,
    risk: item.risk ?? null,
    description: normalizeSimpleBeaconBranding(item.description ?? null)
  }));
}

function sanitizeCandidatesExport(candidates = []) {
  if (!Array.isArray(candidates) || !candidates.length) return [];
  return candidates.map((item) => ({
    id: item.id ?? null,
    mergeType: item.mergeType ?? null,
    savingsLabel: item.savingsLabel ?? null,
    savingsBytes: item.savingsBytes ?? null,
    files: Array.isArray(item.files)
      ? item.files.map((f) => ({
        path: f.path ?? null,
        sizeLabel: f.sizeLabel ?? null
      }))
      : []
  }));
}

function sanitizePreviewExport(preview) {
  if (!preview) return null;
  return {
    keepFile: preview.keepFile ?? null,
    removeFiles: preview.removeFiles ?? [],
    conflicts: preview.conflicts ?? [],
    safeToExecute: preview.safeToExecute ?? null,
    executionMode: preview.executionMode ?? null,
    riskAssessment: preview.riskAssessment
      ? {
        level: preview.riskAssessment.level ?? null,
        factors: preview.riskAssessment.factors ?? []
      }
      : null
  };
}

function buildExportProvenance(health = {}, { candidates, preview, candidatesScope } = {}) {
  let mergeCandidatesProvenance = 'missing';
  if (Array.isArray(candidates) && candidates.length) {
    mergeCandidatesProvenance = candidatesScope === 'monorepo'
      ? 'monorepo-consolidation-report'
      : 'platform-consolidation-report';
  } else if ((health.monorepo?.mergeCandidates ?? 0) > 0 || (health.platform?.mergeCandidates ?? 0) > 0) {
    mergeCandidatesProvenance = 'consolidation-report-count-only';
  }

  return {
    health: health.staticHost ? 'static-fallback' : (health.headline ? 'live-consolidation-scan' : 'missing'),
    platform: health.platform ? 'consolidation-report' : 'missing',
    monorepo: health.monorepo ? 'consolidation-report' : 'missing',
    mergeCandidates: mergeCandidatesProvenance,
    mergePreview: preview ? 'live-merge-preview' : 'missing',
    candidatesScope: (Array.isArray(candidates) && candidates.length && candidatesScope)
      ? candidatesScope
      : null
  };
}

function buildExportNotes(health = {}, summary = {}, { candidates, candidatesScope, preview } = {}) {
  const monorepo = health?.monorepo || {};
  const platform = health?.platform || {};
  const notes = [];

  if (summary.headlineScopeNote) {
    notes.push(summary.headlineScopeNote);
  }
  if (summary.scanFreshnessNote) {
    notes.push(summary.scanFreshnessNote);
  }
  if ((monorepo.mergeCandidates ?? 0) > 0 && (!Array.isArray(candidates) || !candidates.length)) {
    notes.push(`Monorepo consolidation report lists ${monorepo.mergeCandidates} merge candidate(s) but no detail rows were attached — reload the page before export or use candidates?scope=monorepo.`);
  }
  if (Array.isArray(candidates) && candidates.length && candidatesScope === 'monorepo') {
    notes.push('Merge candidate detail rows sourced from monorepo (CascadeProjects) consolidation report.');
  }
  if (preview) {
    notes.push('Merge preview included from active dashboard session — advisory only; confirm before executing.');
  }
  if ((health.recommendations || []).length && !(platform.recommendations || []).length && (monorepo.recommendations || []).length) {
    notes.push('Recommendations sourced from monorepo consolidation report because platform scan had none.');
  }
  if (health.monorepoStatus === 'platform-scoped-copy') {
    notes.push('Monorepo consolidation snapshot omitted — parent .simplebeacon/consolidation-report.json matches platform scope. Run consolidation scan from the monorepo root to refresh distinct monorepo metrics.');
  } else if (!health.monorepo && health.platform && health.monorepoStatus === 'missing') {
    notes.push('Export reflects platform (ai-platform) consolidation scan only — no distinct monorepo snapshot loaded.');
  }
  notes.push('Repository health export — consolidation metrics only, not SimpleBeacon vendor handoff clearance.');

  return dedupeExportNotes(notes.map((line) => normalizeSimpleBeaconBranding(line)));
}

function buildExportDisclaimers(health = {}) {
  const fromHealth = (health.disclaimers || []).filter((note) => {
    const text = String(note).toLowerCase();
    return !/merge candidates and previews are advisory/i.test(text);
  });
  return dedupeDisclaimers([
    ...fromHealth,
    'Repository health reflects duplicate detection and oversized-file analysis — not security gate results.',
    'Merge candidates and previews are advisory; confirm before executing any merge.',
    'Absolute host paths are redacted to project labels in exports.'
  ]);
}

export function buildRepositoryHealthExportBundle({
  health,
  candidates,
  preview,
  candidatesProjectPath,
  candidatesScope
} = {}) {
  const sanitizedPlatform = sanitizeSnapshotExport(health?.platform);
  const sanitizedMonorepo = sanitizeSnapshotExport(health?.monorepo);
  const summary = buildRepositoryHealthSummary(health || {}, { candidates, preview });
  const sanitizedCandidates = sanitizeCandidatesExport(candidates);
  const sanitizedPreview = sanitizePreviewExport(preview);
  const sanitizedRecommendations = sanitizeRecommendationsExport(health?.recommendations);
  const redactedCandidatesPath = candidatesProjectPath
    ? redactProjectPathForExport(
      candidatesProjectPath,
      candidatesScope === 'monorepo' ? 'CascadeProjects' : 'ai-platform'
    )
    : null;
  const exportNotes = buildExportNotes(health || {}, summary, { candidates, candidatesScope, preview });

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
    ...(sanitizedCandidates.length && redactedCandidatesPath ? { candidatesProjectPath: redactedCandidatesPath } : {}),
    ...(sanitizedCandidates.length && candidatesScope ? { candidatesScope } : {}),
    provenance: buildExportProvenance(health || {}, { candidates, preview, candidatesScope }),
    exportNotes,
    exportSanitized: true,
    handoffEligible: false,
    disclaimers: buildExportDisclaimers(health || {})
  };
}

function csvEscape(cell) {
  return `"${String(cell ?? '').replace(/"/g, '""')}"`;
}

function buildRepositoryHealthSummaryCsv(summary) {
  if (!summary) return null;
  const header = ['metric', 'value'];
  const rows = Object.entries(summary).map(([key, value]) => [
    key,
    value == null ? '' : String(value)
  ].map(csvEscape).join(','));
  return [header.join(','), ...rows].join('\n');
}

function buildRecommendationsCsv(recommendations = []) {
  if (!recommendations.length) return null;
  const header = ['priority', 'action', 'savings', 'effort', 'risk', 'description'];
  const rows = recommendations.map((item) => [
    item.priority || '',
    item.action || '',
    item.savings || '',
    item.effort || '',
    item.risk || '',
    item.description || ''
  ].map(csvEscape).join(','));
  return [header.join(','), ...rows].join('\n');
}

function buildSnapshotsCsv(platform, monorepo) {
  const snaps = [
    platform ? { scope: 'platform', ...platform } : null,
    monorepo ? { scope: 'monorepo', ...monorepo } : null
  ].filter(Boolean);
  if (!snaps.length) return null;
  const header = ['scope', 'label', 'healthScore', 'optimizationPotential', 'duplicateGroups', 'oversizedFiles', 'repositoryFilesTotal', 'generatedAt'];
  const rows = snaps.map((snap) => [
    snap.scope,
    snap.label || '',
    snap.repositoryHealthScore ?? '',
    snap.optimizationPotential ?? '',
    snap.duplicateGroups ?? '',
    snap.oversizedFiles ?? '',
    snap.repositoryFilesTotal ?? '',
    snap.generatedAt ?? ''
  ].map(csvEscape).join(','));
  return [header.join(','), ...rows].join('\n');
}

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

export function repositoryHealthExportFilename(ext = 'json') {
  const stamp = new Date().toISOString().slice(0, 10);
  if (ext === 'csv') return `repository-health-metrics-${stamp}.csv`;
  return `repository-health-export-${stamp}.json`;
}
