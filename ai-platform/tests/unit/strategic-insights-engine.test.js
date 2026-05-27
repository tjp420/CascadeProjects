const {
    aggregateRoadmapMetrics,
    buildDeterministicStrategicInsights,
    sanitizeLlmStrategicSummary
} = require('../../server/lib/strategic-insights-engine');

describe('strategic insights engine', () => {
    const sampleRoadmap = {
        projectName: 'ai-platform',
        generatedBy: 'code-roadmap-generator',
        dataSource: 'filesystem-scan',
        executiveSummary: { completionRate: 82, projectHealth: 'Good', totalFeatures: 4 },
        codeAnalysis: {
            structure: { totalFiles: 42000, codeFiles: 3100, testFiles: 120 },
            metrics: { apiRoutes: 94, lineCoverage: 79.5 }
        },
        developmentPhases: [{ phase: 'Phase 1' }, { phase: 'Phase 2' }],
        recommendations: {
            immediate: ['Production deploy sign-off'],
            shortTerm: ['Expand test coverage on server routes']
        }
    };

    test('aggregateRoadmapMetrics extracts safe numbers only', () => {
        const metrics = aggregateRoadmapMetrics(sampleRoadmap);
        expect(metrics.totalFiles).toBe(42000);
        expect(metrics.apiRoutes).toBe(94);
        expect(metrics.completionRate).toBe(82);
        expect(metrics.testCoverage).toBe(79.5);
        expect(metrics.immediateActions).toContain('Production deploy sign-off');
    });

    test('buildDeterministicStrategicInsights returns executive summary and risk', () => {
        const metrics = aggregateRoadmapMetrics(sampleRoadmap);
        const insights = buildDeterministicStrategicInsights(metrics);
        expect(insights.mode).toBe('deterministic');
        expect(insights.executiveSummary).toMatch(/42000|42,000/);
        expect(insights.riskAssessment.overallRisk).toBeTruthy();
        expect(insights.recommendations.length).toBeGreaterThan(0);
        expect(insights.complianceNarrative).toMatch(/Deterministic scan scope/);
    });

    test('flags moderate performance risk for large repos', () => {
        const metrics = aggregateRoadmapMetrics({
            ...sampleRoadmap,
            codeAnalysis: { structure: { totalFiles: 50000 } }
        });
        const insights = buildDeterministicStrategicInsights(metrics);
        expect(insights.riskAssessment.riskCategories.performance).toBe('MODERATE');
    });

    test('reads apiRouteCount fallback when apiRoutes key is missing', () => {
        const metrics = aggregateRoadmapMetrics({
            ...sampleRoadmap,
            codeAnalysis: {
                structure: { totalFiles: 1000, codeFiles: 200 },
                aiIntegration: { apiRouteCount: 99 }
            },
            progressMetrics: {
                metrics: { apiRouteCount: 99, lineCoverage: 75 }
            }
        });
        expect(metrics.apiRoutes).toBe(99);
    });

    test('sanitizes LLM undetected-routes contradiction and risk line', () => {
        const metrics = aggregateRoadmapMetrics(sampleRoadmap);
        const deterministic = buildDeterministicStrategicInsights(metrics);
        const sanitized = sanitizeLlmStrategicSummary(
            'API routes are currently undetected. Risk Level: High',
            deterministic,
            metrics
        );
        expect(sanitized).toMatch(/API routes are detected \(94\)/);
        expect(sanitized).not.toMatch(/currently undetected/i);
        expect(sanitized).toMatch(new RegExp(`Risk Level: ${deterministic.riskAssessment.overallRisk}`));
        expect(sanitized).toMatch(/source of truth/i);
    });

    test('normalizes prose risk phrasing to deterministic risk', () => {
        const metrics = aggregateRoadmapMetrics(sampleRoadmap);
        const deterministic = buildDeterministicStrategicInsights(metrics);
        const expectedRisk = deterministic.riskAssessment.overallRisk;
        const expectedRiskHuman = expectedRisk.charAt(0) + expectedRisk.slice(1).toLowerCase();
        const sanitized = sanitizeLlmStrategicSummary(
            'The risk level is Low-Moderate due to deployment tasks.',
            deterministic,
            metrics
        );
        expect(sanitized).toMatch(new RegExp(`risk level is ${expectedRiskHuman}`, 'i'));
        expect(sanitized).not.toMatch(/Low-Moderate/i);
        expect(sanitized).toMatch(new RegExp(`Risk Level: ${expectedRisk}`));
    });

    test('normalizes markdown risk labels to deterministic risk', () => {
        const metrics = aggregateRoadmapMetrics(sampleRoadmap);
        const deterministic = buildDeterministicStrategicInsights(metrics);
        const expectedRiskHuman = deterministic.riskAssessment.overallRisk.charAt(0)
            + deterministic.riskAssessment.overallRisk.slice(1).toLowerCase();
        const sanitized = sanitizeLlmStrategicSummary(
            '**Risk Level:** Low-Moderate due to pending deploy tasks.',
            deterministic,
            metrics
        );
        expect(sanitized).toMatch(new RegExp(`\\*\\*Risk Level:\\*\\* ${expectedRiskHuman}`, 'i'));
        expect(sanitized).not.toMatch(/Low-Moderate/i);
    });

    test('normalizes secondary moderate-risk prose to deterministic risk', () => {
        const metrics = aggregateRoadmapMetrics({
            ...sampleRoadmap,
            codeAnalysis: {
                structure: { totalFiles: 1000, codeFiles: 200, testFiles: 30 },
                metrics: { apiRoutes: 12, lineCoverage: 90 }
            },
            recommendations: {
                immediate: ['Cut release candidate'],
                shortTerm: ['Finalize production checklist']
            }
        });
        const deterministic = buildDeterministicStrategicInsights(metrics);
        const expectedRiskHuman = deterministic.riskAssessment.overallRisk.charAt(0)
            + deterministic.riskAssessment.overallRisk.slice(1).toLowerCase();
        const sanitized = sanitizeLlmStrategicSummary(
            'The risk level is considered low. If not addressed promptly this poses a moderate risk.',
            deterministic,
            metrics
        );
        expect(sanitized).toMatch(new RegExp(`poses a ${expectedRiskHuman} risk`, 'i'));
        expect(sanitized).not.toMatch(/poses a moderate risk/i);
    });
});
