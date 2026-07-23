/**
 * Browser mirror of roadmap export sanitization (keep in sync with roadmap-export-sanitize.js).
 */

import { redactProjectPathForExport } from './quality-export.browser.js?v=20260716cachefix1';

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

const SIMPLEBEACON_ROADMAP_MARKERS = [
  /docker-compose\.phase2\.yml/i,
  /1000\/1000/i,
  /v1-internal/i,
  /simplebeacon:deploy/i,
  /verify:v1-internal-profile/i,
  /verify:production-deploy/i,
  /LLAMA_CPP_BIN/i,
  /simplebeacon\.ai/i,
  /npm run test:coverage/i,
  /PAGE_SAMPLE_SPECS/i,
  /dashboard-stub-api/i,
  /REQUIRE_AUTH production profile/i,
  /Istanbul coverage in CI/i
];

const BENCHMARK_TEMPLATE_PHRASES = [
  /Complete remaining sprint deliverables/i,
  /Define enterprise scope only after v1/i,
  /Improve documentation coverage/i,
  /Expand Jest\/Istanbul/i,
  /enterprise diligence thresholds/i,
  /critical server paths/i,
  /Sprint \d+:\s/i,
  /Stub APIs & Tests/i,
  /Honest Dashboard Data/i,
  /Production Profile/i,
  /phase2-smoke/i,
  /0\/50 page samples/i
];

const INTENTIONAL_MIRROR_PAIRS = [
  ['complete-scan-artifact-profile.js', 'complete-scan-artifact-profile.browser.js']
];

/**
 * Matches roadmap template.
 * @param {string} text
 * @returns {any}
 */
function matchesRoadmapTemplate(text) {
  const value = String(text || '');
  return SIMPLEBEACON_ROADMAP_MARKERS.some((re) => re.test(value))
    || BENCHMARK_TEMPLATE_PHRASES.some((re) => re.test(value));
}

/**
 * Is benchmark product narrative.
 * @param {string} text
 * @returns {any}
 */
function isBenchmarkProductNarrative(text) {
  const value = String(text || '');
  return matchesRoadmapTemplate(value)
    || /simplebeacon-platform/i.test(value)
    || /SOC 2/i.test(value)
    || /\btest coverage \([0-9.]+%\)/i.test(value)
    || (/\b\d{2,3}\.[0-9]+%\b/.test(value) && /coverage|compliance/i.test(value));
}

/**
 * Infer scan target root from hints.
 * @param {any} roadmap
 * @param {Object} options
 * @returns {any}
 */
function inferScanTargetRootFromHints(roadmap, options = {}) {
  const filename = String(options.exportFilename || options.filename || '').toLowerCase();
  if (!filename.includes('github-cache')) return '';

  const slugMatch = filename.match(/github-cache[-_]([a-z0-9._-]+?)(?:-\d{4}-\d{2}-\d{2}|\(\d+\)|\.json)/i);
  if (!slugMatch) return '';

  const cloneName = slugMatch[1];
  const sourceRoot = normalizeExportPath(roadmap?.sourceProjectPath || roadmap?.projectRoot || '');
  if (isBenchmarkScanTargetRoot(sourceRoot)) return '';

  const platformRoot = resolveProductPlatformRoot(`${sourceRoot.replace(/\/$/, '')}/github-cache/${cloneName}`)
    || sourceRoot;
  return `${platformRoot.replace(/\/$/, '')}/github-cache/${cloneName}`;
}

/**
 * Resolve benchmark project label.
 * @param {any} scanTargetRoot
 * @returns {any}
 */
function resolveBenchmarkProjectLabel(scanTargetRoot) {
  const parts = normalizeExportPath(scanTargetRoot).split('/');
  return parts[parts.length - 1] || 'oss-benchmark-clone';
}

/**
 * Sanitize project identity for benchmark.
 * @param {any} next
 * @param {any} scanTargetRoot
 * @param {any} misscopedPlatformWalk
 * @returns {any}
 */
function sanitizeProjectIdentityForBenchmark(next, scanTargetRoot, misscopedPlatformWalk) {
  const label = resolveBenchmarkProjectLabel(scanTargetRoot);
  const title = misscopedPlatformWalk
    ? `${label} (benchmark target — platform walk mis-scope)`
    : `${label} (OSS benchmark clone)`;
  next.projectTitle = title;
  next.projectName = label;
  if (next.projectOverview) {
    next.projectOverview = {
      ...next.projectOverview,
      projectName: label,
      completionRate: null,
      overallProgress: misscopedPlatformWalk ? 'Mis-scoped platform walk' : 'Benchmark scan',
      projectHealth: 'Benchmark hygiene',
      developmentVelocity: 'Filesystem scan',
      teamProductivity: 'OSS clone comparison'
    };
  }
  return next;
}

/**
 * Normalize export path.
 * @param {string} projectPath
 * @returns {any}
 */
function normalizeExportPath(projectPath) {
  return String(projectPath || '').replace(/\\/g, '/');
}

/**
 * Dedupe roadmap export notes.
 * @param {Array} notes
 * @returns {any}
 */
function dedupeRoadmapExportNotes(notes = []) {
  const seen = new Set();
  const out = [];
  for (const note of notes) {
    const normalized = String(note).replace(/\s+/g, ' ').trim().toLowerCase();
    const scopeKey = /mis-scoped complete-scan export/i.test(normalized)
      ? 'benchmark-misscope-note'
      : /v1-internal deploy block/i.test(normalized)
        ? 'benchmark-v1-note'
        : normalized;
    if (seen.has(scopeKey)) continue;
    seen.add(scopeKey);
    out.push(String(note));
  }
  return out.slice(0, 10);
}

/**
 * Is stale empty codebase metrics.
 * @param {Array} metrics
 * @returns {any}
 */
function isStaleEmptyCodebaseMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') return true;
  const loc = metrics.totalLinesOfCode ?? 0;
  const cov = metrics.testCoverage ?? 0;
  const docs = metrics.documentation?.totalDocs ?? 0;
  return loc === 0 && cov === 0 && docs === 0;
}

/**
 * Is absolute export path.
 * @param {any} value
 * @returns {any}
 */
function isAbsoluteExportPath(value) {
  const normalized = normalizeExportPath(value);
  return /^[a-zA-Z]:\//.test(normalized)
    || normalized.startsWith('/Users/')
    || normalized.startsWith('/home/')
    || /CascadeProjects/i.test(normalized);
}

/**
 * Redact roadmap subpath.
 * @param {any} value
 * @param {any} label
 * @returns {any}
 */
function redactRoadmapSubpath(value, label) {
  const normalized = normalizeExportPath(value);
  if (!normalized || !isAbsoluteExportPath(normalized)) return normalized;
  const parts = normalized.split('/');
  const labelIdx = parts.findIndex((part) => part.toLowerCase() === String(label).toLowerCase());
  if (labelIdx >= 0) {
    return parts.slice(labelIdx).join('/');
  }
  return label;
}

/**
 * Redact product roadmap paths.
 * @param {any} roadmap
 * @param {any} label
 * @returns {any}
 */
function redactProductRoadmapPaths(roadmap, label) {
/**
 * Redact root.
 * @param {any} value
 * @returns {any}
 */
  const redactRoot = (value) => redactProjectPathForExport(value, label);
/**
 * Redact sub.
 * @param {any} value
 * @returns {any}
 */
  const redactSub = (value) => redactRoadmapSubpath(value, label);

  const next = { ...roadmap };
  for (const field of ['sourceProjectPath', 'platformRoot', 'scanTargetRoot', 'requestedScanRoot', 'projectRoot', 'codeAnalysisRoot']) {
    if (next[field]) next[field] = redactRoot(next[field]);
  }
  if (next.projectStructure) {
    const mainCategories = next.projectStructure.mainCategories
      ? Object.fromEntries(Object.entries(next.projectStructure.mainCategories).map(([key, category]) => [
        key,
        {
          ...category,
          path: redactSub(category.path || `${label}/${key}`)
        }
      ]))
      : next.projectStructure.mainCategories;
    next.projectStructure = {
      ...next.projectStructure,
      projectRoot: redactRoot(next.projectStructure.projectRoot),
      platformRoot: redactRoot(next.projectStructure.platformRoot),
      mainCategories
    };
  }
  return next;
}

/**
 * Is stale roadmap coverage metrics.
 * @param {Array} metrics
 * @returns {any}
 */
function isStaleRoadmapCoverageMetrics(metrics = {}) {
  if (metrics.testCoverage == null && metrics.lineCoverage == null) return false;
  return metrics.jestTests == null && metrics.jestSuites == null;
}

/**
 * Strip fiction coverage from text.
 * @param {string} text
 * @returns {any}
 */
function stripFictionCoverageFromText(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = text
    .replace(/Test coverage at \d+(?:\.\d+)?%\s*[—–-][^.]*\.?/gi, 'Test coverage requires live Jest/Istanbul — not inferred by roadmap LLM.')
    .replace(/test coverage remains at \d+(?:\.\d+)?%[^.]*\.?/gi, 'Test coverage was not measured in this scan — run npm test with Istanbul for baseline.')
    .replace(/The current \d+(?:\.\d+)?% test coverage[^.]*\.?/gi, 'Live test coverage was not measured in this scan — pair with gate Jest output before citing % in handoffs.')
    .replace(/(?:Improve|improve) test coverage to at least \d+(?:\.\d+)?%[^.]*\.?/gi, 'Improve test coverage — establish live Jest/Istanbul baseline before citing % targets.')
    .replace(/Test coverage \(\d+(?:\.\d+)?%\)[^.]*\./gi, '')
    .replace(/high test coverage \(\d+(?:\.\d+)?%\)/gi, 'filesystem-scan metrics (coverage not cited)')
    .replace(/current test coverage \(\d+(?:\.\d+)?%\)/gi, 'coverage requires live Jest run')
    .replace(/(?:^|\*\s)[^*\n]*test coverage[^*\n]*\d+(?:\.\d+)?%[^*\n]*/gim,
      '* Test coverage percentages require live Jest/Istanbul — not inferred by roadmap LLM.')
    .replace(/\b\d{1,3}(?:\.\d+)?%\b(?: is above the recommended threshold of \d+%)?[^.]*\./gi, (match) =>
      (/coverage/i.test(match)
        ? 'Coverage percentages require live Jest/Istanbul — not inferred by roadmap LLM.'
        : match));
  if (/SOC 2/i.test(text) && /\d+(?:\.\d+)?%/.test(text)) {
    out = out.replace(
      /Test coverage \(\d+(?:\.\d+)?%\) supports SOC 2[^.]*\./i,
      'SOC 2 change-management evidence requires Simplebeacon gate scans — not roadmap-inferred coverage %.'
    );
  }
  out = out
    .replace(/Moderate risk associated with low(?: test coverage)?/gi,
      'Moderate risk — live test coverage not measured in this scan (pair with gate Jest output).')
    .replace(/high risk associated with low test coverage/gi,
      'maintainability risk until live Jest/Istanbul baseline is established')
    .replace(/address the maintainability risk until live Jest\/Istanbul baseline is established and lack of documentation coverage/gi,
      'establish live Jest/Istanbul and documentation baselines before compliance sign-off')
    .replace(/prioritizing test coverage improvements,\s*/gi,
      'establishing a live Jest baseline, ');
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Resolve gate inventory totals.
 * @param {number} gateReport
 * @param {any} hygiene
 * @returns {any}
 */
function resolveGateInventoryTotals(gateReport, hygiene = null) {
  const repositoryFilesTotal = gateReport?.repositoryFilesTotal
    ?? gateReport?.repositoryInventory?.totalFiles
    ?? hygiene?.gateRepositoryFilesTotal
    ?? null;
  const credentialScanned = gateReport?.credentialScanned
    ?? gateReport?.productionLeakScanned
    ?? gateReport?.scanScope?.productionDirsScanned
    ?? hygiene?.credentialScanned
    ?? hygiene?.contentFilesScanned
    ?? null;
  return { repositoryFilesTotal, credentialScanned };
}

/**
 * Resolve roadmap gate context.
 * @param {any} roadmap
 * @param {Object} options
 * @returns {any}
 */
function resolveRoadmapGateContext(roadmap, options = {}) {
  const gateReport = options.gateReport || {};
  const hygiene = roadmap?.hygieneSummary || {};
  const scanScope = roadmap?.scanScope || {};
  const { repositoryFilesTotal: gateTotalFromReport, credentialScanned: credFromReport } = resolveGateInventoryTotals(
    gateReport,
    hygiene
  );
  const repositoryFilesTotal = options.repositoryFilesTotal
    ?? gateTotalFromReport
    ?? scanScope.gateRepositoryFilesTotal
    ?? null;
  const credentialScanned = credFromReport;
  const contentScanned = gateReport.scanScope?.fullDirectoryStats?.contentScanned
    ?? gateReport.scanScope?.fullDirectoryStats?.filesContentScanned
    ?? gateReport.credentialScanned
    ?? gateReport.productionLeakScanned
    ?? hygiene.contentFilesScanned
    ?? hygiene.credentialScanned
    ?? null;
  const gateProfile = gateReport.scanScope?.profile
    ?? scanScope.gateRuleBundleProfile
    ?? hygiene.gateRuleBundleProfile
    ?? null;
  const fictionJsonFilesScanned = gateReport.fictionJsonFilesScanned
    ?? gateReport.scanScope?.fictionJsonFilesScanned
    ?? hygiene.fictionJsonFilesScanned
    ?? null;
  const fictionSampleFilesScanned = gateReport.fictionSampleFilesScanned
    ?? gateReport.mockSampleFiles
    ?? gateReport.scanScope?.fictionSampleFilesScanned
    ?? hygiene.fictionSampleFilesScanned
    ?? null;
  const gatePass = gateReport.gate?.pass ?? hygiene.gatePass ?? null;
  const blockingCount = gateReport.gate?.blockingCount
    ?? gateReport.issueCount
    ?? hygiene.blockingCount
    ?? null;
  const jestBaselineChecked = gateReport.jestBaselineChecked === false
    || hygiene.jestBaselineChecked === false
    ? false
    : null;
  const effectiveGateReport = Object.keys(gateReport).length > 0 ? gateReport : {
    repositoryFilesTotal,
    credentialScanned,
    fictionJsonFilesScanned,
    fictionSampleFilesScanned,
    jestBaselineChecked,
    ...(gatePass != null ? { gate: { pass: gatePass, blockingCount } } : {}),
    ...(gateProfile ? { scanScope: { profile: gateProfile } } : {})
  };
  return {
    gateReport: effectiveGateReport,
    repositoryFilesTotal,
    credentialScanned,
    contentScanned,
    gateProfile,
    fictionJsonFilesScanned,
    fictionSampleFilesScanned,
    gatePass,
    blockingCount,
    jestBaselineChecked
  };
}

/**
 * Has fiction coverage in strategic insights.
 * @param {Array} insights
 * @returns {any}
 */
function hasFictionCoverageInStrategicInsights(insights) {
  if (!insights || typeof insights !== 'object') return false;
  const sm = insights.sourceMetrics;
  if (sm && (sm.testCoverage != null || sm.lineCoverage != null)) return true;
  const parts = [
    insights.executiveSummary,
    insights.llmSummary,
    insights.complianceNarrative,
    ...(insights.riskAssessment?.riskFactors || []).flatMap((f) => [f.description, f.recommendation])
  ].filter(Boolean);
  const blob = parts.join('\n');
  return /test coverage[^.\n]{0,80}\d+(?:\.\d+)?%/i.test(blob)
    || /coverage[^.\n]{0,40}\d+(?:\.\d+)?%/i.test(blob)
    || /\d+(?:\.\d+)?%[^.\n]{0,40}coverage/i.test(blob);
}

/**
 * Sanitize product strategic insights for export.
 * @param {Array} insights
 * @returns {any}
 */
function sanitizeProductStrategicInsightsForExport(insights) {
  if (!insights || typeof insights !== 'object') return insights;
  const next = { ...insights };

  if (next.sourceMetrics) {
    next.sourceMetrics = {
      ...next.sourceMetrics,
      testCoverage: null,
      lineCoverage: null,
      testCoverageNote: 'Coverage % stripped on export — pair with live Jest result or gate JSON for handoff evidence.'
    };
  }

  for (const field of ['executiveSummary', 'llmSummary', 'complianceNarrative']) {
    if (typeof next[field] === 'string') {
      next[field] = stripFictionCoverageFromText(next[field]);
    }
  }

  if (next.riskAssessment?.riskFactors) {
    next.riskAssessment = {
      ...next.riskAssessment,
      riskFactors: next.riskAssessment.riskFactors.map((factor) => {
        const text = `${factor.description || ''} ${factor.recommendation || ''}`;
        if (!/\d+(?:\.\d+)?%/.test(text) || !/coverage/i.test(text)) return factor;
        return {
          ...factor,
          description: stripFictionCoverageFromText(factor.description || ''),
          recommendation: stripFictionCoverageFromText(factor.recommendation || '')
        };
      })
    };
  }

  if (Array.isArray(next.recommendations)) {
    next.recommendations = next.recommendations.map((rec) => {
      if (!rec || typeof rec !== 'object' || typeof rec.action !== 'string') return rec;
      if (!/test coverage/i.test(rec.action) || !/\d+(?:\.\d+)?%/.test(rec.action)) return rec;
      return { ...rec, action: stripFictionCoverageFromText(rec.action) };
    });
  }

  next.llmAdvisoryOnly = true;
  const disclaimer = String(next.llmDisclaimer || '').trim();
  next.llmDisclaimer = disclaimer.includes('Coverage percentages')
    ? disclaimer
    : `${disclaimer} Coverage percentages in LLM fields are not handoff evidence unless paired with live Jest output.`.trim();

  return next;
}

/**
 * Sanitize product coverage for export.
 * @param {any} roadmap
 * @returns {any}
 */
function sanitizeProductCoverageForExport(roadmap) {
  const metrics = roadmap.progressMetrics?.metrics;
  const staleProgressMetrics = isStaleRoadmapCoverageMetrics(metrics);
  const fictionInInsights = hasFictionCoverageInStrategicInsights(roadmap.strategicInsights);
  const needsCoverageSanitize = staleProgressMetrics || fictionInInsights;

  if (!needsCoverageSanitize) {
    const next = {
      ...roadmap,
      coverageEvidenceSource: roadmap.coverageEvidenceSource
        ?? (metrics?.testCoverage != null ? 'jest-coverage-summary' : null)
    };
    if (next.strategicInsights) {
      next.strategicInsights = sanitizeProductStrategicInsightsForExport(next.strategicInsights);
    }
    return next;
  }

  const next = { ...roadmap };
  if (staleProgressMetrics && next.progressMetrics?.metrics) {
    next.progressMetrics = {
      ...next.progressMetrics,
      metrics: {
        ...next.progressMetrics.metrics,
        testCoverage: null,
        lineCoverage: null,
        branchCoverage: null,
        testCoverageNote: 'Coverage % omitted — no live Jest baseline paired in this scan; run npm test with Istanbul before citing in handoffs.'
      }
    };
  }
  if (next.strategicInsights) {
    next.strategicInsights = sanitizeProductStrategicInsightsForExport(next.strategicInsights);
  }
  next.coverageEvidenceSource = 'omitted-stale-prior';
  return next;
}

/**
 * Build product roadmap hygiene summary.
 * @param {any} roadmap
 * @param {string} gateContext
 * @returns {any}
 */
function buildProductRoadmapHygieneSummary(roadmap, gateContext = {}) {
/**
 * Jest feature.
 * @param {any} roadmap.codeAnalysis?.features || []
 * @returns {any}
 */
  const jestFeature = (roadmap.codeAnalysis?.features || []).find((f) => /jest test files/i.test(String(f?.name || '')));
  const { repositoryFilesTotal: gateTotal, credentialScanned, contentScanned, gateProfile,
    fictionJsonFilesScanned, fictionSampleFilesScanned, gatePass, blockingCount, jestBaselineChecked } = gateContext;
  return {
    roadmapAuditFiles: roadmap.codeAnalysis?.structure?.totalFiles ?? null,
    gateRepositoryFilesTotal: gateTotal,
    sprintCompletionRate: roadmap.executiveSummary?.completionRate ?? null,
    coverageEvidenceSource: roadmap.coverageEvidenceSource
      ?? (roadmap.progressMetrics?.metrics?.testCoverage != null ? 'jest-coverage-summary' : 'none'),
    apiRouteCount: roadmap.codeAnalysis?.aiIntegration?.apiRouteCount
      ?? roadmap.aiIntegration?.apiRouteCount
      ?? null,
    jestFilesOnDisk: jestFeature?.count ?? null,
    ...(credentialScanned != null ? { credentialScanned } : {}),
    ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
    ...(gateTotal != null && credentialScanned != null && gateTotal > credentialScanned
      ? { gateMetadataOnlyFiles: gateTotal - credentialScanned }
      : {}),
    ...(fictionJsonFilesScanned != null ? { fictionJsonFilesScanned } : {}),
    ...(fictionSampleFilesScanned != null ? { fictionSampleFilesScanned } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    ...(gatePass != null ? { gatePass } : {}),
    ...(blockingCount != null ? { blockingCount } : {}),
    ...(jestBaselineChecked === false ? { jestBaselineChecked: false } : {}),
    roadmapHealthStatus: roadmap.roadmapHealthStatus || 'product-advisory',
    attestationNote: 'Filesystem roadmap + LLM advisory — gate JSON is source of truth for vendor handoff.'
  };
}

/**
 * Build product roadmap scan scope.
 * @param {any} scanScope
 * @param {any} roadmap
 * @param {string} gateContext
 * @returns {any}
 */
function buildProductRoadmapScanScope(scanScope, roadmap, gateContext = {}) {
  const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
  return {
    ...(scanScope || {}),
    resultsViewScope: 'filesystem-roadmap-advisory',
    securityHandoffEligible: false,
    ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    roadmapNote: scanScope?.roadmapNote
      || roadmap?.scanScope?.roadmapNote
      || 'Roadmap metrics are filesystem-derived — strategicInsights LLM narrative is advisory only.'
  };
}

/**
 * Sanitize product development phases.
 * @param {Array} phases
 * @param {Array} codeAnalysis
 * @returns {any}
 */
function sanitizeProductDevelopmentPhases(phases, codeAnalysis) {
  if (!Array.isArray(phases)) return phases;
/**
 * Jest feature.
 * @param {any} codeAnalysis?.features || []
 * @returns {any}
 */
  const jestFeature = (codeAnalysis?.features || []).find((f) => /jest test files/i.test(String(f?.name || '')));
  const testCount = jestFeature?.count;
  if (testCount == null) return phases;
  return phases.map((phase) => {
    if (!/Sprint 2/i.test(String(phase.phase || ''))) return phase;
/**
 * Features.
 * @param {any} phase.features || []
 * @returns {any}
 */
    const features = (phase.features || []).map((entry) => {
      const text = String(entry);
      if (/tests pending/i.test(text)) {
        return `${testCount} test files on disk (run Jest for live suite count)`;
      }
      return entry;
    });
    return features.some((feature, index) => feature !== phase.features?.[index])
      ? { ...phase, features }
      : phase;
  });
}

/**
 * Build product roadmap export notes.
 * @param {any} roadmap
 * @param {string} context
 * @returns {any}
 */
function buildProductRoadmapExportNotes(roadmap, context = {}) {
  const notes = [
    'securityHandoffEligible is false — roadmap is filesystem/LLM advisory; gate JSON is required for vendor security handoff.',
    'Absolute scan paths are redacted to project label in operator exports.'
  ];
  if (roadmap.coverageEvidenceSource === 'omitted-stale-prior') {
    notes.push('progressMetrics coverage % removed — no Jest baseline label was paired in this scan (likely prior-progress or disk cache).');
  }
  if (roadmap.strategicInsights?.llmAdvisoryOnly) {
    notes.push('strategicInsights LLM narrative is advisory — deterministic codeAnalysis and gate exports are source of truth.');
  }
  if (roadmap.rejectedFiction?.warning) {
    notes.push('rejectedFiction block documents claims this scanner does not produce — do not cite LLM coverage % in compliance handoffs.');
  }
  const repoTotal = context.repositoryFilesTotal ?? null;
  const auditFiles = roadmap.codeAnalysis?.structure?.totalFiles;
  const credentialScanned = context.credentialScanned ?? null;
  const gateProfile = context.gateProfile ?? null;
  const fictionJsonFilesScanned = context.fictionJsonFilesScanned ?? null;
  const fictionSampleFilesScanned = context.fictionSampleFilesScanned ?? null;
  const gatePass = context.gatePass ?? null;
  const blockingCount = context.blockingCount ?? null;
  const jestBaselineChecked = context.jestBaselineChecked;
  if (repoTotal != null && auditFiles != null && repoTotal !== auditFiles) {
    notes.push(
      `codeAnalysis.structure.totalFiles (${Number(auditFiles).toLocaleString()}) is roadmap audit scope — gate repository inventory is ${Number(repoTotal).toLocaleString()} paths.`
    );
  }
  if (repoTotal != null && credentialScanned != null && credentialScanned < repoTotal) {
    notes.push(
      `CRED/LEAK rules scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(repoTotal - credentialScanned).toLocaleString()} metadata-only path(s) in gate inventory of ${Number(repoTotal).toLocaleString()}.`
    );
  }
  if (fictionJsonFilesScanned != null && fictionSampleFilesScanned != null
    && fictionJsonFilesScanned > fictionSampleFilesScanned) {
    notes.push(
      // simplebeacon:production-leak-intent - legitimate KPI reference for roadmap reporting
      `DATA-002 evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON path(s) — ${Number(fictionSampleFilesScanned).toLocaleString()} *-sample.json KPI file(s) matched.`
    );
  }
  if (gateProfile) {
    notes.push(`Gate rule bundle profile: ${gateProfile} — pair roadmap advisory with json/simplebeacon-gate.json for handoff evidence.`);
  }
  if (gatePass === false && (blockingCount ?? 0) > 0) {
    notes.push(
      `Gate FAIL — ${Number(blockingCount).toLocaleString()} blocking finding(s) — roadmap advisory does not clear production-path gate; see json/simplebeacon-gate.json.`
    );
  }
  if (roadmap.coverageEvidenceSource === 'omitted-stale-prior'
    || jestBaselineChecked === false) {
    notes.push('Roadmap scan did not pair live Jest — use gate/complete scan for test attestation.');
  }
  notes.push('Sprint completion % is filesystem-derived — not vendor handoff clearance.');
  return dedupeRoadmapExportNotes(notes).slice(0, 12);
}

/**
 * Sanitize product roadmap export.
 * @param {any} next
 * @param {Object} options
 * @returns {any}
 */
function sanitizeProductRoadmapExport(next, options = {}) {
  const rawPath = options.requestedProjectPath
    || options.projectPath
    || next.sourceProjectPath
    || next.platformRoot
    || '';
  const label = projectLabelFromPath(rawPath);

  let roadmap = redactProductRoadmapPaths(next, label);
  roadmap = sanitizeProductCoverageForExport(roadmap);

  if (roadmap.developmentPhases) {
    roadmap.developmentPhases = sanitizeProductDevelopmentPhases(
      roadmap.developmentPhases,
      roadmap.codeAnalysis
    );
  }

  if (isStaleEmptyCodebaseMetrics(roadmap.codebaseMetrics)) {
    delete roadmap.codebaseMetrics;
  }
  if (roadmap.projectStructure && roadmap.codeAnalysis?.structure) {
    const walkFiles = roadmap.projectStructure.totalFiles;
    const auditFiles = roadmap.codeAnalysis.structure.totalFiles;
    if (walkFiles != null && auditFiles != null && walkFiles !== auditFiles) {
      roadmap.projectStructure = {
        ...roadmap.projectStructure,
        note: `Top-level categories only (${walkFiles} immediate files walked) — codeAnalysis.structure.totalFiles (${auditFiles}) is audit-scoped inventory for sprint metrics.`
      };
    }
  }

  roadmap.exportNormalized = true;
  roadmap.exportSanitized = true;
  roadmap.scanTargetProfile = 'product';
  roadmap.securityHandoffEligible = false;
  roadmap.handoffEligible = false;
  roadmap.roadmapHealthStatus = roadmap.roadmapHealthStatus || 'product-advisory';
  const gateContext = resolveRoadmapGateContext(roadmap, options);
  roadmap.scanScope = buildProductRoadmapScanScope(roadmap.scanScope, roadmap, gateContext);
  roadmap.hygieneSummary = buildProductRoadmapHygieneSummary(roadmap, gateContext);
  roadmap.exportNotes = buildProductRoadmapExportNotes(roadmap, gateContext);

  return roadmap;
}

/**
 * Build benchmark roadmap export notes.
 * @param {Array} existingNotes
 * @param {any} misscopedPlatformWalk
 * @returns {any}
 */
function buildBenchmarkRoadmapExportNotes(existingNotes = [], misscopedPlatformWalk = false) {
  const canonical = misscopedPlatformWalk
    ? 'Mis-scoped complete-scan export: roadmap walked Simplebeacon platform root while scan target was github-cache/ clone — re-run after updating Simplebeacon for clone-scoped metrics.'
    : 'Simplebeacon v1-internal deploy block, template sprint phases, and CI recommendations removed or replaced for github-cache/ benchmark target.';
  const filtered = dedupeRoadmapExportNotes(existingNotes).filter((note) => {
    if (misscopedPlatformWalk) return !/mis-scoped complete-scan export/i.test(String(note));
    return !/v1-internal deploy block/i.test(String(note));
  });
  return dedupeRoadmapExportNotes([...filtered, canonical]);
}

/**
 * Normalize roadmap export paths.
 * @param {any} roadmap
 * @param {any} scanTargetRoot
 * @returns {any}
 */
function normalizeRoadmapExportPaths(roadmap, scanTargetRoot = '') {
  const root = normalizeExportPath(scanTargetRoot || roadmap.scanTargetRoot || roadmap.sourceProjectPath || '');
  const next = {
    ...roadmap,
    sourceProjectPath: root || normalizeExportPath(roadmap.sourceProjectPath),
    scanTargetRoot: root || normalizeExportPath(roadmap.scanTargetRoot),
    platformRoot: normalizeExportPath(roadmap.platformRoot || roadmap.productPlatformRoot || ''),
    ...(roadmap.productPlatformRoot
      ? { productPlatformRoot: normalizeExportPath(roadmap.productPlatformRoot) }
      : {})
  };
  if (next.projectStructure) {
    const mainCategories = next.projectStructure.mainCategories
      ? Object.fromEntries(Object.entries(next.projectStructure.mainCategories).map(([key, category]) => [
        key,
        { ...category, path: normalizeExportPath(category.path || '') }
      ]))
      : next.projectStructure.mainCategories;
    next.projectStructure = {
      ...next.projectStructure,
      projectRoot: root || normalizeExportPath(next.projectStructure.projectRoot),
      platformRoot: normalizeExportPath(next.projectStructure.platformRoot || next.platformRoot),
      mainCategories
    };
  }
  return next;
}

/**
 * Phases are equivalent.
 * @param {any} left
 * @param {any} right
 * @returns {any}
 */
function phasesAreEquivalent(left = [], right = []) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Collapse duplicate benchmark phases.
 * @param {any} roadmap
 * @returns {any}
 */
function collapseDuplicateBenchmarkPhases(roadmap) {
  const dev = roadmap.developmentPhases;
  const bench = roadmap.benchmarkSprintModel;
  if (!bench || bench.phasesRef || !Array.isArray(bench.phases)) return roadmap;
  if (!phasesAreEquivalent(dev, bench.phases)) return roadmap;
  const { phases, ...rest } = bench;
  return {
    ...roadmap,
    benchmarkSprintModel: {
      ...rest,
      phasesRef: 'developmentPhases',
      phaseCount: phases.length
    }
  };
}

/**
 * Align project structure inventory.
 * @param {string} projectStructure
 * @param {string} structure
 * @returns {any}
 */
function alignProjectStructureInventory(projectStructure, structure) {
  if (!projectStructure || !structure?.totalFiles) return projectStructure;
  const topLevelSum = projectStructure.totalFiles;
  const needsScopeNote = topLevelSum != null && topLevelSum !== structure.totalFiles;
  return {
    ...projectStructure,
    totalFiles: structure.totalFiles,
    ...(needsScopeNote ? {
      totalFilesTopLevel: topLevelSum,
      inventoryScopeNote: 'totalFiles is full clone inventory; totalFilesTopLevel is immediate category file count only.'
    } : {})
  };
}

/**
 * Sanitize codebase metrics for benchmark.
 * @param {Array} metrics
 * @param {string} structure
 * @returns {any}
 */
function sanitizeCodebaseMetricsForBenchmark(metrics, structure) {
  if (!structure) return metrics;
  const languages = structure.languages && Object.keys(structure.languages).length
    ? structure.languages
    : metrics?.languages;
  return {
    ...metrics,
    totalLinesOfCode: metrics?.totalLinesOfCode || null,
    languages: languages || {},
    testCoverage: null,
    complexity: metrics?.complexity || {},
    documentation: {
      readmeFiles: structure.languages?.['.md'] ?? metrics?.documentation?.readmeFiles ?? 0,
      totalDocs: structure.languages?.['.md'] ?? 0,
      coverage: null
    },
    benchmarkMetricsNote: 'Product codebaseMetrics template omitted on OSS clone — see codeAnalysis.structure.'
  };
}

/**
 * Sanitize ai integration for benchmark.
 * @param {any} aiIntegration
 * @param {any} misscopedPlatformWalk
 * @returns {any}
 */
function sanitizeAiIntegrationForBenchmark(aiIntegration, misscopedPlatformWalk = false) {
  if (!aiIntegration) return aiIntegration;
  if (misscopedPlatformWalk) {
    return {
      ...aiIntegration,
      apiRouteCount: null,
      apis: [],
      notes: 'API route inventory omitted — mis-scoped platform walk on benchmark target.'
    };
  }
  return {
    level: 'inventory-only',
    apis: aiIntegration.apis || [],
    apiRouteCount: aiIntegration.apiRouteCount ?? 0,
    confidence: null,
    notes: aiIntegration.notes || 'No route handlers found under server/ or src/',
    benchmarkAiNote: 'Generic AI capability flags omitted on OSS benchmark clone — route inventory only.'
  };
}

const BENCHMARK_DELIVERY_FICTION = /production readiness|revenue and compliance|unblocks production/i;

/**
 * Sanitize benchmark recommendation items.
 * @param {Array} recommendations
 * @returns {any}
 */
function sanitizeBenchmarkRecommendationItems(recommendations = []) {
  return recommendations.map((rec) => {
    if (!rec || typeof rec !== 'object') return rec;
    const blob = `${rec.estimatedImpact || ''} ${rec.businessValue || ''}`;
    if (!BENCHMARK_DELIVERY_FICTION.test(blob)) return rec;
    return {
      ...rec,
      category: rec.category === 'delivery' ? 'benchmark' : rec.category,
      estimatedImpact: 'Benchmark hygiene comparison only',
      businessValue: 'Accurate OSS baseline — not product deploy evidence'
    };
  });
}

/**
 * Is benchmark scan target root.
 * @param {string} projectPath
 * @returns {any}
 */
function isBenchmarkScanTargetRoot(projectPath) {
  const rel = normalizeExportPath(projectPath).toLowerCase();
  return rel.includes('/github-cache/') || rel.startsWith('github-cache/')
    || rel.includes('/java-ai-vulnerable/') || rel.startsWith('java-ai-vulnerable/');
}

/**
 * Resolve roadmap export context.
 * @param {any} roadmap
 * @param {Object} options
 * @returns {any}
 */
function resolveRoadmapExportContext(roadmap, options = {}) {
  const sourceRoot = normalizeExportPath(
    roadmap?.sourceProjectPath
      || roadmap?.projectRoot
      || roadmap?.projectStructure?.projectRoot
      || ''
  );
  const scanTargetRoot = normalizeExportPath(
    options.scanTargetRoot
    || options.requestedProjectPath
    || roadmap?.scanTargetRoot
    || roadmap?.requestedScanRoot
    || inferScanTargetRootFromHints(roadmap, options)
    || ''
  );
  const benchmarkFromSource = isBenchmarkScanTargetRoot(sourceRoot);
  const benchmarkFromTarget = isBenchmarkScanTargetRoot(scanTargetRoot);
  const productPlatformRoot = benchmarkFromSource || benchmarkFromTarget
    ? resolveProductPlatformRoot(benchmarkFromSource ? sourceRoot : scanTargetRoot)
    : null;
  const misscopedPlatformWalk = benchmarkFromTarget
    && !benchmarkFromSource
    && Boolean(productPlatformRoot)
    && sourceRoot.toLowerCase() === productPlatformRoot.toLowerCase();

  return {
    benchmarkScan: benchmarkFromSource || benchmarkFromTarget,
    scanTargetRoot: scanTargetRoot || (benchmarkFromSource ? sourceRoot : ''),
    productPlatformRoot,
    misscopedPlatformWalk
  };
}

/**
 * Resolve product platform root.
 * @param {string} projectPath
 * @returns {any}
 */
function resolveProductPlatformRoot(projectPath) {
  const normalized = String(projectPath || '').replace(/\\/g, '/');
  const idx = normalized.toLowerCase().indexOf('/github-cache/');
  if (idx <= 0) return null;
  return normalized.slice(0, idx);
}

/**
 * Filter template lines.
 * @param {any} list
 * @returns {any}
 */
function filterTemplateLines(list = []) {
  return (list || []).filter((line) => !matchesRoadmapTemplate(String(line)));
}

/**
 * Filter template recommendations.
 * @param {Array} recs
 * @returns {any}
 */
function filterTemplateRecommendations(recs = []) {
  return (recs || []).filter((item) => {
    const text = typeof item === 'string' ? item : item?.action || '';
    return !matchesRoadmapTemplate(String(text));
  });
}

/**
 * Recommendations need benchmark replace.
 * @param {any} rec
 * @returns {any}
 */
function recommendationsNeedBenchmarkReplace(rec) {
  if (!rec) return true;
  return matchesRoadmapTemplate(JSON.stringify(rec));
}

/**
 * Benchmark recommendations.
 * @returns {any}
 */
function benchmarkRecommendations() {
  return {
    immediate: ['Review OSS clone hygiene — Simplebeacon product deploy steps do not apply to github-cache/ targets'],
    shortTerm: ['Compare findings against ai-platform product scans separately'],
    longTerm: ['Use benchmark clones for engineering comparison only'],
    priorities: {
      high: ['Review OSS clone hygiene — not Simplebeacon product code'],
      medium: ['Re-run Complete scan on ai-platform root for vendor handoff evidence'],
      low: ['Archive or refresh github-cache/ clone when disk space is needed']
    }
  };
}

/**
 * Sanitize strategic insights.
 * @param {Array} insights
 * @param {any} benchmarkScan
 * @returns {any}
 */
function sanitizeStrategicInsights(insights, benchmarkScan) {
  if (!insights || typeof insights !== 'object') return insights;
  const next = { ...insights };

  if (benchmarkScan) {
    const filteredRecs = filterTemplateRecommendations(next.recommendations);
    next.recommendations = sanitizeBenchmarkRecommendationItems(
      filteredRecs.length
        ? filteredRecs
        : [{
          priority: 'LOW',
          category: 'benchmark',
          action: 'Treat roadmap as OSS hygiene comparison — run product scans on ai-platform root',
          estimatedEffort: 'N/A',
          estimatedImpact: 'Avoid mis-applying Simplebeacon sprint fiction',
          businessValue: 'Accurate benchmark baselines'
        }]
    );

    if (next.riskAssessment) {
/**
 * Factors.
 * @param {any} next.riskAssessment.riskFactors || []
 * @returns {any}
 */
      const factors = (next.riskAssessment.riskFactors || []).filter((factor) => {
        const text = `${factor.description || ''} ${factor.recommendation || ''}`;
        return !matchesRoadmapTemplate(text);
      });
      next.riskAssessment = {
        ...next.riskAssessment,
        overallRisk: factors.length ? next.riskAssessment.overallRisk : 'LOW',
        riskFactors: factors.length ? factors : [{
          category: 'benchmark',
          severity: 'low',
          description: 'OSS benchmark clone — product sprint and coverage metrics are not handoff evidence',
          recommendation: 'Run Complete scan and gate on ai-platform root for platform risk assessment',
          estimatedImpact: 'Prevents mis-reading template sprint fiction as clone health'
        }],
        benchmarkRiskNote: 'Product test-coverage and sprint risk factors omitted on github-cache/ clones.'
      };
    }

    if (next.sourceMetrics) {
      next.sourceMetrics = {
        ...next.sourceMetrics,
        testCoverage: null,
        lineCoverage: null,
        completionRate: null,
        featureCompleteness: null,
        immediateActions: filterTemplateLines(next.sourceMetrics.immediateActions),
        shortTermActions: filterTemplateLines(next.sourceMetrics.shortTermActions),
        longTermActions: filterTemplateLines(next.sourceMetrics.longTermActions)
      };
    }

    for (const field of ['executiveSummary', 'llmSummary', 'complianceNarrative']) {
      if (typeof next[field] === 'string' && isBenchmarkProductNarrative(next[field])) {
        next[field] = 'OSS benchmark clone — Simplebeacon product sprint and deploy guidance omitted. Deterministic filesystem metrics remain authoritative.';
      }
    }
    const disclaimer = String(next.llmDisclaimer || '').trim();
    next.llmDisclaimer = disclaimer.includes('Benchmark clone')
      ? disclaimer
      : `${disclaimer} Benchmark clone: ignore Simplebeacon CI/deploy recommendations.`.trim();
  }

  return next;
}

/**
 * Sanitize progress metrics.
 * @param {Array} metrics
 * @param {any} benchmarkScan
 * @param {Array} codeMetrics
 * @param {any} misscopedPlatformWalk
 * @returns {any}
 */
function sanitizeProgressMetrics(metrics, benchmarkScan, codeMetrics, misscopedPlatformWalk = false) {
  if (!metrics || !benchmarkScan) return metrics;
  return {
    ...metrics,
    overall: null,
    phases: { 'OSS filesystem scan': 100 },
    categories: {
      'OSS source': codeMetrics?.codeFiles ? Math.min(100, Math.round(codeMetrics.codeFiles / 20)) : null,
      Documentation: metrics.categories?.Documentation ?? null
    },
    metrics: {
      ...(metrics.metrics || {}),
      jestTests: codeMetrics?.codeFiles != null
        ? `${codeMetrics.testFiles ?? '—'} test files on disk (product Jest gate metric not applicable)`
        : null,
      jestSuites: null,
      pageSamples: 'N/A (Simplebeacon PAGE_SAMPLE_SPECS)',
      testCoverage: null,
      lineCoverage: null,
      branchCoverage: null,
      featureCompleteness: null,
      featureCompletenessNote: 'Sprint completion % reflects Simplebeacon template sprints — not valid for OSS clones; see benchmarkSprintModel.',
      ...(misscopedPlatformWalk ? {
        apiRouteCount: null,
        apiRouteCountNote: 'Simplebeacon platform API route count omitted on mis-scoped benchmark export.'
      } : {})
    }
  };
}

const PRODUCT_INVENTORY_FEATURE_MARKERS = [
  /117\/117/i,
  /dashboard server/i,
  /stub api/i,
  /phase 2 jwt/i,
  /page_sample/i,
  /page samples/i,
  /npm audit wired/i
];

/**
 * Overlay misscoped structure inventory.
 * @param {string} structure
 * @param {string} repositoryFilesTotal
 * @returns {any}
 */
function overlayMisscopedStructureInventory(structure, repositoryFilesTotal) {
  if (!structure || repositoryFilesTotal == null) return structure;
  return {
    ...structure,
    totalFilesRaw: structure.totalFiles,
    totalFiles: repositoryFilesTotal,
    inventoryScopeNote: 'Gate audit file count on github-cache/ clone; platform walk preserved in totalFilesRaw.'
  };
}

/**
 * Sanitize code analysis for benchmark.
 * @param {Array} codeAnalysis
 * @param {any} misscopedPlatformWalk
 * @returns {any}
 */
function sanitizeCodeAnalysisForBenchmark(codeAnalysis, misscopedPlatformWalk = false) {
  if (!codeAnalysis || typeof codeAnalysis !== 'object') return codeAnalysis;
  const next = { ...codeAnalysis };
  if (Array.isArray(next.features)) {
    if (misscopedPlatformWalk) {
      next.features = [];
      next.featuresNote = 'Product feature inventory omitted — roadmap walked Simplebeacon platform root instead of github-cache/ clone.';
    } else {
      next.features = next.features.filter((feature) => {
        const label = String(feature?.label || feature?.name || '');
        if (/1000\/1000/.test(label) || Number(feature?.count) === 1000) return false;
        return !PRODUCT_INVENTORY_FEATURE_MARKERS.some((re) => re.test(label));
      });
      if (!next.features.length) {
        next.featuresNote = 'Product Jest gate metric omitted on OSS benchmark clone.';
      }
    }
  }
  const pairs = next.phase2?.fuzzySimilarity?.pairs;
  if (Array.isArray(pairs)) {
    next.phase2 = {
      ...next.phase2,
      fuzzySimilarity: {
        ...next.phase2.fuzzySimilarity,
        pairs: pairs.map((pair) => {
          const a = String(pair.fileA || '').split('/').pop();
          const b = String(pair.fileB || '').split('/').pop();
          const isMirror = INTENTIONAL_MIRROR_PAIRS.some(([left, right]) =>
            (a === left && b === right) || (a === right && b === left)
          );
          return isMirror
            ? { ...pair, recommendation: 'Intentional CJS/browser mirror — do not merge', intentionalMirror: true }
            : pair;
        })
      }
    };
  }
  return next;
}

/**
 * Sanitize resource estimate for benchmark.
 * @param {any} estimate
 * @returns {any}
 */
function sanitizeResourceEstimateForBenchmark(estimate) {
  if (!estimate || typeof estimate !== 'object') return estimate;
  return {
    ...estimate,
    remainingSprints: 0,
    sprintBreakdown: [],
    budgetNote: 'OSS benchmark clone — internal notional estimate only; product sprint breakdown omitted.'
  };
}

/**
 * Sanitize executive summary for benchmark.
 * @param {any} summary
 * @param {Array} codeMetrics
 * @returns {any}
 */
function sanitizeExecutiveSummaryForBenchmark(summary, codeMetrics) {
  if (!summary || typeof summary !== 'object') return summary;
  return {
    ...summary,
    totalFeatures: null,
    completedFeatures: null,
    plannedFeatures: null,
    completionRate: null,
    projectHealth: 'Benchmark hygiene',
    notes: 'OSS benchmark clone under github-cache/ — not Simplebeacon platform product code. Sprint completion % uses product template signals and is not handoff evidence.',
    codeFilesAnalyzed: codeMetrics?.codeFiles ?? summary.codeFilesAnalyzed
  };
}

/**
 * Sanitize roadmap export.
 * @param {any} roadmap
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeRoadmapExport(roadmap, options = {}) {
  if (!roadmap || roadmap.type !== 'dynamic-project-roadmap-analysis') return roadmap;

  const exportContext = resolveRoadmapExportContext(roadmap, options);
  const {
    benchmarkScan,
    scanTargetRoot,
    productPlatformRoot,
    misscopedPlatformWalk
  } = exportContext;

  let next = { ...roadmap };

  if (!benchmarkScan) {
    return sanitizeProductRoadmapExport(next, options);
  }

  next = normalizeRoadmapExportPaths(next, scanTargetRoot);

  delete next.v1InternalDeploy;
  next.benchmarkScan = true;
  next.scanTargetProfile = 'benchmark-cache';
  next.handoffEligible = false;
  next.roadmapExportProfile = misscopedPlatformWalk ? 'benchmark-misscoped' : 'benchmark-clone';
  next.productPlatformRoot = productPlatformRoot || undefined;
  next.scanTargetRoot = scanTargetRoot || next.sourceProjectPath || next.projectRoot || next.platformRoot;
  next.platformRoot = productPlatformRoot || next.platformRoot || next.scanTargetRoot;
  if (misscopedPlatformWalk) {
    next.misscopedPlatformCodeWalk = true;
    next.codeAnalysisRoot = next.sourceProjectPath || next.codeAnalysisRoot;
  }

  next = sanitizeProjectIdentityForBenchmark(next, next.scanTargetRoot, misscopedPlatformWalk);

  if (misscopedPlatformWalk && options.repositoryFilesTotal != null && next.codeAnalysis?.structure) {
    next.codeAnalysis = {
      ...next.codeAnalysis,
      structure: overlayMisscopedStructureInventory(
        next.codeAnalysis.structure,
        options.repositoryFilesTotal
      )
    };
  }

  if (next.aiIntegration) {
    next.aiIntegration = sanitizeAiIntegrationForBenchmark(next.aiIntegration, misscopedPlatformWalk);
  }

  if (next.recommendations) {
    const rec = next.recommendations;
    const filtered = {
      immediate: filterTemplateLines(rec.immediate),
      shortTerm: filterTemplateLines(rec.shortTerm),
      longTerm: filterTemplateLines(rec.longTerm),
      priorities: {
        high: filterTemplateLines(rec.priorities?.high || rec.immediate),
        medium: filterTemplateLines(rec.priorities?.medium || rec.shortTerm),
        low: filterTemplateLines(rec.priorities?.low || rec.longTerm)
      }
    };
    const hasAny = filtered.immediate.length || filtered.shortTerm.length || filtered.longTerm.length;
    next.recommendations = (hasAny && !recommendationsNeedBenchmarkReplace(filtered))
      ? filtered
      : benchmarkRecommendations();
  } else {
    next.recommendations = benchmarkRecommendations();
  }

  if (next.developmentPhases?.length && matchesRoadmapTemplate(JSON.stringify(next.developmentPhases))) {
    if (!next.developmentPhasesTemplate) {
      next.developmentPhasesTemplate = next.developmentPhases;
    }
    next.developmentPhases = (next.benchmarkSprintModel?.phases || [{
      phase: 'OSS clone filesystem scan',
      status: 'completed',
      progress: 100,
      description: 'github-cache benchmark — Simplebeacon four-sprint product model does not apply',
      features: [
        `${next.codeAnalysis?.structure?.codeFiles ?? '—'} code-like files analyzed`,
        `${next.codeAnalysis?.structure?.totalFiles ?? '—'} files inventoried`
      ],
      milestones: ['Compare against other OSS benchmarks or ai-platform product scans']
    }]).slice(0, 4);
  }

  if (next.implementationPhases?.length) {
    const alreadyBenchmark = next.implementationPhases.length === 1
      && String(next.implementationPhases[0]?.phase || '').toLowerCase().includes('benchmark filesystem');
    if (!alreadyBenchmark) {
      if (!next.implementationPhasesTemplate) {
        next.implementationPhasesTemplate = next.implementationPhases;
      }
      next.implementationPhases = [{
        phase: 'Benchmark filesystem scan',
        status: 'complete',
        items: ['Inventory', 'Dependency graph', 'Fuzzy similarity (informational)']
      }];
    }
  }

  if (next.executiveSummary && typeof next.executiveSummary === 'object') {
    next.executiveSummary = sanitizeExecutiveSummaryForBenchmark(
      next.executiveSummary,
      next.codeAnalysis?.structure
    );
  }

  if (typeof next.llmSummary === 'string' && isBenchmarkProductNarrative(next.llmSummary)) {
    next.llmSummary = 'OSS benchmark clone scan — Simplebeacon product sprint guidance omitted.';
  }

  if (next.projectOverview && (matchesRoadmapTemplate(JSON.stringify(next.projectOverview))
    || /simplebeacon-platform/i.test(JSON.stringify(next.projectOverview)))) {
    next.projectOverview = {
      ...next.projectOverview,
      completionRate: null,
      overallProgress: 'Benchmark scan',
      projectHealth: 'Benchmark hygiene',
      developmentVelocity: 'Filesystem scan',
      teamProductivity: 'OSS clone comparison'
    };
  }

  next.progressMetrics = sanitizeProgressMetrics(
    next.progressMetrics,
    true,
    next.codeAnalysis?.structure,
    misscopedPlatformWalk
  );

  if (next.codeAnalysis) {
    next.codeAnalysis = sanitizeCodeAnalysisForBenchmark(next.codeAnalysis, misscopedPlatformWalk);
  }

  if (next.resourceEstimate) {
    next.resourceEstimate = sanitizeResourceEstimateForBenchmark(next.resourceEstimate);
  }
  if (next.codeAnalysis?.phase2?.resourceEstimate) {
    next.codeAnalysis.phase2.resourceEstimate = sanitizeResourceEstimateForBenchmark(
      next.codeAnalysis.phase2.resourceEstimate
    );
  }

  if (next.projectStructure) {
    next.projectStructure = alignProjectStructureInventory({
      ...next.projectStructure,
      projectRoot: next.scanTargetRoot,
      platformRoot: productPlatformRoot || next.projectStructure.platformRoot,
      note: misscopedPlatformWalk
        ? 'Roadmap walked Simplebeacon platform root while scan target was github-cache/ clone — re-run complete scan for clone-scoped roadmap.'
        : 'Top-level categories only — scanTargetRoot is the OSS clone; platformRoot is ai-platform product root when set.'
    }, next.codeAnalysis?.structure);
  }

  if (next.codebaseMetrics) {
    next.codebaseMetrics = sanitizeCodebaseMetricsForBenchmark(
      next.codebaseMetrics,
      next.codeAnalysis?.structure
    );
  }

  next = collapseDuplicateBenchmarkPhases(next);

  if (next.strategicInsights) {
    next.strategicInsights = sanitizeStrategicInsights(next.strategicInsights, true);
  }

  if (next.developmentPhasesTemplate) {
    next.developmentPhasesTemplateOmitted = true;
    delete next.developmentPhasesTemplate;
  }
  if (next.implementationPhasesTemplate) {
    next.implementationPhasesTemplateOmitted = true;
    delete next.implementationPhasesTemplate;
  }

  next.exportSanitized = true;
  next.exportNormalized = true;
  next.roadmapHealthStatus = misscopedPlatformWalk ? 'benchmark-misscoped-review' : 'benchmark-hygiene';
  next.exportNotes = buildBenchmarkRoadmapExportNotes(next.exportNotes, misscopedPlatformWalk);

  return next;
}
