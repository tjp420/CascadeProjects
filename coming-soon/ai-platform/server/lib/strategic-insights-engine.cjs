/**
 * Strategic Insights Engine — interprets deterministic roadmap metrics.
 * LLMs analyze aggregated numbers only; roadmap data stays filesystem-derived.
 */

const {
    summarizeScanWithProvider,
    providerConfigured
} = require('../services/cloud-inference-service.cjs');

function num(value, fallback = null) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function aggregateRoadmapMetrics(roadmap = {}) {
    const structure = roadmap.codeAnalysis?.structure || {};
    const metrics = roadmap.codeAnalysis?.metrics || roadmap.progressMetrics?.metrics || {};
    const aiIntegration = roadmap.codeAnalysis?.aiIntegration || roadmap.aiIntegration || {};
    const summary = roadmap.executiveSummary || roadmap.projectOverview || {};
    const phases = roadmap.developmentPhases || roadmap.phases || roadmap.sprintPhases || [];
    const recs = roadmap.recommendations || {};

    const immediate = Array.isArray(recs.immediate) ? recs.immediate : [];
    const shortTerm = Array.isArray(recs.shortTerm) ? recs.shortTerm : [];
    const longTerm = Array.isArray(recs.longTerm) ? recs.longTerm : [];

    return {
        projectName: roadmap.projectName || roadmap.projectTitle || 'project',
        totalFiles: num(structure.totalFiles ?? metrics.totalFiles),
        codeFiles: num(structure.codeFiles ?? metrics.codeFiles),
        apiRoutes: num(
            metrics.apiRoutes
            ?? metrics.apiRouteCount
            ?? structure.apiRoutes
            ?? aiIntegration.apiRouteCount
        ),
        testFiles: num(structure.testFiles ?? metrics.testFiles),
        completionRate: num(summary.completionRate ?? roadmap.projectOverview?.completionRate),
        testCoverage: num(metrics.testCoverage ?? metrics.lineCoverage),
        lineCoverage: num(metrics.lineCoverage),
        featureCompleteness: num(metrics.featureCompleteness ?? summary.completionRate),
        phaseCount: phases.length,
        totalFeatures: num(summary.totalFeatures),
        completedFeatures: num(summary.completedFeatures),
        projectHealth: summary.projectHealth || roadmap.projectOverview?.projectHealth || null,
        immediateActions: immediate.slice(0, 6),
        shortTermActions: shortTerm.slice(0, 6),
        longTermActions: longTerm.slice(0, 4),
        dataSource: roadmap.dataSource || 'filesystem-scan',
        generatedBy: roadmap.generatedBy || 'code-roadmap-generator'
    };
}

function scorePerformance(metrics) {
    if (metrics.totalFiles != null && metrics.totalFiles > 30000) return 'MODERATE';
    if (metrics.totalFiles != null && metrics.totalFiles > 15000) return 'LOW';
    return 'MINIMAL';
}

function scoreMaintainability(metrics) {
    const cov = metrics.testCoverage ?? metrics.lineCoverage;
    if (cov != null && cov < 60) return 'MODERATE';
    if (metrics.phaseCount > 6) return 'MODERATE';
    return 'LOW';
}

function buildDeterministicStrategicInsights(metrics) {
    const perf = scorePerformance(metrics);
    const maint = scoreMaintainability(metrics);
    const completion = metrics.completionRate ?? metrics.featureCompleteness;
    const covLabel = metrics.testCoverage ?? metrics.lineCoverage;

    const riskFactors = [];
    if (metrics.totalFiles != null && metrics.totalFiles > 20000) {
        riskFactors.push({
            category: 'performance',
            severity: 'medium',
            description: `${metrics.totalFiles.toLocaleString()} inventoried files may slow CI and onboarding`,
            recommendation: 'Archive stale exports and tighten scan allowlists',
            estimatedImpact: 'Faster clone and scan cycles'
        });
    }
    if (covLabel != null && covLabel < 70) {
        riskFactors.push({
            category: 'maintainability',
            severity: 'medium',
            description: `Test coverage at ${covLabel}% — below common enterprise diligence thresholds`,
            recommendation: 'Expand Jest/Istanbul coverage on critical server paths',
            estimatedImpact: 'Lower regression risk in compliance reviews'
        });
    }
    if ((metrics.immediateActions || []).length > 2) {
        riskFactors.push({
            category: 'delivery',
            severity: 'low',
            description: `${metrics.immediateActions.length} immediate roadmap actions remain open`,
            recommendation: 'Sequence deploy sign-off before new feature work',
            estimatedImpact: 'Clearer go-live path'
        });
    }

    const overallRisk = riskFactors.some((f) => f.severity === 'high')
        ? 'HIGH'
        : riskFactors.some((f) => f.severity === 'medium')
            ? 'MODERATE'
            : 'LOW';

    const recommendations = [];
    for (const action of metrics.immediateActions || []) {
        recommendations.push({
            priority: 'HIGH',
            category: 'delivery',
            action,
            estimatedEffort: '1–3 days',
            estimatedImpact: 'Unblocks production readiness',
            businessValue: 'Revenue and compliance timeline'
        });
    }
    for (const action of (metrics.shortTermActions || []).slice(0, 3)) {
        recommendations.push({
            priority: 'MEDIUM',
            category: 'maintainability',
            action,
            estimatedEffort: '3–5 days',
            estimatedImpact: 'Improved engineering velocity',
            businessValue: 'Lower ongoing ops cost'
        });
    }

    const filesLabel = metrics.totalFiles != null ? metrics.totalFiles.toLocaleString() : '—';
    const apiLabel = metrics.apiRoutes != null ? String(metrics.apiRoutes) : '—';
    const covText = covLabel != null ? `${covLabel}%` : 'not measured in scan';
    const completionText = completion != null ? `${completion}%` : '—';

    const executiveSummary = [
        `Filesystem roadmap for ${metrics.projectName}: ${filesLabel} files inventoried, ${apiLabel} API routes detected.`,
        completion != null
            ? `Sprint completion signals ${completionText} with ${metrics.phaseCount || 0} phased workstreams.`
            : `Roadmap structured across ${metrics.phaseCount || 0} phases from directory signals.`,
        `Test coverage: ${covText}. Overall technical risk: ${overallRisk}.`,
        'All metrics above are deterministic — this summary uses rule-based interpretation only.'
    ].join(' ');

    const complianceNarrative = [
        'Deterministic scan scope: filesystem inventory, sample-path gate rules, and sprint baselines.',
        covLabel != null && covLabel >= 70
            ? `Test coverage (${covText}) supports SOC 2 change-management evidence.`
            : 'Test coverage should be verified separately before SOC 2 change-management claims.',
        metrics.apiRoutes != null
            ? `${metrics.apiRoutes} API routes inventoried for perimeter review.`
            : 'API route inventory available from server stub analysis.',
        'Fiction KPI and mock-data governance require Simplebeacon gate scans — not inferred by this roadmap layer.'
    ].join(' ');

    return {
        type: 'strategic-insights',
        mode: 'deterministic',
        generatedAt: new Date().toISOString(),
        executiveSummary,
        riskAssessment: {
            overallRisk,
            riskCategories: {
                security: 'MINIMAL',
                compliance: covLabel != null && covLabel >= 70 ? 'LOW' : 'MODERATE',
                performance: perf,
                maintainability: maint
            },
            riskFactors
        },
        recommendations,
        complianceNarrative,
        llmProvider: null,
        llmSummary: null,
        sourceMetrics: metrics
    };
}

function buildStrategicMetricsPayload(metrics, _projectPath) {
    return {
        reportKind: 'roadmap-strategic-metrics',
        analysisOverview: {
            repositoryFilesTotal: metrics.totalFiles,
            codeFilesAnalyzed: metrics.codeFiles,
            apiRouteCount: metrics.apiRoutes,
            testCoverage: metrics.testCoverage ?? metrics.lineCoverage,
            completionRate: metrics.completionRate,
            phaseCount: metrics.phaseCount,
            projectHealth: metrics.projectHealth
        },
        roadmapSummary: {
            projectName: metrics.projectName,
            immediateActions: metrics.immediateActions,
            shortTermActions: metrics.shortTermActions,
            dataSource: metrics.dataSource
        },
        detectedIssues: (metrics.immediateActions || []).slice(0, 5).map((action) => ({
            type: 'roadmap-action',
            severity: 'medium',
            description: action
        }))
    };
}

function sanitizeLlmStrategicSummary(summary, deterministic, metrics) {
    let text = String(summary || '').trim();
    if (!text) return deterministic.executiveSummary;

    if ((metrics.apiRoutes ?? null) != null && metrics.apiRoutes > 0) {
        const apiDetectedLine = `API routes are detected (${metrics.apiRoutes}); inventory comes from deterministic server/src route extraction.`;
        text = text
            .replace(
                /API routes?\s+(are|is)\s+currently undetected[^.\n]*[.\n]?/ig,
                `${apiDetectedLine}\n`
            )
            .replace(
                /No API routes?\s+detected[^.\n]*[.\n]?/ig,
                `${apiDetectedLine}\n`
            );
    }

    const riskLabel = deterministic?.riskAssessment?.overallRisk || 'LOW';
    const riskHuman = {
        LOW: 'Low',
        MODERATE: 'Moderate',
        HIGH: 'High'
    }[riskLabel] || riskLabel;
    text = text.replace(
        /(\*{0,2}risk\s*level\*{0,2}\s*:\s*)(\*{0,2})(?:low|moderate|high)(?:\s*-\s*(?:low|moderate|high))?(\*{0,2})/ig,
        (_m, prefix, openStars, closeStars) => `${prefix}${openStars}${riskHuman}${closeStars}`
    );
    text = text.replace(
        /(\*{1,2}risk\s*level:\*{1,2}\s*)(?:low|moderate|high)(?:\s*-\s*(?:low|moderate|high))?/ig,
        (_m, prefix) => `${prefix}${riskHuman}`
    );
    text = text.replace(
        /(risk\s*level\s*(?:\*{0,2}\s*:\s*\*{0,2}|\s+is\s+|:\s*))((?:low|moderate|high)(?:\s*-\s*(?:low|moderate|high))?)/ig,
        (_m, prefix) => `${prefix}${riskHuman}`
    );
    text = text.replace(
        /(risk\s+if\s+not\s+addressed\s+promptly\s+poses\s+a\s+)(low|moderate|high)\s+risk/ig,
        (_m, prefix) => `${prefix}${riskHuman} risk`
    );
    text = text.replace(
        /\bposes\s+a\s+(low|moderate|high)\s+risk\b/ig,
        `poses a ${riskHuman} risk`
    );
    text = text.replace(/(?:^|\n)Risk Level\s*:\s*[A-Za-z-]+/ig, '');
    text = `${text.trim()}\n\nRisk Level: ${riskLabel}`;

    // Normalize common prose variants so LLM narrative cannot contradict deterministic risk.
    text = text.replace(
        /(overall\s+risk(?:\s+level)?\s+(?:is|:\s*)\s*)(low|moderate|high)(?:\s*-\s*(low|moderate|high))?/ig,
        (_m, prefix) => `${prefix}${riskHuman}`
    );
    text = text.replace(
        /(risk\s+level\s+(?:is|:\s*)\s*)(low|moderate|high)(?:\s*-\s*(low|moderate|high))?/ig,
        (_m, prefix) => `${prefix}${riskHuman}`
    );
    text = text.replace(
        /\b(?:low|moderate|high)\s*-\s*(?:low|moderate|high)\s+risk\b/ig,
        `${riskHuman} risk`
    );

    if (!/deterministic metrics.*source of truth/i.test(text)) {
        text += '\n\nDeterministic metrics remain the source of truth; LLM narrative is advisory only.';
    }

    return text;
}

async function analyzeStrategicInsights(options = {}) {
    const roadmap = options.roadmap || {};
    const mode = String(options.mode || 'deterministic').toLowerCase();
    const metrics = aggregateRoadmapMetrics(roadmap);

    if (mode === 'off' || mode === 'none') {
        return null;
    }

    const deterministic = buildDeterministicStrategicInsights(metrics);

    if (mode !== 'llm') {
        return deterministic;
    }

    const aiProvider = String(options.aiProvider || 'ollama').toLowerCase();
    const registry = options.registry || null;
    const userCredentials = options.userCredentials || null;

    if (aiProvider === 'demo' || aiProvider === 'active') {
        deterministic.llmNote = 'Select a local or cloud provider for the strategic analysis layer.';
        return deterministic;
    }

    if (!providerConfigured(aiProvider, registry, userCredentials)) {
        deterministic.llmNote = `${aiProvider} is not configured — using deterministic insights only.`;
        return deterministic;
    }

    try {
        const payload = buildStrategicMetricsPayload(metrics, options.projectPath);
        const enhanced = await summarizeScanWithProvider(aiProvider, payload, {
            projectPath: options.projectPath,
            reportType: 'roadmap-strategic-metrics',
            userCredentials,
            registry,
            ollamaBaseUrl: registry?.ollamaBaseUrl,
            ollamaModel: options.ollamaModel
        });

        if (enhanced.enhanced && enhanced.summary) {
            const sanitizedSummary = sanitizeLlmStrategicSummary(
                enhanced.summary,
                deterministic,
                metrics
            );
            return {
                ...deterministic,
                mode: 'llm',
                llmProvider: enhanced.provider || aiProvider,
                llmSummary: sanitizedSummary,
                executiveSummary: sanitizedSummary,
                modelFallback: enhanced.modelFallback || null,
                llmDisclaimer: 'LLM narrative is advisory; deterministic metrics are source of truth.'
            };
        }
    } catch (err) {
        deterministic.llmNote = `LLM layer skipped: ${err.message}`;
    }

    return deterministic;
}

module.exports = {
    aggregateRoadmapMetrics,
    buildDeterministicStrategicInsights,
    analyzeStrategicInsights,
    sanitizeLlmStrategicSummary
};
