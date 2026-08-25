// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Browser mirror of ai-problem-analyzer-export-sanitize.js — keep in sync.
 */
const EXPORT_VERSION = '1.3.0';
const RISK_BAND_LEGEND = {
  High: 'critical',
  Elevated: 'high',
  Moderate: 'medium',
  Low: 'low',
};
const TAXONOMY_VERSION = 'final-48-analyzers';
const ANALYSIS_VERSION = '2.0.0';
const SHARED_MITIGATION_THEMES = [
  'Use deterministic evaluation fixtures and regression tests.',
  'Track category-specific metrics in release gates.',
  'Escalate high-risk findings with clear remediation owners.',
];
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
 * Is benchmark path.
 * @param {string} projectPath
 * @returns {any}
 */
function isBenchmarkPath(projectPath) {
  return /\/github-cache\//i.test(String(projectPath || '').replace(/\\/g, '/'));
}
/**
 * Redact path for export.
 * @param {string} rawPath
 * @param {any} projectLabel
 * @returns {any}
 */
function redactPathForExport(rawPath, projectLabel = 'ai-platform') {
  if (rawPath == null || rawPath === '') return rawPath;
  const normalized = String(rawPath).replace(/\\/g, '/');
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
 * Normalize simple beacon branding.
 * @param {any} value
 * @returns {any}
 */
function normalizeSimpleBeaconBranding(value) {
  return String(value !== null && value !== void 0 ? value : '').replace(/\bSimplebeacon\b/g, 'SimpleBeacon');
}
/**
 * Clamp score.
 * @param {any} value
 * @returns {any}
 */
function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric < 0) return 0;
  if (numeric > 100) return 100;
  return Number(numeric.toFixed(2));
}
/**
 * Severity from risk.
 * @param {any} riskScore
 * @returns {any}
 */
function severityFromRisk(riskScore) {
  if (riskScore >= 75) return 'critical';
  if (riskScore >= 55) return 'high';
  if (riskScore >= 35) return 'medium';
  return 'low';
}
/**
 * Infer scoring direction.
 * @param {any} result
 * @returns {any}
 */
function inferScoringDirection(result = {}) {
  const score = Number(result.score);
  if (!Number.isFinite(score)) return 'lower_better';
  const inverted = clampScore(100 - score);
  if (severityFromRisk(inverted) === result.severity && severityFromRisk(clampScore(score)) !== result.severity) {
    return 'higher_better';
  }
  const metrics = result.metrics || [];
  const directions = [...new Set(metrics.map((metric) => metric.direction).filter(Boolean))];
  if (directions.length === 1 && directions[0] === 'higher_better') return 'higher_better';
  return 'lower_better';
}
/**
 * Enrich analyzer result for export.
 * @param {any} result
 * @returns {any}
 */
function enrichAnalyzerResultForExport(result) {
  var _a;
  if (!result || typeof result !== 'object') return result;
  const scoringDirection = result.scoringDirection || inferScoringDirection(result);
  const hasLegacyScore = Number.isFinite(Number(result.score));
  const metricScore = hasLegacyScore
    ? clampScore(result.score)
    : clampScore(
        (_a = result.metricScore) !== null && _a !== void 0
          ? _a
          : scoringDirection === 'higher_better' && Number.isFinite(Number(result.riskScore))
            ? 100 - Number(result.riskScore)
            : result.riskScore
      );
  const riskScore =
    Number.isFinite(Number(result.riskScore)) && !hasLegacyScore
      ? clampScore(result.riskScore)
      : scoringDirection === 'higher_better'
        ? clampScore(100 - metricScore)
        : metricScore;
  const { score: _score, ...rest } = result;
  return {
    ...rest,
    metricScore,
    riskScore,
    scoringDirection,
  };
}
/**
 * Enrich analyzer results for export.
 * @param {Array} results
 * @returns {any}
 */
function enrichAnalyzerResultsForExport(results = []) {
  return results.map(enrichAnalyzerResultForExport);
}
/**
 * Enrich top priority issues for export.
 * @param {Array} issues
 * @param {Array} analyzerResults
 * @returns {any}
 */
function enrichTopPriorityIssuesForExport(issues = [], analyzerResults = []) {
  const byId = new Map(analyzerResults.map((result) => [result.id, result]));
  return issues.map((issue) => {
    var _a, _b, _c, _d;
    const result = byId.get(issue.id);
    const riskScore =
      (_b =
        (_a = issue.priorityScore) !== null && _a !== void 0
          ? _a
          : result === null || result === void 0
            ? void 0
            : result.riskScore) !== null && _b !== void 0
        ? _b
        : null;
    const metricScore =
      (_c = result === null || result === void 0 ? void 0 : result.metricScore) !== null && _c !== void 0 ? _c : null;
    const scoringDirection =
      (_d = result === null || result === void 0 ? void 0 : result.scoringDirection) !== null && _d !== void 0
        ? _d
        : null;
    return {
      ...issue,
      riskScore,
      ...(metricScore != null ? { metricScore } : {}),
      ...(scoringDirection ? { scoringDirection } : {}),
      priorityScore: riskScore,
    };
  });
}
/**
 * Slim mitigation themes.
 * @param {Array} themes
 * @returns {any}
 */
function slimMitigationThemes(themes = []) {
  if (!themes.length) return { sharedThemes: SHARED_MITIGATION_THEMES, categories: [] };
  const categories = themes.map((item) => ({
    categoryId: item.categoryId,
    categoryName: item.categoryName,
  }));
  return { sharedThemes: SHARED_MITIGATION_THEMES, categories };
}
/**
 * Deep redact.
 * @param {number} exportNode
 * @param {any} projectLabel
 * @param {any} depth
 * @returns {any}
 */
function deepRedact(exportNode, projectLabel, depth = 0) {
  if (depth > 8 || exportNode == null) return exportNode;
  if (typeof exportNode === 'string') {
    if (/^[a-zA-Z]:\\/.test(exportNode) || exportNode.includes('CascadeProjects')) {
      return redactPathForExport(exportNode, projectLabel);
    }
    return normalizeSimpleBeaconBranding(exportNode);
  }
  if (Array.isArray(exportNode)) {
    return exportNode.map((childNode) => deepRedact(childNode, projectLabel, depth + 1));
  }
  if (typeof exportNode === 'object') {
    const out = {};
    for (const [key, childNode] of Object.entries(exportNode)) {
      if (['projectRoot', 'projectPath', 'scanTargetRoot', 'platformRoot'].includes(key)) {
        out[key] = redactPathForExport(childNode, projectLabel);
      } else {
        out[key] = deepRedact(childNode, projectLabel, depth + 1);
      }
    }
    return out;
  }
  return exportNode;
}
/**
 * Peak severity from counts.
 * @param {Array} counts
 * @returns {any}
 */
function peakSeverityFromCounts(counts = {}) {
  if ((counts.critical || 0) > 0) return 'critical';
  if ((counts.high || 0) > 0) return 'high';
  if ((counts.medium || 0) > 0) return 'medium';
  if ((counts.low || 0) > 0) return 'low';
  return 'none';
}
/**
 * Reconcile risk summary.
 * @param {any} riskSummary
 * @returns {any}
 */
function reconcileRiskSummary(riskSummary = {}) {
  var _a;
  const severityCounts = riskSummary.severityCounts || {};
  const peakSeverity = peakSeverityFromCounts(severityCounts);
  const overallRiskLevel = riskSummary.overallRiskLevel || 'Low';
  let overallRiskLevelNote = null;
  if (peakSeverity === 'critical' || peakSeverity === 'high') {
    if (overallRiskLevel === 'Low' || overallRiskLevel === 'Moderate') {
      overallRiskLevelNote = `overallRiskLevel is ${overallRiskLevel} (average riskScore ${(_a = riskSummary.averageRiskScore) !== null && _a !== void 0 ? _a : '—'}) — peakSeverity is ${peakSeverity}; review topPriorityIssues.`;
    }
  }
  return {
    ...riskSummary,
    peakSeverity,
    overallRiskLevelBasis: 'average-risk-score',
    riskBandLegend: RISK_BAND_LEGEND,
    ...(overallRiskLevelNote ? { overallRiskLevelNote } : {}),
  };
}
/**
 * Slim architecture for export.
 * @param {any} architecture
 * @param {any} summary
 * @returns {any}
 */
function slimArchitectureForExport(architecture, summary = null) {
  var _a;
  if (!architecture || typeof architecture !== 'object') return null;
  const slim = { ...architecture };
  if (slim.dataCollectionLayer && typeof slim.dataCollectionLayer === 'object') {
    const dcl = { ...slim.dataCollectionLayer };
    delete dcl.selectedMethodDefinitions;
    if (Array.isArray(dcl.selectedIssueIds) && dcl.selectedIssueIds.length) {
      dcl.selectedIssueIdsRef = 'root.selectedIssueIds';
      delete dcl.selectedIssueIds;
    }
    slim.dataCollectionLayer = dcl;
  }
  if (
    Array.isArray(slim.keyDesignPrinciples) &&
    ((_a = summary === null || summary === void 0 ? void 0 : summary.stubCount) !== null && _a !== void 0 ? _a : 0) ===
      0
  ) {
    slim.keyDesignPrinciples = slim.keyDesignPrinciples.filter(
      (principle) => !/contract-valid safe stubs/i.test(String(principle))
    );
  }
  return slim;
}
/**
 * Build hygiene summary.
 * @param {any} summary
 * @param {any} riskSummary
 * @param {any} healthScore
 * @returns {any}
 */
function buildHygieneSummary(summary, riskSummary, healthScore) {
  var _a, _b, _c, _d, _e, _f;
  const execution = (riskSummary === null || riskSummary === void 0 ? void 0 : riskSummary.executionStatus) || {};
  return {
    selectedAnalyzerCount:
      (_a = summary === null || summary === void 0 ? void 0 : summary.selectedIssueCount) !== null && _a !== void 0
        ? _a
        : null,
    measuredCount:
      (_c =
        (_b = riskSummary === null || riskSummary === void 0 ? void 0 : riskSummary.measuredAnalyzerCount) !== null &&
        _b !== void 0
          ? _b
          : execution.measured) !== null && _c !== void 0
        ? _c
        : null,
    insufficientDataCount: (_d = execution.insufficientData) !== null && _d !== void 0 ? _d : null,
    peakSeverity:
      (_e = riskSummary === null || riskSummary === void 0 ? void 0 : riskSummary.peakSeverity) !== null &&
      _e !== void 0
        ? _e
        : null,
    overallRiskLevel:
      (_f = riskSummary === null || riskSummary === void 0 ? void 0 : riskSummary.overallRiskLevel) !== null &&
      _f !== void 0
        ? _f
        : null,
    healthScore: healthScore !== null && healthScore !== void 0 ? healthScore : null,
    attestationNote:
      'healthScore reflects SimpleBeacon gate scan quality — analyzer riskScore/peakSeverity are separate signals.',
  };
}
/**
 * Build export notes.
 * @param {any} analysisResult
 * @param {Object} options
 * @returns {any}
 */
function buildExportNotes(analysisResult, options = {}) {
  var _a, _b;
  const notes = [];
  const risk = (analysisResult === null || analysisResult === void 0 ? void 0 : analysisResult.riskSummary) || {};
  const summary = (analysisResult === null || analysisResult === void 0 ? void 0 : analysisResult.summary) || {};
  const execution = risk.executionStatus || {};
  const totalRun = (execution.measured || 0) + (execution.insufficientData || 0) + (execution.stub || 0);
  if ((execution.insufficientData || 0) > 0) {
    notes.push(
      `${execution.insufficientData} of ${totalRun || summary.selectedIssueCount || '?'} analyzer(s) lacked sufficient input — run codebase or complete scan, then re-run the suite.`
    );
  }
  if ((summary.stubCount || 0) > 0) {
    notes.push(
      `${summary.stubCount} analyzer(s) returned contract stubs — deterministic logic not yet implemented for those IDs.`
    );
  }
  if ((_a = options.context) === null || _a === void 0 ? void 0 : _a.inputKind) {
    notes.push(`Input context: ${options.context.inputKind}.`);
  }
  const hasPeakRisk = risk.peakSeverity === 'critical' || risk.peakSeverity === 'high';
  const healthScore = (_b = options.context) === null || _b === void 0 ? void 0 : _b.healthScore;
  if (hasPeakRisk) {
    const peakParts = [`peakSeverity ${risk.peakSeverity}`];
    if (risk.overallRiskLevelNote) {
      peakParts.push(
        'overallRiskLevel is an average — use topPriorityIssues.riskScore (not metricScore for higher_better analyzers)'
      );
    } else {
      peakParts.push('review topPriorityIssues.riskScore');
    }
    if (healthScore != null) {
      peakParts.push(`gate healthScore ${healthScore} does not override analyzer peakSeverity`);
    }
    notes.push(`${peakParts.join('; ')}.`);
  }
  if (
    ((analysisResult === null || analysisResult === void 0 ? void 0 : analysisResult.coverageGaps) || []).length > 0
  ) {
    const gapCount = analysisResult.coverageGaps.length;
    const insufficient = execution.insufficientData || 0;
    if (insufficient > gapCount) {
      notes.push(
        `${gapCount} prioritized coverage gap(s) listed (${insufficient} total insufficient_data analyzers) — supply missing scan/codebase fields and re-run.`
      );
    } else {
      notes.push(
        `${gapCount} coverage gap(s) listed — supply missing scan/codebase fields to improve measured analyzer count.`
      );
    }
  }
  return [...new Set(notes)].slice(0, 8);
}
/**
 * Build slim payload.
 * @param {any} sanitized
 * @param {any} summary
 * @returns {any}
 */
function buildSlimPayload(sanitized, summary) {
  var _a, _b, _c, _d, _e, _f;
  const source = sanitized.payload || {};
  return {
    type: 'ai-problem-analyzer-suite',
    analysisVersion: source.analysisVersion || ANALYSIS_VERSION,
    taxonomyVersion: source.taxonomyVersion || TAXONOMY_VERSION,
    selectedIssueCount:
      (_b =
        (_a = summary === null || summary === void 0 ? void 0 : summary.selectedIssueCount) !== null && _a !== void 0
          ? _a
          : source.selectedIssueCount) !== null && _b !== void 0
        ? _b
        : null,
    selectedIssueIdsRef: 'root.selectedIssueIds',
    registrySummary: {
      catalogSize:
        (_d = (_c = source.registry) === null || _c === void 0 ? void 0 : _c.length) !== null && _d !== void 0
          ? _d
          : 48,
      implementedInRun:
        (_e = summary === null || summary === void 0 ? void 0 : summary.implementedCount) !== null && _e !== void 0
          ? _e
          : null,
      stubsInRun:
        (_f = summary === null || summary === void 0 ? void 0 : summary.stubCount) !== null && _f !== void 0 ? _f : 0,
      note: 'Full ANALYZER_CATALOG omitted from exports — use dashboard suite reference or docs/archive/historical/planning/ai-problem-analyzer-suite/.',
    },
  };
}
/**
 * Resolve selected issue ids.
 * @param {any} sanitized
 * @returns {any}
 */
function resolveSelectedIssueIds(sanitized) {
  var _a, _b, _c;
  if (Array.isArray(sanitized.selectedIssueIds) && sanitized.selectedIssueIds.length) {
    return sanitized.selectedIssueIds;
  }
  const fromPayload = (_a = sanitized.payload) === null || _a === void 0 ? void 0 : _a.selectedIssueIds;
  if (Array.isArray(fromPayload) && fromPayload.length) return fromPayload;
  const fromArch =
    (_c = (_b = sanitized.architecture) === null || _b === void 0 ? void 0 : _b.dataCollectionLayer) === null ||
    _c === void 0
      ? void 0
      : _c.selectedIssueIds;
  if (Array.isArray(fromArch) && fromArch.length) return fromArch;
  return (sanitized.analyzerResults || []).map((result) => result.id).filter(Boolean);
}
/**
 * Sanitize ai problem analyzer export.
 * @param {any} analysisResult
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeAiProblemAnalyzerExport(analysisResult, options = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
  if (!analysisResult || typeof analysisResult !== 'object') return null;
  const projectLabel = projectLabelFromPath(
    options.projectPath ||
      ((_b = (_a = options.context) === null || _a === void 0 ? void 0 : _a.report) === null || _b === void 0
        ? void 0
        : _b.projectRoot) ||
      analysisResult.projectPath ||
      'ai-platform'
  );
  const benchmarkScan = isBenchmarkPath(
    options.projectPath ||
      ((_d = (_c = options.context) === null || _c === void 0 ? void 0 : _c.report) === null || _d === void 0
        ? void 0
        : _d.projectRoot) ||
      analysisResult.projectPath
  );
  const sanitized = deepRedact(analysisResult, projectLabel);
  const summary = sanitized.summary || null;
  const selectedIssueIds = resolveSelectedIssueIds(sanitized);
  const analyzerResults = enrichAnalyzerResultsForExport(sanitized.analyzerResults || []);
  const riskSummary = reconcileRiskSummary(sanitized.riskSummary || null);
  const topPriorityIssues = enrichTopPriorityIssuesForExport(sanitized.topPriorityIssues || [], analyzerResults);
  const mitigationThemes = slimMitigationThemes(sanitized.mitigationThemes || []);
  const healthScore =
    (_k =
      (_j =
        (_f = (_e = options.context) === null || _e === void 0 ? void 0 : _e.healthScore) !== null && _f !== void 0
          ? _f
          : (_h = (_g = options.context) === null || _g === void 0 ? void 0 : _g.report) === null || _h === void 0
            ? void 0
            : _h.qualityScore) !== null && _j !== void 0
        ? _j
        : sanitized.healthScore) !== null && _k !== void 0
      ? _k
      : null;
  const forNotes = { ...sanitized, riskSummary, analyzerResults };
  const exportNotes = buildExportNotes(forNotes, options);
  const payload = buildSlimPayload(sanitized, summary);
  const architecture = slimArchitectureForExport(sanitized.architecture, summary);
  const analysisGeneratedAt =
    ((_l = options.context) === null || _l === void 0 ? void 0 : _l.analysisGeneratedAt) ||
    sanitized.analysisGeneratedAt ||
    sanitized.generatedAt ||
    ((_o = (_m = options.context) === null || _m === void 0 ? void 0 : _m.report) === null || _o === void 0
      ? void 0
      : _o.analysisGeneratedAt) ||
    null;
  return {
    type: 'ai-problem-analyzer-suite-export',
    title: `SimpleBeacon AI Problem Analyzer Suite — ${projectLabel}`,
    exportVersion: EXPORT_VERSION,
    exportSanitized: true,
    exportNormalized: true,
    generatedAt: new Date().toISOString(),
    generatedBy: 'SimpleBeacon',
    projectPath: projectLabel,
    benchmarkScan,
    scanTargetProfile: benchmarkScan ? 'benchmark-cache' : 'product',
    handoffEligible: false,
    inputKind:
      ((_p = options.context) === null || _p === void 0 ? void 0 : _p.inputKind) || sanitized.inputKind || null,
    scannedAt:
      ((_q = options.context) === null || _q === void 0 ? void 0 : _q.scannedAt) ||
      ((_s = (_r = options.context) === null || _r === void 0 ? void 0 : _r.report) === null || _s === void 0
        ? void 0
        : _s.generatedAt) ||
      sanitized.scannedAt ||
      null,
    analysisGeneratedAt,
    healthScore,
    selectedIssueIds,
    summary,
    categoryDistribution: sanitized.categoryDistribution || [],
    riskSummary,
    topPriorityIssues,
    coverageGaps: sanitized.coverageGaps || [],
    mitigationThemes,
    architecture,
    analyzerResults,
    payload,
    hygieneSummary: buildHygieneSummary(summary, riskSummary, healthScore),
    exportNotes,
    disclaimers: [
      ...(benchmarkScan
        ? ['Benchmark clone analyzer run — not SimpleBeacon ai-platform product handoff clearance.']
        : []),
      'Deterministic analyzer suite — scores reflect local rubric over available scan/codebase context, not legal conformity certification.',
      'Exports use metricScore and riskScore only — legacy score field omitted. For higher_better metrics, riskScore = 100 - metricScore.',
      'riskBand (High/Elevated/Moderate/Low) maps to severity (critical/high/medium/low) at the same thresholds — see riskSummary.riskBandLegend.',
      'overallRiskLevel uses average riskScore across measured analyzers; peakSeverity reflects the highest individual analyzer severity.',
      'Stub analyzers return contract-valid placeholders until implementation lands.',
      'Absolute host paths are redacted to project label in exports.',
      'payload omits registry and duplicate selectedIssueIds — see root.selectedIssueIds.',
      'handoffEligible remains false — Complete scan clearance requires operator sign-off.',
    ],
    sanitized: true,
    sanitizedAt: new Date().toISOString(),
  };
}
/**
 * Ai problem analyzer export filename.
 * @param {string} projectPath
 * @param {any} date
 * @returns {any}
 */
export function aiProblemAnalyzerExportFilename(projectPath, date = new Date()) {
  const slug =
    projectLabelFromPath(projectPath)
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'scan';
  return `ai-problem-analyzer-${slug}-${date.toISOString().slice(0, 10)}.json`;
}
/**
 * Build ai problem analyzer csv.
 * @param {number} exportPayload
 * @returns {any}
 */
export function buildAiProblemAnalyzerCsv(exportPayload) {
  var _a, _b, _c;
  const rows = [
    [
      'id',
      'analyzerId',
      'title',
      'status',
      'severity',
      'metricScore',
      'riskScore',
      'scoringDirection',
      'riskBand',
      'evidenceStatus',
      'countsTowardRiskSummary',
    ],
  ];
  for (const result of (exportPayload === null || exportPayload === void 0 ? void 0 : exportPayload.analyzerResults) ||
    []) {
    rows.push([
      result.id || '',
      result.analyzerId || '',
      result.title || result.name || '',
      result.status || '',
      result.severity || '',
      (_b = (_a = result.metricScore) !== null && _a !== void 0 ? _a : result.score) !== null && _b !== void 0
        ? _b
        : '',
      (_c = result.riskScore) !== null && _c !== void 0 ? _c : '',
      result.scoringDirection || '',
      result.riskBand || '',
      result.evidenceStatus || '',
      result.countsTowardRiskSummary === false ? 'false' : 'true',
    ]);
  }
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell !== null && cell !== void 0 ? cell : '');
          return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(',')
    )
    .join('\n');
}
