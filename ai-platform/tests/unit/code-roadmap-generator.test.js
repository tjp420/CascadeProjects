const path = require('path');
const {
    analyzeCodebase,
    generateCodeRoadmap,
    detectPlatformSignals,
    summarizeProjectStructureForExport
} = require('../../server/lib/code-roadmap-generator');
const { REPOSITORY_AUDIT_BASELINE } = require('../../server/lib/repository-audit-baseline');
const { PAGE_SAMPLE_SPECS } = require('../../packages/simplebeacon-cli/src/lib/page-sample-specs');

describe('code roadmap generator', () => {
    const baseDir = path.join(__dirname, '../..');
    const parentDir = path.join(baseDir, '..');

    test('detects ai-platform sprint signals', async () => {
        const signals = detectPlatformSignals(baseDir);
        expect(signals.serverEntry).toBe(true);
        expect(signals.stubApi).toBe(true);
        expect(signals.mockScanner).toBe(true);
        expect(signals.codeRoadmapGenerator).toBe(true);
        expect(signals.npmAudit).toBe(true);
        expect(signals.pageSampleDir).toBe(true);
    });

    test('resolves ai-platform when scanning parent workspace root', async () => {
        const baseline = REPOSITORY_AUDIT_BASELINE;
        const livePageSpecCount = Object.keys(PAGE_SAMPLE_SPECS).length;
        const roadmap = await generateCodeRoadmap(parentDir);
        expect(roadmap.executiveSummary.completionRate).toBe(100);
        expect(roadmap.executiveSummary.projectHealth).toBe('Healthy');
        expect(roadmap.codeAnalysis.samples.withSpecs).toBeLessThanOrEqual(livePageSpecCount);
        expect(roadmap.codeAnalysis.samples.withSpecs).toBeGreaterThan(0);
        expect(roadmap.codeAnalysis.signals.stubApi).toBe(true);
        expect(roadmap.progressMetrics.metrics.jestTests).toBe(baseline.jestTestsLabel);
        expect(roadmap.progressMetrics.overall).toBe(roadmap.executiveSummary.completionRate);
        expect(Object.keys(roadmap.progressMetrics.phases).some((key) => key.includes('Sprint'))).toBe(true);
        expect(typeof roadmap.progressMetrics.metrics.testCoverage).toBe('number');
        expect(roadmap.progressMetrics.metrics.testCoverage).toBeGreaterThan(0);
        expect(roadmap.developmentPhases.every((phase) => phase.status === 'completed')).toBe(true);
    });

    test('does not emit 47-feature enterprise fiction', async () => {
        const roadmap = await generateCodeRoadmap(baseDir);
        expect(roadmap.executiveSummary.totalFeatures).toBe(4);
        expect(roadmap.executiveSummary.totalFeatures).not.toBe(47);
        expect(roadmap.dataSource).toBe('filesystem-scan');
        expect(roadmap.generatedBy).toBe('code-roadmap-generator');
        expect(roadmap.version).toBe('3.1.0');
        expect(roadmap.rejectedFiction.claims.length).toBeGreaterThan(0);
    });

    test('includes phase2 code intelligence on roadmap', async () => {
        const roadmap = await generateCodeRoadmap(baseDir);
        const phase2 = roadmap.codeAnalysis.phase2;
        expect(phase2).toBeDefined();
        expect(phase2.dependencyGraph.summary).toHaveProperty('nodes');
        expect(roadmap.resourceEstimate.teamSize).toBe(1);
        expect(roadmap.implementationPhases.some((p) => p.phase.includes('Phase 2'))).toBe(true);
    });

    test('returns sprint-based development phases', async () => {
        const analysis = await analyzeCodebase(baseDir);
        expect(analysis.sprintModel.phases).toHaveLength(4);
        expect(analysis.sprintModel.phases[0].phase).toMatch(/Sprint 1/);
        expect(analysis.metrics.jestTestsPassing).toBe(REPOSITORY_AUDIT_BASELINE.jestTestsPassing);
        expect(analysis.metrics.apiRoutes).toBeGreaterThan(5);
    });

    test('includes dependency summary', async () => {
        const analysis = await analyzeCodebase(baseDir);
        expect(analysis.metrics.dependencies.externalCount).toBeGreaterThan(0);
    });

    test('summarizes deep projectStructure for export', () => {
        const summary = summarizeProjectStructureForExport({
            projectRoot: 'C:\\workspace',
            platformRoot: 'C:\\workspace\\ai-platform',
            totalDirectories: 99,
            totalFiles: 5000,
            mainCategories: {
                docs: {
                    name: 'docs',
                    path: 'C:\\workspace\\ai-platform\\docs',
                    fileCount: 2044,
                    subdirectoryCount: 3,
                    subdirectories: { archive: { subdirectories: { deep: { fileCount: 1 } } } },
                    keyFiles: Array.from({ length: 50 }, (_, i) => ({ name: `README_${i}.md` }))
                }
            }
        });

        expect(summary.mainCategories.docs.subdirectories).toBeUndefined();
        expect(summary.mainCategories.docs.keyFiles).toHaveLength(8);
        expect(summary.note).toMatch(/omitted from export/);
    });

    test('sanitizes doc-scraped api false positives', () => {
        const { sanitizeApiRouteList } = require('../../server/lib/code-roadmap-generator');
        const cleaned = sanitizeApiRouteList([
            '/api/health',
            '/api/process.html#process_process_env).',
            '/api/ai-roadmap-report-api.js`)\\",\\",',
            '/api/analyze/flexible'
        ]);
        expect(cleaned).toEqual(['/api/analyze/flexible', '/api/health']);
    });

    test('export roadmap omits bloated aiIntegration apis', async () => {
        const roadmap = await generateCodeRoadmap(baseDir, {
            projectStructure: { projectRoot: baseDir, mainCategories: {} },
            codebaseMetrics: {},
            developmentProgress: { metrics: {} }
        });
        const apis = roadmap.codeAnalysis?.aiIntegration?.apis || [];
        expect(apis.length).toBeGreaterThan(0);
        expect(apis.length).toBeLessThan(60);
        expect(apis.every((route) => route.startsWith('/api/'))).toBe(true);
        expect(apis.some((route) => route.includes('process.html'))).toBe(false);
        expect(roadmap.roadmapExportProfile).toBe('filtered-v3.1');
        expect(roadmap.aiIntegration).toBeUndefined();
        expect(roadmap.projectStructure?.mainCategories).toEqual({});
        expect(JSON.stringify(roadmap).length).toBeLessThan(500000);
    });

    test('ignores docs and archive paths in dependency walk and file counts', async () => {
        const {
            shouldIgnoreRoadmapPath,
            filterRoadmapAnalysisFiles,
            extractApiRoutesFromFiles
        } = require('../../server/lib/code-roadmap-generator');

        expect(shouldIgnoreRoadmapPath('docs/reports/foo.md')).toBe(true);
        expect(shouldIgnoreRoadmapPath('src/api/foo.js')).toBe(false);
        expect(shouldIgnoreRoadmapPath('data/roadmap/archive/old.json')).toBe(true);

        const parentAnalysis = await analyzeCodebase(parentDir);
        const platformAnalysis = await analyzeCodebase(baseDir);
        expect(parentAnalysis.metrics.totalFiles).toBe(platformAnalysis.metrics.totalFiles);
        expect(parentAnalysis.metrics.totalFiles).toBeLessThan(14000);

        const noisyApis = extractApiRoutesFromFiles([
            {
                path: path.join(baseDir, 'docs/archive/fixture.js'),
                relativePath: 'docs/archive/fixture.js',
                ext: '.js',
                size: 120
            }
        ]);
        expect(noisyApis).toEqual([]);

        const filtered = filterRoadmapAnalysisFiles([
            { relativePath: 'server/index.js' },
            { relativePath: 'docs/archive/readme.md' }
        ]);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].relativePath).toBe('server/index.js');
    });

    test('reports v1-internal deploy status in roadmap export', async () => {
        const { detectV1InternalReadinessAt } = require('../../server/lib/code-roadmap-generator');
        const readiness = detectV1InternalReadinessAt(baseDir);
        expect(readiness.localCodeReady).toBe(true);
        expect(['local_verified', 'code_ready']).toContain(readiness.localStatus);

        const roadmap = await generateCodeRoadmap(baseDir);
        expect(roadmap.v1InternalDeploy).toBeDefined();
        expect(roadmap.v1InternalDeploy.localStatus).toBeTruthy();
        expect(roadmap.recommendations.immediate.length).toBeGreaterThan(0);
        if (readiness.localStatus === 'local_verified') {
            expect(roadmap.recommendations.immediate[0]).toMatch(/Production deploy sign-off/i);
            expect(roadmap.executiveSummary.notes).toMatch(/local v1-internal verified/i);
        }
    });
});
