const fs = require('fs');
const os = require('os');
const path = require('path');
const { analyzeWithModel } = require('../../server/services/model-inference-service');

describe('model inference service', () => {
    let baseDir;

    beforeEach(async () => {
        baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cascade-infer-'));
        const dataDir = path.join(baseDir, 'web', 'data');
        fs.mkdirSync(dataDir, { recursive: true });

        fs.writeFileSync(path.join(dataDir, 'mock-analysis-sample.json'), JSON.stringify({
            type: 'mock-data-analysis-report',
            title: 'Template',
            dataSource: 'repository-audit',
            generatedBy: 'mock-data-scanner (repository-audit)',
            modelInfo: {
                name: 'platform-checklist',
                type: 'Internal',
                confidence: null,
                status: 'active'
            },
            analysisOverview: {
                totalMockFiles: 2,
                issuesDetected: 0,
                aiConfidence: null
            },
            mockDataCategories: [{
                category: 'JSON Files',
                fileCount: 2,
                qualityScore: 99,
                issues: 0,
                confidence: null
            }],
            detectedIssues: [],
            qualityMetrics: { overallQuality: 80, measuredFromScan: true },
            optimizationRecommendations: [],
            qualityImprovements: [],
            performanceMetrics: {},
            privacyAndSecurity: {}
        }));
        fs.writeFileSync(path.join(dataDir, 'sample-a.json'), JSON.stringify({ a: 1 }));
        fs.writeFileSync(path.join(dataDir, 'sample-b.json'), JSON.stringify({ b: 2 }));

        const modelsRoot = path.join(baseDir, 'data-central', 'ai-tools', 'ai-models');
        fs.mkdirSync(modelsRoot, { recursive: true });
        fs.writeFileSync(path.join(modelsRoot, 'registry.json'), JSON.stringify({
            version: 1,
            activeModelId: 'platform-checklist-demo',
            ollamaBaseUrl: 'http://127.0.0.1:11434',
            models: [{
                id: 'platform-checklist-demo',
                name: 'platform-checklist',
                provider: 'demo',
                type: 'Internal',
                status: 'active',
                isDefault: true,
                confidence: null
            }]
        }));
    });

    afterEach(() => {
        fs.rmSync(baseDir, { recursive: true, force: true });
    });

    test('analyzeWithModel returns report for demo provider', async () => {
        const result = await analyzeWithModel(baseDir, 'platform-checklist-demo');
        expect(result.success).toBe(true);
        expect(result.report.type).toBe('mock-data-analysis-report');
        expect(result.report.modelInfo.name).toBe('platform-checklist');
        expect(result.report.modelInfo.confidence).toBeNull();
        expect(result.report.generatedBy).not.toContain('unbreakable-oracle');
        expect(result.report.analysisOverview.totalMockFiles).toBeGreaterThanOrEqual(2);
        expect(result.inferenceMode).toBe('repository-audit');
    });

    test('analyzeWithModel does not inject template issues when scan is clean', async () => {
        const result = await analyzeWithModel(baseDir, 'platform-checklist-demo');
        expect(result.report.detectedIssues).toEqual([]);
        expect(result.report.inferenceMeta.issueSource).toBe('none');
        expect(result.report.analysisOverview.issuesDetected).toBe(0);
    });

    test('analyzeWithModel builds quality metrics from scan only', async () => {
        const result = await analyzeWithModel(baseDir, 'platform-checklist-demo');
        const metrics = result.report.qualityMetrics;
        expect(metrics.measuredFromScan).toBe(true);
        expect(metrics.overallQuality).toBeGreaterThan(0);
        expect(result.report.analysisOverview.aiConfidence).toBeNull();
        expect(metrics.accuracyScore).toBeUndefined();
        expect(metrics.consistencyScore).not.toBe(87.6);
        expect(metrics.completenessScore).not.toBe(91.2);
        expect(result.report.inferenceMeta.metricsSource).toBe('scan');
    });
});
