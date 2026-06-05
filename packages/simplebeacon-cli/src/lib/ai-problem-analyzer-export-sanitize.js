/**
 * Sanitize AI Problem Analyzer Suite JSON exports — paths, branding, dedupe, export metadata.
 */

const path = require('path');
const { isExternalBenchmarkCachePath } = require('./benchmark-cache-paths');

const EXPORT_VERSION = '1.3.0';

const RISK_BAND_LEGEND = {
    High: 'critical',
    Elevated: 'high',
    Moderate: 'medium',
    Low: 'low'
};
const TAXONOMY_VERSION = 'final-48-analyzers';
const ANALYSIS_VERSION = '2.0.0';

const SHARED_MITIGATION_THEMES = [
    'Use deterministic evaluation fixtures and regression tests.',
    'Track category-specific metrics in release gates.',
    'Escalate high-risk findings with clear remediation owners.'
];

function projectLabelFromPath(projectPath) {
    const normalized = String(projectPath || 'ai-platform').replace(/\\/g, '/');
    return path.basename(normalized) || 'ai-platform';
}

function redactPathForExport(value, projectLabel = 'ai-platform') {
    if (value == null || value === '') return value;
    const normalized = String(value).replace(/\\/g, '/');
    if (/^[a-zA-Z]:\//.test(normalized)
        || normalized.startsWith('/Users/')
        || normalized.startsWith('/home/')
        || normalized.includes('CascadeProjects')) {
        return projectLabel;
    }
    return normalized;
}

function normalizeSimpleBeaconBranding(value) {
    return String(value ?? '').replace(/\bSimplebeacon\b/g, 'SimpleBeacon');
}

function clampScore(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    if (numeric < 0) return 0;
    if (numeric > 100) return 100;
    return Number(numeric.toFixed(2));
}

function severityFromRisk(riskScore) {
    if (riskScore >= 75) return 'critical';
    if (riskScore >= 55) return 'high';
    if (riskScore >= 35) return 'medium';
    return 'low';
}

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

function enrichAnalyzerResultForExport(result) {
    if (!result || typeof result !== 'object') return result;
    const scoringDirection = result.scoringDirection || inferScoringDirection(result);
    const hasLegacyScore = Number.isFinite(Number(result.score));
    const metricScore = hasLegacyScore
        ? clampScore(result.score)
        : clampScore(result.metricScore ?? (scoringDirection === 'higher_better' && Number.isFinite(Number(result.riskScore))
            ? 100 - Number(result.riskScore)
            : result.riskScore));
    const riskScore = Number.isFinite(Number(result.riskScore)) && !hasLegacyScore
        ? clampScore(result.riskScore)
        : scoringDirection === 'higher_better'
            ? clampScore(100 - metricScore)
            : metricScore;
    const { score: _score, ...rest } = result;
    return {
        ...rest,
        metricScore,
        riskScore,
        scoringDirection
    };
}

function enrichAnalyzerResultsForExport(results = []) {
    return results.map(enrichAnalyzerResultForExport);
}

function enrichTopPriorityIssuesForExport(issues = [], analyzerResults = []) {
    const byId = new Map(analyzerResults.map((result) => [result.id, result]));
    return issues.map((issue) => {
        const result = byId.get(issue.id);
        const riskScore = issue.priorityScore ?? result?.riskScore ?? null;
        const metricScore = result?.metricScore ?? null;
        const scoringDirection = result?.scoringDirection ?? null;
        return {
            ...issue,
            riskScore,
            ...(metricScore != null ? { metricScore } : {}),
            ...(scoringDirection ? { scoringDirection } : {}),
            priorityScore: riskScore
        };
    });
}

function slimMitigationThemes(themes = []) {
    if (!themes.length) return { sharedThemes: SHARED_MITIGATION_THEMES, categories: [] };
    const categories = themes.map((item) => ({
        categoryId: item.categoryId,
        categoryName: item.categoryName
    }));
    return { sharedThemes: SHARED_MITIGATION_THEMES, categories };
}

function deepRedact(value, projectLabel, depth = 0) {
    if (depth > 8 || value == null) return value;
    if (typeof value === 'string') {
        if (/^[a-zA-Z]:\\/.test(value) || value.includes('CascadeProjects')) {
            return redactPathForExport(value, projectLabel);
        }
        return normalizeSimpleBeaconBranding(value);
    }
    if (Array.isArray(value)) {
        return value.map((item) => deepRedact(item, projectLabel, depth + 1));
    }
    if (typeof value === 'object') {
        const out = {};
        for (const [key, item] of Object.entries(value)) {
            if (['projectRoot', 'projectPath', 'scanTargetRoot', 'platformRoot'].includes(key)) {
                out[key] = redactPathForExport(item, projectLabel);
            } else {
                out[key] = deepRedact(item, projectLabel, depth + 1);
            }
        }
        return out;
    }
    return value;
}

function peakSeverityFromCounts(counts = {}) {
    if ((counts.critical || 0) > 0) return 'critical';
    if ((counts.high || 0) > 0) return 'high';
    if ((counts.medium || 0) > 0) return 'medium';
    if ((counts.low || 0) > 0) return 'low';
    return 'none';
}

function reconcileRiskSummary(riskSummary = {}) {
    const severityCounts = riskSummary.severityCounts || {};
    const peakSeverity = peakSeverityFromCounts(severityCounts);
    const overallRiskLevel = riskSummary.overallRiskLevel || 'Low';
    const overallRiskLevelBasis = 'average-risk-score';
    let overallRiskLevelNote = null;

    if (peakSeverity === 'critical' || peakSeverity === 'high') {
        if (overallRiskLevel === 'Low' || overallRiskLevel === 'Moderate') {
            overallRiskLevelNote = `overallRiskLevel is ${overallRiskLevel} (average riskScore ${riskSummary.averageRiskScore ?? '—'}) — peakSeverity is ${peakSeverity}; review topPriorityIssues.`;
        }
    }

    return {
        ...riskSummary,
        peakSeverity,
        overallRiskLevelBasis,
        riskBandLegend: RISK_BAND_LEGEND,
        ...(overallRiskLevelNote ? { overallRiskLevelNote } : {})
    };
}

function slimArchitectureForExport(architecture, summary = null) {
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

    if (Array.isArray(slim.keyDesignPrinciples) && (summary?.stubCount ?? 0) === 0) {
        slim.keyDesignPrinciples = slim.keyDesignPrinciples.filter(
            (principle) => !/contract-valid safe stubs/i.test(String(principle))
        );
    }

    return slim;
}

function buildHygieneSummary(summary, riskSummary, healthScore) {
    const execution = riskSummary?.executionStatus || {};
    return {
        selectedAnalyzerCount: summary?.selectedIssueCount ?? null,
        measuredCount: riskSummary?.measuredAnalyzerCount ?? execution.measured ?? null,
        insufficientDataCount: execution.insufficientData ?? null,
        peakSeverity: riskSummary?.peakSeverity ?? null,
        overallRiskLevel: riskSummary?.overallRiskLevel ?? null,
        healthScore: healthScore ?? null,
        attestationNote: 'healthScore reflects SimpleBeacon gate scan quality — analyzer riskScore/peakSeverity are separate signals.'
    };
}

function buildExportNotes(analysisResult, options = {}) {
    const notes = [];
    const risk = analysisResult?.riskSummary || {};
    const summary = analysisResult?.summary || {};
    const execution = risk.executionStatus || {};
    const totalRun = (execution.measured || 0) + (execution.insufficientData || 0) + (execution.stub || 0);

    if ((execution.insufficientData || 0) > 0) {
        notes.push(`${execution.insufficientData} of ${totalRun || summary.selectedIssueCount || '?'} analyzer(s) lacked sufficient input — run codebase or complete scan, then re-run the suite.`);
    }
    if ((summary.stubCount || 0) > 0) {
        notes.push(`${summary.stubCount} analyzer(s) returned contract stubs — deterministic logic not yet implemented for those IDs.`);
    }
    if (options.context?.inputKind) {
        notes.push(`Input context: ${options.context.inputKind}.`);
    }
    const hasPeakRisk = risk.peakSeverity === 'critical' || risk.peakSeverity === 'high';
    const healthScore = options.context?.healthScore;
    if (hasPeakRisk) {
        const peakParts = [`peakSeverity ${risk.peakSeverity}`];
        if (risk.overallRiskLevelNote) {
            peakParts.push('overallRiskLevel is an average — use topPriorityIssues.riskScore (not metricScore for higher_better analyzers)');
        } else {
            peakParts.push('review topPriorityIssues.riskScore');
        }
        if (healthScore != null) {
            peakParts.push(`gate healthScore ${healthScore} does not override analyzer peakSeverity`);
        }
        notes.push(`${peakParts.join('; ')}.`);
    }
    if ((analysisResult?.coverageGaps || []).length > 0) {
        const gapCount = analysisResult.coverageGaps.length;
        const insufficient = execution.insufficientData || 0;
        if (insufficient > gapCount) {
            notes.push(`${gapCount} prioritized coverage gap(s) listed (${insufficient} total insufficient_data analyzers) — supply missing scan/codebase fields and re-run.`);
        } else {
            notes.push(`${gapCount} coverage gap(s) listed — supply missing scan/codebase fields to improve measured analyzer count.`);
        }
    }
    return [...new Set(notes)].slice(0, 8);
}

function buildSlimPayload(sanitized, summary) {
    const source = sanitized.payload || {};
    return {
        type: 'ai-problem-analyzer-suite',
        analysisVersion: source.analysisVersion || ANALYSIS_VERSION,
        taxonomyVersion: source.taxonomyVersion || TAXONOMY_VERSION,
        selectedIssueCount: summary?.selectedIssueCount ?? source.selectedIssueCount ?? null,
        selectedIssueIdsRef: 'root.selectedIssueIds',
        registrySummary: {
            catalogSize: source.registry?.length ?? 48,
            implementedInRun: summary?.implementedCount ?? null,
            stubsInRun: summary?.stubCount ?? 0,
            note: 'Full ANALYZER_CATALOG omitted from exports — use dashboard suite reference or docs/archive/historical/planning/ai-problem-analyzer-suite/.'
        }
    };
}

function resolveSelectedIssueIds(sanitized) {
    if (Array.isArray(sanitized.selectedIssueIds) && sanitized.selectedIssueIds.length) {
        return sanitized.selectedIssueIds;
    }
    const fromPayload = sanitized.payload?.selectedIssueIds;
    if (Array.isArray(fromPayload) && fromPayload.length) return fromPayload;
    const fromArch = sanitized.architecture?.dataCollectionLayer?.selectedIssueIds;
    if (Array.isArray(fromArch) && fromArch.length) return fromArch;
    return (sanitized.analyzerResults || []).map((result) => result.id).filter(Boolean);
}

/**
 * @param {object} analysisResult output of buildAiSystemsIssueAnalysis
 * @param {object} [options]
 * @param {string} [options.projectPath]
 * @param {object} [options.context] analyzer suite context snapshot
 * @returns {object|null}
 */
function sanitizeAiProblemAnalyzerExport(analysisResult, options = {}) {
    if (!analysisResult || typeof analysisResult !== 'object') return null;

    const projectLabel = projectLabelFromPath(
        options.projectPath
        || options.context?.report?.projectRoot
        || analysisResult.projectPath
        || 'ai-platform'
    );
    const benchmarkScan = isExternalBenchmarkCachePath(
        String(options.projectPath || options.context?.report?.projectRoot || analysisResult.projectPath || '').replace(/\\/g, '/')
    );

    const sanitized = deepRedact(analysisResult, projectLabel);
    const summary = sanitized.summary || null;
    const selectedIssueIds = resolveSelectedIssueIds(sanitized);
    const analyzerResults = enrichAnalyzerResultsForExport(sanitized.analyzerResults || []);
    const riskSummary = reconcileRiskSummary(sanitized.riskSummary || null);
    const topPriorityIssues = enrichTopPriorityIssuesForExport(
        sanitized.topPriorityIssues || [],
        analyzerResults
    );
    const mitigationThemes = slimMitigationThemes(sanitized.mitigationThemes || []);
    const healthScore = options.context?.healthScore ?? options.context?.report?.qualityScore ?? sanitized.healthScore ?? null;
    const forNotes = { ...sanitized, riskSummary, analyzerResults };
    const exportNotes = buildExportNotes(forNotes, options);
    const payload = buildSlimPayload(sanitized, summary);
    const architecture = slimArchitectureForExport(sanitized.architecture, summary);
    const analysisGeneratedAt = options.context?.analysisGeneratedAt
        || sanitized.analysisGeneratedAt
        || sanitized.generatedAt
        || options.context?.report?.analysisGeneratedAt
        || null;

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
        inputKind: options.context?.inputKind || sanitized.inputKind || null,
        scannedAt: options.context?.scannedAt || options.context?.report?.generatedAt || sanitized.scannedAt || null,
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
            'handoffEligible remains false — Complete scan clearance requires operator sign-off.'
        ],
        sanitized: true,
        sanitizedAt: new Date().toISOString()
    };
}

function aiProblemAnalyzerExportFilename(projectPath, date = new Date()) {
    const slug = projectLabelFromPath(projectPath)
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase() || 'scan';
    return `ai-problem-analyzer-${slug}-${date.toISOString().slice(0, 10)}.json`;
}

module.exports = {
    sanitizeAiProblemAnalyzerExport,
    aiProblemAnalyzerExportFilename,
    redactPathForExport,
    projectLabelFromPath,
    reconcileRiskSummary,
    peakSeverityFromCounts,
    buildSlimPayload,
    enrichAnalyzerResultForExport,
    inferScoringDirection,
    clampScore
};
