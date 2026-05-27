const path = require('path');
const fs = require('fs');
const os = require('os');
const {
    resolveProjectPath,
    resolveAnalysisType,
    resolveMockScanPaths,
    normalizeReportForSummary,
    resolveSummaryProvider
} = require('../../server/routes/flexible-analyze-api');
const { listAvailableProviders } = require('../../server/services/cloud-inference-service');

describe('flexible analyze helpers', () => {
    let baseDir;

    beforeEach(() => {
        baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flex-analyze-'));
    });

    afterEach(() => {
        fs.rmSync(baseDir, { recursive: true, force: true });
    });

    test('resolveProjectPath accepts absolute and relative paths', () => {
        const absolute = resolveProjectPath(baseDir, baseDir);
        expect(absolute).toBe(path.normalize(baseDir));
        const relative = resolveProjectPath(baseDir, 'web/data');
        expect(relative).toBe(path.normalize(path.join(baseDir, 'web/data')));
    });

    test('resolveAnalysisType auto picks mock-scan for json directories', async () => {
        const dataDir = path.join(baseDir, 'samples');
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'demo-sample.json'), '{}');
        await expect(resolveAnalysisType('auto', dataDir)).resolves.toBe('mock-scan');
    });

    test('resolveAnalysisType auto picks roadmap for code directories', async () => {
        const codeDir = path.join(baseDir, 'src');
        fs.mkdirSync(codeDir, { recursive: true });
        fs.writeFileSync(path.join(codeDir, 'index.js'), 'module.exports = {};');
        await expect(resolveAnalysisType('auto', codeDir)).resolves.toBe('roadmap');
    });

    test('resolveMockScanPaths skips monorepo parent to avoid duplicate mock scans', () => {
        const aiPlatform = path.join(__dirname, '../..');
        const parent = path.join(aiPlatform, '..');
        expect(resolveMockScanPaths(aiPlatform, parent)).toEqual([]);
        expect(resolveMockScanPaths(aiPlatform, aiPlatform)).toEqual([]);
    });

    test('listAvailableProviders always includes filesystem demo', () => {
        const providers = listAvailableProviders();
        expect(providers.some((p) => p.id === 'demo' && p.available)).toBe(true);
        expect(providers.some((p) => p.id === 'active')).toBe(true);
    });

    test('normalizeReportForSummary maps simplebeacon and consolidation reports', () => {
        const sample = normalizeReportForSummary({
            totalFiles: 12,
            qualityScore: 88,
            issueCount: 3,
            rawIssues: [{ type: 'fiction', description: '62% KPI' }]
        }, 'simplebeacon-report');
        expect(sample.analysisOverview.totalMockFiles).toBe(12);
        expect(sample.detectedIssues).toHaveLength(1);

        const merger = normalizeReportForSummary({
            type: 'file-merger-reduction-report',
            summary: {
                filesAnalyzed: 50,
                sampleDataFilesAnalyzed: 50,
                repositoryFilesTotal: 12000,
                repositoryFoldersTotal: 900,
                mergeCandidates: 2,
                reductionOpportunities: 1
            },
            repositoryInventory: { totalFiles: 12000, totalFolders: 900 },
            mergeCandidates: [{ mergeType: 'exact-duplicate', description: 'dup a/b' }]
        });
        expect(merger.analysisOverview.issuesDetected).toBe(3);
        expect(merger.mergerSummary.repositoryFilesTotal).toBe(12000);
        expect(merger.detectedIssues[0].type).toBe('exact-duplicate');
    });

    test('normalizeReportForSummary includes codebase eslint and analyzer summaries', () => {
        const codebase = normalizeReportForSummary({
            type: 'codebase-analyzer-report',
            summary: {
                repositoryFilesTotal: 120,
                codeFilesAnalyzed: 40,
                findingsTotal: 7,
                healthScore: 88,
                eslintErrors: 3,
                eslintWarnings: 4,
                analyzerCounts: {
                    debugArtifacts: 2,
                    placeholderOrFictionalData: 1,
                    eslintFindings: 4
                }
            },
            findings: [
                { category: 'debug-artifact', severity: 'medium', description: 'console.log in src/app.js' }
            ]
        }, 'codebase-analyzer-report');

        expect(codebase.analysisOverview.repositoryFilesTotal).toBe(120);
        expect(codebase.analysisOverview.eslintErrors).toBe(3);
        expect(codebase.analysisOverview.eslintWarnings).toBe(4);
        expect(codebase.analysisOverview.issuesDetected).toBe(7);
    });

    test('normalizeReportForSummary maps data-cleanup reports with inventory totals', () => {
        const cleanup = normalizeReportForSummary({
            type: 'data-cleanup-report',
            scanProfile: 'data-quality',
            inventory: { totalFiles: 35027, totalDirectories: 4110 },
            summary: {
                totalFindings: 432,
                reclaimableBytes: 0,
                configFindings: 5,
                environmentFindings: 121,
                dataPrivacyFindings: 88,
                dataLineageFindings: 178,
                dataAccessFindings: 39
            },
            executiveSummary: {
                priorityActions: [{ title: 'Align environment values' }],
                security: { piiHits: 87, credentialHits: 1 },
                data: { orphanedDataFiles: 178, syncIoPatterns: 39 }
            },
            aggregation: { bySeverity: { critical: 0, high: 3, medium: 66, low: 300 } },
            allFindings: [{ type: 'env-inconsistency', severity: 'medium', reason: 'PORT differs' }]
        }, 'data-cleanup-report');

        expect(cleanup.reportKind).toBe('data-cleanup-report');
        expect(cleanup.analysisOverview.repositoryFilesTotal).toBe(35027);
        expect(cleanup.dataCleanupSummary.totalFindings).toBe(432);
        expect(cleanup.executiveSummary.data.orphanedDataFiles).toBe(178);
        expect(cleanup.detectedIssues[0].type).toBe('env-inconsistency');
    });

    test('resolveSummaryProvider maps active ollama model', () => {
        const registry = {
            activeModelId: 'm1',
            models: [{ id: 'm1', provider: 'ollama', ollamaModel: 'llama3.2' }]
        };
        expect(resolveSummaryProvider('demo', registry)).toBeNull();
        expect(resolveSummaryProvider('active', registry)).toEqual({
            providerId: 'ollama',
            ollamaModel: 'llama3.2'
        });
        expect(resolveSummaryProvider('openai', registry)).toEqual({ providerId: 'openai' });
    });

    test('resolveSummaryProvider falls back to Ollama when active model is demo/GGUF', () => {
        const registry = {
            activeModelId: 'demo-model',
            ollamaBaseUrl: 'http://127.0.0.1:11434',
            models: [{ id: 'demo-model', provider: 'demo', ollamaModel: null }]
        };
        expect(resolveSummaryProvider('active', registry, { ollamaModel: 'unbreakable-oracle' })).toEqual({
            providerId: 'ollama',
            ollamaModel: 'unbreakable-oracle'
        });
        expect(resolveSummaryProvider('ollama', registry)).toEqual({ providerId: 'ollama' });
    });
});
