/**

 * Quality & Security page export bundle — browser mirror of server/lib/quality-export.js

 */



import { sanitizeNpmAuditExport } from './npm-audit-export.browser.js?v=20260601npmaudit5';



export function npmAuditSummary(audit) {

  const summary = audit?.summary || audit?.metadata?.vulnerabilities || {};

  const deps = audit?.dependencies || audit?.metadata?.dependencies || {};

  return {

    dependencies: summary.dependencies ?? deps.total ?? null,

    prod: summary.prodDependencies ?? deps.prod ?? null,

    dev: summary.devDependencies ?? deps.dev ?? null,

    critical: summary.critical ?? 0,

    high: summary.high ?? 0,

    moderate: summary.moderate ?? summary.medium ?? 0,

    low: summary.low ?? 0,

    vulnerabilityTotal: summary.vulnerabilityTotal ?? summary.total ?? (audit?.vulnerabilities?.length ?? 0),

    generatedAt: audit?.generatedAt ?? null

  };

}



export function stripInternalExportFields(section) {

  if (!section || typeof section !== 'object' || Array.isArray(section)) return section;

  const { _source, ...rest } = section;

  return rest;

}



export function resolveSectionProvenance(section) {

  if (!section || typeof section !== 'object') return 'missing';

  if (section._source === 'database' || section._source === 'redis') return section._source;

  if (section.error) return 'error';

  if (section.coverageCollection === 'istanbul' || section.dataSource === 'repository-audit') {

    return 'repository-audit-live';

  }

  if (section._source === 'sample') return 'repository-audit-live';

  if (section.generatedAt || section.exportNormalized) return 'live-measured';

  return section._source || section.dataSource || 'unknown';

}



export function redactProjectPathForExport(value, projectLabel = 'ai-platform') {

  if (value == null || value === '') return value;

  const normalized = String(value).replace(/\\/g, '/');

  if (normalized.endsWith('/package.json') || normalized.endsWith('package.json')) {

    return `${projectLabel}/package.json`;

  }

  if (/^[a-zA-Z]:\//.test(normalized) || normalized.startsWith('/Users/')

    || normalized.startsWith('/home/') || normalized.includes('CascadeProjects')) {

    return projectLabel;

  }

  return normalized;

}



function projectLabelFromPath(projectPath) {

  const normalized = String(projectPath || 'ai-platform').replace(/\\/g, '/');

  const parts = normalized.split('/').filter(Boolean);

  return parts[parts.length - 1] || 'ai-platform';

}



export function sanitizeCoverageExport(coverage) {

  if (!coverage) return null;

  const clean = stripInternalExportFields(coverage);

  return {

    ...clean,

    provenance: resolveSectionProvenance(coverage),

    lastRun: clean.lastRun ?? clean.testCountGeneratedAt ?? null,

    freshnessNote: clean.lastRun && clean.testCountGeneratedAt

      && Date.parse(clean.testCountGeneratedAt) > Date.parse(clean.lastRun)

      ? `Jest counts refreshed ${clean.testCountGeneratedAt}; Istanbul summary lastRun ${clean.lastRun}.`

      : null

  };

}



export function sanitizeSecurityExport(security) {

  if (!security) return null;

  return {

    ...stripInternalExportFields(security),

    provenance: resolveSectionProvenance(security)

  };

}



export function sanitizeQualityExport(quality, coverage = null, report = null) {

  if (!quality) return null;

  const clean = stripInternalExportFields(quality);

  const covTotal = coverage?.totalTests ?? coverage?.passedTests ?? null;

  const qualTotal = clean.totalTests ?? clean.passedTests ?? clean.testsPassed ?? null;

  const covPassed = coverage?.passedTests ?? null;

  const qualPassed = clean.passedTests ?? clean.testsPassed ?? null;

  const covAt = coverage?.testCountGeneratedAt ?? null;

  const qualAt = clean.testCountGeneratedAt ?? null;

  const covLabel = coverage?.jestTestsLabel

    ?? (covPassed != null && covTotal != null ? `${covPassed}/${covTotal}` : null);

  const qualLabel = clean.jestTestsLabel

    ?? (qualPassed != null && qualTotal != null ? `${qualPassed}/${qualTotal}` : null);

  let testCountNote = null;

  let staleRelativeToCoverage = false;

  if (covTotal != null && qualTotal != null && covTotal !== qualTotal) {

    staleRelativeToCoverage = true;

    const coverageNewer = covAt && qualAt && Date.parse(covAt) >= Date.parse(qualAt);

    testCountNote = coverageNewer

      ? `Quality panel cached ${qualLabel || qualTotal} tests (${qualAt || 'unknown'}); summary uses fresher coverage Jest snapshot ${covLabel || covTotal} tests (${covAt}).`

      : `Quality (${qualLabel || qualTotal}) and coverage (${covLabel || covTotal}) Jest snapshots differ — summary.testsTotal follows coverage section.`;

  } else if (covLabel && qualLabel && covLabel !== qualLabel) {

    staleRelativeToCoverage = true;

    const coverageNewer = covAt && qualAt && Date.parse(covAt) >= Date.parse(qualAt);

    testCountNote = coverageNewer

      ? `Quality panel cached ${qualLabel} (${qualAt || 'unknown'}); summary uses fresher coverage Jest snapshot ${covLabel} (${covAt}).`

      : `Quality (${qualLabel}) and coverage (${covLabel}) Jest snapshots differ — summary follows coverage section.`;

  } else if (covPassed != null && qualPassed != null && covPassed !== qualPassed

    && covTotal != null && qualTotal != null && covTotal === qualTotal) {

    staleRelativeToCoverage = true;

    testCountNote = `Quality panel shows ${qualLabel || `${qualPassed}/${qualTotal}`} (${qualAt || 'unknown'}) — coverage Jest snapshot is ${covLabel || `${covPassed}/${covTotal}`} (${covAt}).`;

  }

  const measuredBaselinesNote = buildMeasuredBaselinesNote(clean, report);

  let qualityIssuesNote = null;

  if (staleRelativeToCoverage && (clean.issuesFound ?? 0) > 0 && (coverage?.failedTests ?? 0) === 0) {

    qualityIssuesNote = `Quality panel issuesFound (${clean.issuesFound}) reflects cached panel snapshot — summary uses coverage Jest snapshot (${coverage?.failedTests ?? 0} failures).`;

  }

  return {

    ...clean,

    provenance: resolveSectionProvenance(quality),

    ...(staleRelativeToCoverage

      ? {

        staleRelativeToCoverage,

        testCountStale: true,

        testCountNote,

        ...(qualityIssuesNote ? { qualityIssuesNote } : {})

      }

      : {}),

    ...(measuredBaselinesNote ? { measuredBaselinesNote } : {})

  };

}



function dedupeExportNotes(notes = []) {

  const seen = new Set();

  const out = [];

  for (const note of notes.filter(Boolean)) {

    const normalized = String(note).replace(/\s+/g, ' ').trim().toLowerCase();

    const scopeKey = /supply-002 hygiene evidence only/i.test(normalized)

      ? 'quality-npm-audit-bundle-note'

      : /quality\.measuredbaselines .* catalog size/i.test(normalized)

        ? 'measured-baselines-note'

        : /quality panel cached/i.test(normalized)

          ? 'quality-stale-note'

          : /quality panel shows/i.test(normalized)

            ? 'quality-pass-mismatch-note'

            : /quality panel issuesfound/i.test(normalized)

              ? 'quality-issues-stale-note'

              : /jest counts refreshed .* istanbul summary lastrun/i.test(normalized)

                ? 'coverage-freshness-note'

                : normalized;

    if (seen.has(scopeKey)) continue;

    seen.add(scopeKey);

    out.push(normalizeSimpleBeaconBranding(note));

  }

  return out.slice(0, 8);

}



export function normalizeSimpleBeaconBranding(value) {

  return String(value ?? '').replace(/\bSimplebeacon\b/g, 'SimpleBeacon');

}



function buildMeasuredBaselinesNote(quality, report = null) {

  const catalog = quality?.measuredBaselines;

  if (catalog == null) return null;

  const gateLabel = report?.pageSampleSchemaChecked != null

    ? `${report.pageSampleSchemaPassed ?? 0}/${report.pageSampleSchemaChecked}`

    : null;

  if (gateLabel && Number(catalog) !== Number(gateLabel.split('/')[1])) {

    return `quality.measuredBaselines (${catalog}) is page-spec catalog size — latest gate scan validated ${gateLabel} page sample schemas.`;

  }

  return `quality.measuredBaselines (${catalog}) counts repository baseline page-spec catalog entries — not gate-validated schema pass counts.`;

}



function parseNumeric(value) {

  if (value == null) return null;

  const match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);

  return match ? Number(match[0]) : null;

}



export function sanitizeNpmAuditForQualityExport(audit, projectPath) {

  if (!audit || audit.error) {

    return audit?.error ? { error: audit.error } : audit || null;

  }

  const label = projectLabelFromPath(projectPath || audit.projectPath);

  const sanitized = sanitizeNpmAuditExport(audit, label);

  const { metadata, ...rest } = sanitized;

  const exportNotes = dedupeExportNotes([

    ...(Array.isArray(rest.exportNotes) ? rest.exportNotes : []),

    ...(Array.isArray(rest.exportNotes) && rest.exportNotes.some((n) => /SUPPLY-002 hygiene evidence only/i.test(String(n)))

      ? []

      : ['Quality & Security bundle — npm audit is SUPPLY-002 hygiene evidence only, not SimpleBeacon vendor handoff clearance.'])

  ]);

  return {

    ...rest,

    projectPath: label,

    auditRoot: redactProjectPathForExport(sanitized.auditRoot, label),

    packageJsonPath: `${label}/package.json`,

    provenance: 'live-npm-audit',

    handoffEligible: false,

    securityHandoffEligible: false,

    exportNotes,

    metadata: metadata

      ? {

        vulnerabilities: metadata.vulnerabilities || null,

        dependencies: metadata.dependencies || null

      }

      : undefined

  };

}



export function buildExportProvenance({ coverage, security, quality, npmAudit } = {}) {

  return {

    coverage: resolveSectionProvenance(coverage),

    security: resolveSectionProvenance(security),

    quality: resolveSectionProvenance(quality),

    npmAudit: npmAudit?.error ? 'error' : (npmAudit ? 'live-npm-audit' : 'missing')

  };

}



export function buildQualityExportBundle({ coverage, security, quality, npmAudit, report } = {}) {

  const auditStats = npmAudit && !npmAudit.error ? npmAuditSummary(npmAudit) : null;

  const sanitizedCoverage = sanitizeCoverageExport(coverage);

  const sanitizedSecurity = sanitizeSecurityExport(security);

  const sanitizedQuality = sanitizeQualityExport(quality, coverage, report);

  const sanitizedAudit = sanitizeNpmAuditForQualityExport(

    npmAudit,

    npmAudit?.projectPath || 'ai-platform'

  );

  const testCountMismatch = sanitizedQuality?.staleRelativeToCoverage === true;

  const measuredBaselinesNote = sanitizedQuality?.measuredBaselinesNote ?? null;

  const qualityIssuesNote = sanitizedQuality?.qualityIssuesNote ?? null;

  const gatePageSpecsLabel = report?.pageSampleSchemaChecked != null

    ? `${report.pageSampleSchemaPassed ?? 0}/${report.pageSampleSchemaChecked}`

    : null;



  const bundle = {

    type: 'simplebeacon-quality-security-export',

    version: '1.1.0',

    exportVersion: '1.1.0',

    generatedBy: 'SimpleBeacon',

    title: 'SimpleBeacon Quality & Security Export',

    generatedAt: new Date().toISOString(),

    summary: {

      lineCoverage: coverage?.overallCoverage ?? coverage?.lineCoverage ?? null,

      branchCoverage: coverage?.branchCoverage ?? null,

      functionCoverage: coverage?.functionCoverage ?? null,

      statementCoverage: coverage?.statementCoverage ?? null,

      securityScore: security?.securityScore ?? null,

      qualityScore: quality?.overallScore ?? quality?.qualityScore ?? null,

      dependencyVulnerabilities: auditStats?.vulnerabilityTotal

        ?? security?.npmAuditTotal

        ?? security?.openVulnerabilities

        ?? null,

      npmDependencies: auditStats?.dependencies ?? null,

      npmCritical: auditStats?.critical ?? null,

      npmHigh: auditStats?.high ?? null,

      engineeringFindings: security?.openEngineeringFindings ?? null,

      complianceRate: security?.complianceRate ?? null,

      testsPassed: coverage?.passedTests ?? null,

      testsTotal: coverage?.totalTests ?? null,

      testCountSource: coverage?.testCountSource ?? null,

      testCountStale: coverage?.testCountStale ?? false,

      coverageLastRun: coverage?.lastRun ?? null,

      jestResultAt: coverage?.testCountGeneratedAt ?? null,

      npmAuditAt: auditStats?.generatedAt ?? null,

      measuredBaselines: quality?.measuredBaselines ?? null,

      gateValidatedPageSpecs: gatePageSpecsLabel,

      ...(testCountMismatch && sanitizedQuality?.testCountNote

        ? { qualityTestCountNote: sanitizedQuality.testCountNote, qualityPanelStale: true }

        : {}),

      ...(qualityIssuesNote ? { qualityIssuesNote } : {}),

      ...(measuredBaselinesNote ? { measuredBaselinesNote } : {})

    },

    provenance: buildExportProvenance({ coverage, security, quality, npmAudit }),

    disclaimers: [

      'Coverage from Istanbul collectCoverageFrom scope — not whole-repository line coverage.',

      'Security and quality scores reflect SimpleBeacon gate/schema compliance, not penetration testing.',

      'repository-audit-live provenance means live .simplebeacon/, coverage/, and npm audit overlay on dashboard API payloads.',

      'Absolute host paths are redacted to project label in npm audit exports.',

      'Summary testsTotal follows coverage Jest snapshot — quality panel counts may lag until dashboard refresh.',

      'summary.measuredBaselines is page-spec catalog size — gateValidatedPageSpecs reflects latest scan when present.'

    ].map((line) => normalizeSimpleBeaconBranding(line)),

    coverage: sanitizedCoverage,

    security: sanitizedSecurity,

    quality: sanitizedQuality,

    npmAudit: sanitizedAudit,

    exportSanitized: true,

    exportNormalized: true,

    handoffEligible: false,

    securityHandoffEligible: false,

    hygieneSummary: {

      lineCoverage: coverage?.overallCoverage ?? coverage?.lineCoverage ?? null,

      testsTotal: coverage?.totalTests ?? null,

      testsPassed: coverage?.passedTests ?? null,

      npmVulnerabilities: auditStats?.vulnerabilityTotal ?? 0,

      npmDependencies: auditStats?.dependencies ?? null,

      securityScore: security?.securityScore ?? null,

      qualityScore: quality?.overallScore ?? quality?.qualityScore ?? null,

      attestationNote: 'Quality & Security dashboard export — hygiene metrics only, not vendor handoff clearance.'

    },

    exportNotes: dedupeExportNotes([

      measuredBaselinesNote,

      testCountMismatch ? sanitizedQuality.testCountNote : null,

      qualityIssuesNote,

      sanitizedCoverage?.freshnessNote || null

    ])

  };

  return bundle;

}



export function sanitizeQualitySecurityExport(bundle, options = {}) {

  if (!bundle || bundle.type !== 'simplebeacon-quality-security-export') return bundle;

  const report = options.report || bundle.report || (

    bundle.summary?.gateValidatedPageSpecs

      ? {

        pageSampleSchemaPassed: parseNumeric(String(bundle.summary.gateValidatedPageSpecs).split('/')[0]),

        pageSampleSchemaChecked: parseNumeric(String(bundle.summary.gateValidatedPageSpecs).split('/')[1])

      }

      : null

  );

  return buildQualityExportBundle({

    coverage: bundle.coverage,

    security: bundle.security,

    quality: bundle.quality,

    npmAudit: bundle.npmAudit,

    report

  });

}



export function buildNpmAuditCsv(audit) {

  if (!audit || audit.error) return null;

  const vulnerabilities = audit.vulnerabilities || audit.advisories || [];

  if (!vulnerabilities.length) return null;

  const header = ['severity', 'package', 'title', 'url'];

  const rows = vulnerabilities.map((v) => [

    v.severity || '',

    v.component || v.name || v.module_name || '',

    v.title || v.overview || '',

    v.url || ''

  ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));

  return [header.join(','), ...rows].join('\n');

}



export function buildQualitySummaryCsv(bundle) {

  if (!bundle?.summary) return null;

  const header = ['metric', 'value'];

  const rows = Object.entries(bundle.summary).map(([key, value]) => [

    key,

    value == null ? '' : String(value)

  ].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));

  return [header.join(','), ...rows].join('\n');

}



export function buildQualityCsv({ bundle, npmAudit } = {}) {

  const vulnCsv = buildNpmAuditCsv(npmAudit);

  if (vulnCsv) return vulnCsv;

  return buildQualitySummaryCsv(bundle);

}



export function qualityExportFilename(ext = 'json') {

  const stamp = new Date().toISOString().slice(0, 10);

  if (ext === 'csv') return `quality-security-metrics-${stamp}.csv`;

  return `quality-security-export-${stamp}.json`;

}


