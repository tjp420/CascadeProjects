/**

 * Quality & Security page export bundle — browser mirror of server/lib/quality-export.js

 */
import { sanitizeNpmAuditExport } from './npm-audit-export.browser.js?v=20260716cachefix1';
/**
 * Npm audit summary.
 * @param {any} audit
 * @returns {any}
 */
export function npmAuditSummary(audit) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
  const summary =
    (audit === null || audit === void 0 ? void 0 : audit.summary) ||
    ((_a = audit === null || audit === void 0 ? void 0 : audit.metadata) === null || _a === void 0
      ? void 0
      : _a.vulnerabilities) ||
    {};
  const deps =
    (audit === null || audit === void 0 ? void 0 : audit.dependencies) ||
    ((_b = audit === null || audit === void 0 ? void 0 : audit.metadata) === null || _b === void 0
      ? void 0
      : _b.dependencies) ||
    {};
  return {
    dependencies:
      (_d = (_c = summary.dependencies) !== null && _c !== void 0 ? _c : deps.total) !== null && _d !== void 0
        ? _d
        : null,
    prod:
      (_f = (_e = summary.prodDependencies) !== null && _e !== void 0 ? _e : deps.prod) !== null && _f !== void 0
        ? _f
        : null,
    dev:
      (_h = (_g = summary.devDependencies) !== null && _g !== void 0 ? _g : deps.dev) !== null && _h !== void 0
        ? _h
        : null,
    critical: (_j = summary.critical) !== null && _j !== void 0 ? _j : 0,
    high: (_k = summary.high) !== null && _k !== void 0 ? _k : 0,
    moderate:
      (_m = (_l = summary.moderate) !== null && _l !== void 0 ? _l : summary.medium) !== null && _m !== void 0 ? _m : 0,
    low: (_o = summary.low) !== null && _o !== void 0 ? _o : 0,
    vulnerabilityTotal:
      (_q = (_p = summary.vulnerabilityTotal) !== null && _p !== void 0 ? _p : summary.total) !== null && _q !== void 0
        ? _q
        : (_s =
              (_r = audit === null || audit === void 0 ? void 0 : audit.vulnerabilities) === null || _r === void 0
                ? void 0
                : _r.length) !== null && _s !== void 0
          ? _s
          : 0,
    generatedAt:
      (_t = audit === null || audit === void 0 ? void 0 : audit.generatedAt) !== null && _t !== void 0 ? _t : null,
  };
}
/**
 * Strip internal export fields.
 * @param {any} section
 * @returns {any}
 */
export function stripInternalExportFields(section) {
  if (!section || typeof section !== 'object' || Array.isArray(section)) return section;
  const { _source, ...rest } = section;
  return rest;
}
/**
 * Resolve section provenance.
 * @param {any} section
 * @returns {any}
 */
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
/**
 * Redact project path for export.
 * @param {string} rawPath
 * @param {any} projectLabel
 * @returns {any}
 */
export function redactProjectPathForExport(rawPath, projectLabel = 'ai-platform') {
  if (rawPath == null || rawPath === '') return rawPath;
  const normalized = String(rawPath).replace(/\\/g, '/');
  if (normalized.endsWith('/package.json') || normalized.endsWith('package.json')) {
    return `${projectLabel}/package.json`;
  }
  if (
    /^[a-zA-Z]:\//.test(normalized) ||
    normalized.startsWith('/Users/') ||
    normalized.startsWith('/home/') ||
    normalized.includes('CascadeProjects')
  ) {
    return projectLabel;
  }
  return normalized;
}
/**
 * Project label from path.
 * @param {string} projectPath
 * @returns {any}
 */
function projectLabelFromPath(projectPath) {
  const normalized = String(projectPath || 'ai-platform').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'ai-platform';
}
/**
 * Sanitize coverage export.
 * @param {any} coverage
 * @returns {any}
 */
export function sanitizeCoverageExport(coverage) {
  var _a, _b;
  if (!coverage) return null;
  const clean = stripInternalExportFields(coverage);
  return {
    ...clean,
    provenance: resolveSectionProvenance(coverage),
    lastRun:
      (_b = (_a = clean.lastRun) !== null && _a !== void 0 ? _a : clean.testCountGeneratedAt) !== null && _b !== void 0
        ? _b
        : null,
    freshnessNote:
      clean.lastRun && clean.testCountGeneratedAt && Date.parse(clean.testCountGeneratedAt) > Date.parse(clean.lastRun)
        ? `Jest counts refreshed ${clean.testCountGeneratedAt}; Istanbul summary lastRun ${clean.lastRun}.`
        : null,
  };
}
/**
 * Sanitize security export.
 * @param {any} security
 * @returns {any}
 */
export function sanitizeSecurityExport(security) {
  if (!security) return null;
  return {
    ...stripInternalExportFields(security),
    provenance: resolveSectionProvenance(security),
  };
}
/**
 * Sanitize quality export.
 * @param {any} quality
 * @param {any} coverage
 * @param {number} report
 * @returns {any}
 */
export function sanitizeQualityExport(quality, coverage = null, report = null) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
  if (!quality) return null;
  const clean = stripInternalExportFields(quality);
  const covTotal =
    (_b =
      (_a = coverage === null || coverage === void 0 ? void 0 : coverage.totalTests) !== null && _a !== void 0
        ? _a
        : coverage === null || coverage === void 0
          ? void 0
          : coverage.passedTests) !== null && _b !== void 0
      ? _b
      : null;
  const qualTotal =
    (_e =
      (_d = (_c = clean.totalTests) !== null && _c !== void 0 ? _c : clean.passedTests) !== null && _d !== void 0
        ? _d
        : clean.testsPassed) !== null && _e !== void 0
      ? _e
      : null;
  const covPassed =
    (_f = coverage === null || coverage === void 0 ? void 0 : coverage.passedTests) !== null && _f !== void 0
      ? _f
      : null;
  const qualPassed =
    (_h = (_g = clean.passedTests) !== null && _g !== void 0 ? _g : clean.testsPassed) !== null && _h !== void 0
      ? _h
      : null;
  const covAt =
    (_j = coverage === null || coverage === void 0 ? void 0 : coverage.testCountGeneratedAt) !== null && _j !== void 0
      ? _j
      : null;
  const qualAt = (_k = clean.testCountGeneratedAt) !== null && _k !== void 0 ? _k : null;
  const covLabel =
    (_l = coverage === null || coverage === void 0 ? void 0 : coverage.jestTestsLabel) !== null && _l !== void 0
      ? _l
      : covPassed != null && covTotal != null
        ? `${covPassed}/${covTotal}`
        : null;
  const qualLabel =
    (_m = clean.jestTestsLabel) !== null && _m !== void 0
      ? _m
      : qualPassed != null && qualTotal != null
        ? `${qualPassed}/${qualTotal}`
        : null;
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
  } else if (
    covPassed != null &&
    qualPassed != null &&
    covPassed !== qualPassed &&
    covTotal != null &&
    qualTotal != null &&
    covTotal === qualTotal
  ) {
    staleRelativeToCoverage = true;
    testCountNote = `Quality panel shows ${qualLabel || `${qualPassed}/${qualTotal}`} (${qualAt || 'unknown'}) — coverage Jest snapshot is ${covLabel || `${covPassed}/${covTotal}`} (${covAt}).`;
  }
  const measuredBaselinesNote = buildMeasuredBaselinesNote(clean, report);
  let qualityIssuesNote = null;
  if (
    staleRelativeToCoverage &&
    ((_o = clean.issuesFound) !== null && _o !== void 0 ? _o : 0) > 0 &&
    ((_p = coverage === null || coverage === void 0 ? void 0 : coverage.failedTests) !== null && _p !== void 0
      ? _p
      : 0) === 0
  ) {
    qualityIssuesNote = `Quality panel issuesFound (${clean.issuesFound}) reflects cached panel snapshot — summary uses coverage Jest snapshot (${(_q = coverage === null || coverage === void 0 ? void 0 : coverage.failedTests) !== null && _q !== void 0 ? _q : 0} failures).`;
  }
  return {
    ...clean,
    provenance: resolveSectionProvenance(quality),
    ...(staleRelativeToCoverage
      ? {
          staleRelativeToCoverage,
          testCountStale: true,
          testCountNote,
          ...(qualityIssuesNote ? { qualityIssuesNote } : {}),
        }
      : {}),
    ...(measuredBaselinesNote ? { measuredBaselinesNote } : {}),
  };
}
/**
 * Dedupe export notes.
 * @param {Array} notes
 * @returns {any}
 */
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
/**
 * Normalize simple beacon branding.
 * @param {any} value
 * @returns {any}
 */
export function normalizeSimpleBeaconBranding(value) {
  return String(value !== null && value !== void 0 ? value : '').replace(/\bSimplebeacon\b/g, 'SimpleBeacon');
}
/**
 * Build measured baselines note.
 * @param {any} quality
 * @param {number} report
 * @returns {any}
 */
function buildMeasuredBaselinesNote(quality, report = null) {
  var _a;
  const catalog = quality === null || quality === void 0 ? void 0 : quality.measuredBaselines;
  if (catalog == null) return null;
  const gateLabel =
    (report === null || report === void 0 ? void 0 : report.pageSampleSchemaChecked) != null
      ? `${(_a = report.pageSampleSchemaPassed) !== null && _a !== void 0 ? _a : 0}/${report.pageSampleSchemaChecked}`
      : null;
  if (gateLabel && Number(catalog) !== Number(gateLabel.split('/')[1])) {
    return `quality.measuredBaselines (${catalog}) is page-spec catalog size — latest gate scan validated ${gateLabel} page sample schemas.`;
  }
  return `quality.measuredBaselines (${catalog}) counts repository baseline page-spec catalog entries — not gate-validated schema pass counts.`;
}
/**
 * Parse numeric.
 * @param {any} value
 * @returns {any}
 */
function parseNumeric(value) {
  if (value == null) return null;
  const match = String(value)
    .replace(/,/g, '')
    .match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}
/**
 * Sanitize npm audit for quality export.
 * @param {any} audit
 * @param {string} projectPath
 * @returns {any}
 */
export function sanitizeNpmAuditForQualityExport(audit, projectPath) {
  if (!audit || audit.error) {
    return (audit === null || audit === void 0 ? void 0 : audit.error) ? { error: audit.error } : audit || null;
  }
  const label = projectLabelFromPath(projectPath || audit.projectPath);
  const sanitized = sanitizeNpmAuditExport(audit, label);
  const { metadata, ...rest } = sanitized;
  const exportNotes = dedupeExportNotes([
    ...(Array.isArray(rest.exportNotes) ? rest.exportNotes : []),
    ...(Array.isArray(rest.exportNotes) &&
    rest.exportNotes.some((n) => /SUPPLY-002 hygiene evidence only/i.test(String(n)))
      ? []
      : [
          'Quality & Security bundle — npm audit is SUPPLY-002 hygiene evidence only, not SimpleBeacon vendor handoff clearance.',
        ]),
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
          dependencies: metadata.dependencies || null,
        }
      : undefined,
  };
}
/**
 * Build export provenance.
 * @param {Object} options
 * @param {any} security
 * @param {any} quality
 * @param {any} npmAudit }
 * @returns {any}
 */
export function buildExportProvenance({ coverage, security, quality, npmAudit } = {}) {
  return {
    coverage: resolveSectionProvenance(coverage),
    security: resolveSectionProvenance(security),
    quality: resolveSectionProvenance(quality),
    npmAudit: (npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.error)
      ? 'error'
      : npmAudit
        ? 'live-npm-audit'
        : 'missing',
  };
}
/**
 * Build quality export bundle.
 * @param {Object} options
 * @param {any} security
 * @param {any} quality
 * @param {any} npmAudit
 * @param {number} report }
 * @returns {any}
 */
export function buildQualityExportBundle({ coverage, security, quality, npmAudit, report } = {}) {
  var _a,
    _b,
    _c,
    _d,
    _e,
    _f,
    _g,
    _h,
    _j,
    _k,
    _l,
    _m,
    _o,
    _p,
    _q,
    _r,
    _s,
    _t,
    _u,
    _v,
    _w,
    _x,
    _y,
    _z,
    _0,
    _1,
    _2,
    _3,
    _4,
    _5,
    _6,
    _7,
    _8,
    _9,
    _10,
    _11;
  const auditStats = npmAudit && !npmAudit.error ? npmAuditSummary(npmAudit) : null;
  const sanitizedCoverage = sanitizeCoverageExport(coverage);
  const sanitizedSecurity = sanitizeSecurityExport(security);
  const sanitizedQuality = sanitizeQualityExport(quality, coverage, report);
  const sanitizedAudit = sanitizeNpmAuditForQualityExport(
    npmAudit,
    (npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.projectPath) || 'ai-platform'
  );
  const testCountMismatch =
    (sanitizedQuality === null || sanitizedQuality === void 0 ? void 0 : sanitizedQuality.staleRelativeToCoverage) ===
    true;
  const measuredBaselinesNote =
    (_a =
      sanitizedQuality === null || sanitizedQuality === void 0 ? void 0 : sanitizedQuality.measuredBaselinesNote) !==
      null && _a !== void 0
      ? _a
      : null;
  const qualityIssuesNote =
    (_b = sanitizedQuality === null || sanitizedQuality === void 0 ? void 0 : sanitizedQuality.qualityIssuesNote) !==
      null && _b !== void 0
      ? _b
      : null;
  const gatePageSpecsLabel =
    (report === null || report === void 0 ? void 0 : report.pageSampleSchemaChecked) != null
      ? `${(_c = report.pageSampleSchemaPassed) !== null && _c !== void 0 ? _c : 0}/${report.pageSampleSchemaChecked}`
      : null;
  const bundle = {
    type: 'simplebeacon-quality-security-export',
    version: '1.1.0',
    exportVersion: '1.1.0',
    generatedBy: 'SimpleBeacon',
    title: 'SimpleBeacon Quality & Security Export',
    generatedAt: new Date().toISOString(),
    summary: {
      lineCoverage:
        (_e =
          (_d = coverage === null || coverage === void 0 ? void 0 : coverage.overallCoverage) !== null && _d !== void 0
            ? _d
            : coverage === null || coverage === void 0
              ? void 0
              : coverage.lineCoverage) !== null && _e !== void 0
          ? _e
          : null,
      branchCoverage:
        (_f = coverage === null || coverage === void 0 ? void 0 : coverage.branchCoverage) !== null && _f !== void 0
          ? _f
          : null,
      functionCoverage:
        (_g = coverage === null || coverage === void 0 ? void 0 : coverage.functionCoverage) !== null && _g !== void 0
          ? _g
          : null,
      statementCoverage:
        (_h = coverage === null || coverage === void 0 ? void 0 : coverage.statementCoverage) !== null && _h !== void 0
          ? _h
          : null,
      securityScore:
        (_j = security === null || security === void 0 ? void 0 : security.securityScore) !== null && _j !== void 0
          ? _j
          : null,
      qualityScore:
        (_l =
          (_k = quality === null || quality === void 0 ? void 0 : quality.overallScore) !== null && _k !== void 0
            ? _k
            : quality === null || quality === void 0
              ? void 0
              : quality.qualityScore) !== null && _l !== void 0
          ? _l
          : null,
      dependencyVulnerabilities:
        (_p =
          (_o =
            (_m = auditStats === null || auditStats === void 0 ? void 0 : auditStats.vulnerabilityTotal) !== null &&
            _m !== void 0
              ? _m
              : security === null || security === void 0
                ? void 0
                : security.npmAuditTotal) !== null && _o !== void 0
            ? _o
            : security === null || security === void 0
              ? void 0
              : security.openVulnerabilities) !== null && _p !== void 0
          ? _p
          : null,
      npmDependencies:
        (_q = auditStats === null || auditStats === void 0 ? void 0 : auditStats.dependencies) !== null && _q !== void 0
          ? _q
          : null,
      npmCritical:
        (_r = auditStats === null || auditStats === void 0 ? void 0 : auditStats.critical) !== null && _r !== void 0
          ? _r
          : null,
      npmHigh:
        (_s = auditStats === null || auditStats === void 0 ? void 0 : auditStats.high) !== null && _s !== void 0
          ? _s
          : null,
      engineeringFindings:
        (_t = security === null || security === void 0 ? void 0 : security.openEngineeringFindings) !== null &&
        _t !== void 0
          ? _t
          : null,
      complianceRate:
        (_u = security === null || security === void 0 ? void 0 : security.complianceRate) !== null && _u !== void 0
          ? _u
          : null,
      testsPassed:
        (_v = coverage === null || coverage === void 0 ? void 0 : coverage.passedTests) !== null && _v !== void 0
          ? _v
          : null,
      testsTotal:
        (_w = coverage === null || coverage === void 0 ? void 0 : coverage.totalTests) !== null && _w !== void 0
          ? _w
          : null,
      testCountSource:
        (_x = coverage === null || coverage === void 0 ? void 0 : coverage.testCountSource) !== null && _x !== void 0
          ? _x
          : null,
      testCountStale:
        (_y = coverage === null || coverage === void 0 ? void 0 : coverage.testCountStale) !== null && _y !== void 0
          ? _y
          : false,
      coverageLastRun:
        (_z = coverage === null || coverage === void 0 ? void 0 : coverage.lastRun) !== null && _z !== void 0
          ? _z
          : null,
      jestResultAt:
        (_0 = coverage === null || coverage === void 0 ? void 0 : coverage.testCountGeneratedAt) !== null &&
        _0 !== void 0
          ? _0
          : null,
      npmAuditAt:
        (_1 = auditStats === null || auditStats === void 0 ? void 0 : auditStats.generatedAt) !== null && _1 !== void 0
          ? _1
          : null,
      measuredBaselines:
        (_2 = quality === null || quality === void 0 ? void 0 : quality.measuredBaselines) !== null && _2 !== void 0
          ? _2
          : null,
      gateValidatedPageSpecs: gatePageSpecsLabel,
      ...(testCountMismatch &&
      (sanitizedQuality === null || sanitizedQuality === void 0 ? void 0 : sanitizedQuality.testCountNote)
        ? { qualityTestCountNote: sanitizedQuality.testCountNote, qualityPanelStale: true }
        : {}),
      ...(qualityIssuesNote ? { qualityIssuesNote } : {}),
      ...(measuredBaselinesNote ? { measuredBaselinesNote } : {}),
    },
    provenance: buildExportProvenance({ coverage, security, quality, npmAudit }),
    disclaimers: [
      'Coverage from Istanbul collectCoverageFrom scope — not whole-repository line coverage.',
      'Security and quality scores reflect SimpleBeacon gate/schema compliance, not penetration testing.',
      'repository-audit-live provenance means live .simplebeacon/, coverage/, and npm audit overlay on dashboard API payloads.',
      'Absolute host paths are redacted to project label in npm audit exports.',
      'Summary testsTotal follows coverage Jest snapshot — quality panel counts may lag until dashboard refresh.',
      'summary.measuredBaselines is page-spec catalog size — gateValidatedPageSpecs reflects latest scan when present.',
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
      lineCoverage:
        (_4 =
          (_3 = coverage === null || coverage === void 0 ? void 0 : coverage.overallCoverage) !== null && _3 !== void 0
            ? _3
            : coverage === null || coverage === void 0
              ? void 0
              : coverage.lineCoverage) !== null && _4 !== void 0
          ? _4
          : null,
      testsTotal:
        (_5 = coverage === null || coverage === void 0 ? void 0 : coverage.totalTests) !== null && _5 !== void 0
          ? _5
          : null,
      testsPassed:
        (_6 = coverage === null || coverage === void 0 ? void 0 : coverage.passedTests) !== null && _6 !== void 0
          ? _6
          : null,
      npmVulnerabilities:
        (_7 = auditStats === null || auditStats === void 0 ? void 0 : auditStats.vulnerabilityTotal) !== null &&
        _7 !== void 0
          ? _7
          : 0,
      npmDependencies:
        (_8 = auditStats === null || auditStats === void 0 ? void 0 : auditStats.dependencies) !== null && _8 !== void 0
          ? _8
          : null,
      securityScore:
        (_9 = security === null || security === void 0 ? void 0 : security.securityScore) !== null && _9 !== void 0
          ? _9
          : null,
      qualityScore:
        (_11 =
          (_10 = quality === null || quality === void 0 ? void 0 : quality.overallScore) !== null && _10 !== void 0
            ? _10
            : quality === null || quality === void 0
              ? void 0
              : quality.qualityScore) !== null && _11 !== void 0
          ? _11
          : null,
      attestationNote: 'Quality & Security dashboard export — hygiene metrics only, not vendor handoff clearance.',
    },
    exportNotes: dedupeExportNotes([
      measuredBaselinesNote,
      testCountMismatch ? sanitizedQuality.testCountNote : null,
      qualityIssuesNote,
      (sanitizedCoverage === null || sanitizedCoverage === void 0 ? void 0 : sanitizedCoverage.freshnessNote) || null,
    ]),
  };
  return bundle;
}
/**
 * Sanitize quality security export.
 * @param {any} bundle
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeQualitySecurityExport(bundle, options = {}) {
  var _a;
  if (!bundle || bundle.type !== 'simplebeacon-quality-security-export') return bundle;
  const report =
    options.report ||
    bundle.report ||
    (((_a = bundle.summary) === null || _a === void 0 ? void 0 : _a.gateValidatedPageSpecs)
      ? {
          pageSampleSchemaPassed: parseNumeric(String(bundle.summary.gateValidatedPageSpecs).split('/')[0]),
          pageSampleSchemaChecked: parseNumeric(String(bundle.summary.gateValidatedPageSpecs).split('/')[1]),
        }
      : null);
  return buildQualityExportBundle({
    coverage: bundle.coverage,
    security: bundle.security,
    quality: bundle.quality,
    npmAudit: bundle.npmAudit,
    report,
  });
}
/**
 * Build npm audit csv.
 * @param {any} audit
 * @returns {any}
 */
export function buildNpmAuditCsv(audit) {
  if (!audit || audit.error) return null;
  const vulnerabilities = audit.vulnerabilities || audit.advisories || [];
  if (!vulnerabilities.length) return null;
  const header = ['severity', 'package', 'title', 'url'];
  const rows = vulnerabilities.map((v) =>
    [v.severity || '', v.component || v.name || v.module_name || '', v.title || v.overview || '', v.url || '']
      .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}
/**
 * Build quality summary csv.
 * @param {any} bundle
 * @returns {any}
 */
export function buildQualitySummaryCsv(bundle) {
  if (!(bundle === null || bundle === void 0 ? void 0 : bundle.summary)) return null;
  const header = ['metric', 'value'];
  const rows = Object.entries(bundle.summary).map(([key, value]) =>
    [key, value == null ? '' : String(value)].map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  );
  return [header.join(','), ...rows].join('\n');
}
/**
 * Build quality csv.
 * @param {Object} options
 * @param {any} npmAudit }
 * @returns {any}
 */
export function buildQualityCsv({ bundle, npmAudit } = {}) {
  const vulnCsv = buildNpmAuditCsv(npmAudit);
  if (vulnCsv) return vulnCsv;
  return buildQualitySummaryCsv(bundle);
}
/**
 * Quality export filename.
 * @param {any} ext
 * @returns {any}
 */
export function qualityExportFilename(ext = 'json') {
  const stamp = new Date().toISOString().slice(0, 10);
  if (ext === 'csv') return `quality-security-metrics-${stamp}.csv`;
  return `quality-security-export-${stamp}.json`;
}
