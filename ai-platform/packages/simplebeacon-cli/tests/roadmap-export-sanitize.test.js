const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sanitizeRoadmapExport } = require('../src/lib/roadmap-export-sanitize');

const GEE = 'C:/repo/ai-platform/github-cache/google-earthenterprise';

test('sanitizeRoadmapExport fixes frozen GEE roadmap export', () => {
    const raw = {
        type: 'dynamic-project-roadmap-analysis',
        sourceProjectPath: GEE,
        platformRoot: GEE,
        recommendations: {
            immediate: ['Add docker-compose.phase2.yml smoke test to CI'],
            shortTerm: ['Wire 1000/1000 deploy gate before production profile'],
            longTerm: ['Define enterprise scope only after v1.0-internal'],
            priorities: {
                high: ['Add docker-compose.phase2.yml smoke test to CI'],
                medium: ['Wire 1000/1000 deploy gate'],
                low: []
            }
        },
        v1InternalDeploy: { deploy: 'npm run simplebeacon:deploy' },
        developmentPhases: [{
            phase: 'Sprint 2: Stub APIs & Tests',
            status: 'completed',
            features: ['1000/1000 Jest tests (72 suites)']
        }],
        progressMetrics: {
            metrics: { jestTests: '1000/1000', testCoverage: 77.4 }
        },
        strategicInsights: {
            recommendations: [{ action: 'Enable Istanbul coverage in CI (npm run test:coverage)' }],
            executiveSummary: 'Deploy 1000/1000 gate before production profile'
        }
    };

    const out = sanitizeRoadmapExport(raw);

    assert.equal(out.scanTargetProfile, 'benchmark-cache');
    assert.equal(out.handoffEligible, false);
    assert.equal(out.v1InternalDeploy, undefined);
    assert.ok(!JSON.stringify(out.recommendations).includes('docker-compose'));
    assert.ok(!JSON.stringify(out.developmentPhases).includes('1000/1000'));
    assert.equal(out.progressMetrics.metrics.jestSuites, null);
    assert.ok(out.strategicInsights.recommendations.every((r) => !/Istanbul/i.test(r.action || ''))
        || out.strategicInsights.recommendations[0].action.includes('hygiene'));
});

test('sanitizeRoadmapExport fixes frozen Simplebeacon benchmark roadmap export', () => {
    const SIMPLEBEACON = 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/tjp420-simplebeacon';
    const raw = {
        type: 'dynamic-project-roadmap-analysis',
        sourceProjectPath: SIMPLEBEACON,
        platformRoot: SIMPLEBEACON,
        recommendations: {
            immediate: ['Review OSS clone hygiene'],
            shortTerm: ['Complete remaining sprint deliverables', 'Improve documentation coverage'],
            longTerm: ['Define enterprise scope only after v1.0-internal'],
            priorities: { high: [], medium: ['Complete remaining sprint deliverables'], low: [] }
        },
        developmentPhases: [
            { phase: 'Sprint 2: Stub APIs & Tests', status: 'completed', features: ['1000/1000 Jest tests (72 suites)'] },
            { phase: 'Sprint 4: Production Profile', status: 'planned', features: ['Istanbul pending'] }
        ],
        implementationPhases: [
            { phase: 'Phase 1 — Sprint detection', status: 'complete', items: ['Filesystem signals'] },
            { phase: 'Phase 3 — Optional GGUF', status: 'planned', items: ['Semantic hints'] }
        ],
        progressMetrics: {
            overall: 25,
            phases: { 'Sprint 1': 100, 'Sprint 2': 50, 'Sprint 3': 0, 'Sprint 4': 0 },
            metrics: { jestTests: '1000/1000', testCoverage: 30.2 }
        },
        codeAnalysis: {
            features: [{ label: '1000/1000 Jest tests (72 suites)', count: 1000 }],
            structure: { codeFiles: 42, testFiles: 8, totalFiles: 120 },
            phase2: {
                fuzzySimilarity: {
                    pairs: [{
                        fileA: 'complete-scan-artifact-profile.js',
                        fileB: 'complete-scan-artifact-profile.browser.js',
                        similarity: 0.95
                    }]
                },
                resourceEstimate: { remainingSprints: 2, sprintBreakdown: [{ sprint: 1 }] }
            }
        },
        resourceEstimate: { remainingSprints: 2, sprintBreakdown: [{ sprint: 1 }] },
        executiveSummary: { completionRate: 25, projectHealth: 'Fair', plannedFeatures: 3 },
        strategicInsights: {
            riskAssessment: {
                overallRisk: 'HIGH',
                riskFactors: [{
                    description: 'Test coverage at 30.2% is below enterprise diligence thresholds for critical server paths',
                    recommendation: 'Expand Jest/Istanbul coverage'
                }]
            },
            recommendations: [{ action: 'Complete remaining sprint deliverables' }]
        },
        projectStructure: { projectRoot: SIMPLEBEACON, platformRoot: SIMPLEBEACON }
    };

    const out = sanitizeRoadmapExport(raw);

    assert.equal(out.exportNormalized, true);
    assert.equal(out.platformRoot, 'C:/Users/Trevor/CascadeProjects/ai-platform');
    assert.equal(out.scanTargetRoot, SIMPLEBEACON);
    assert.ok(!JSON.stringify(out.recommendations).includes('Complete remaining sprint'));
    assert.ok(!JSON.stringify(out.developmentPhases).includes('Sprint 2'));
    assert.equal(out.implementationPhases.length, 1);
    assert.equal(out.implementationPhases[0].phase, 'Benchmark filesystem scan');
    assert.deepEqual(Object.keys(out.progressMetrics.phases), ['OSS filesystem scan']);
    assert.equal(out.codeAnalysis.features.length, 0);
    assert.equal(out.resourceEstimate.sprintBreakdown.length, 0);
    assert.equal(out.executiveSummary.projectHealth, 'Benchmark hygiene');
    assert.ok(out.strategicInsights.riskAssessment.riskFactors.every((f) =>
        !/enterprise diligence/i.test(f.description || '')
    ));
    assert.equal(out.codeAnalysis.phase2.fuzzySimilarity.pairs[0].intentionalMirror, true);
});

test('sanitizeRoadmapExport repairs mis-scoped benchmark complete-scan roadmap Downloads export', () => {
    const BENCHMARK = 'C:/Users/Trevor/CascadeProjects/ai-platform/github-cache/tjp420-simplebeacon';
    const PLATFORM = 'C:/Users/Trevor/CascadeProjects/ai-platform';
    const raw = {
        type: 'dynamic-project-roadmap-analysis',
        sourceProjectPath: PLATFORM,
        platformRoot: PLATFORM,
        projectTitle: 'simplebeacon-platform',
        executiveSummary: {
            completionRate: 100,
            projectHealth: 'Healthy',
            notes: 'Engineering sprints complete; local v1-internal verified — production deploy to simplebeacon.ai is the remaining gate'
        },
        developmentPhases: [{
            phase: 'Sprint 4: Production Profile',
            status: 'completed',
            features: ['docker-compose.phase2.yml present', 'npm run simplebeacon:deploy']
        }],
        v1InternalDeploy: { deploy: 'npm run simplebeacon:deploy' },
        recommendations: {
            immediate: ['Production deploy sign-off — run npm run simplebeacon:deploy'],
            shortTerm: ['Configure LLAMA_CPP_BIN or Ollama'],
            longTerm: ['Define enterprise scope only after v1.0-internal'],
            priorities: { high: ['Production deploy sign-off'], medium: [], low: [] }
        },
        strategicInsights: {
            recommendations: [{ action: 'Run npm run simplebeacon:deploy and smoke-test https://simplebeacon.ai' }],
            executiveSummary: 'Deploy to simplebeacon.ai'
        },
        progressMetrics: {
            metrics: { jestTests: '117/117', testCoverage: 85.4 }
        }
    };

    const out = sanitizeRoadmapExport(raw, {
        requestedProjectPath: BENCHMARK,
        scanTargetRoot: BENCHMARK
    });

    assert.equal(out.benchmarkScan, true);
    assert.equal(out.scanTargetRoot, BENCHMARK);
    assert.equal(out.misscopedPlatformCodeWalk, true);
    assert.equal(out.roadmapHealthStatus, 'benchmark-misscoped-review');
    assert.equal(out.v1InternalDeploy, undefined);
    assert.ok(!JSON.stringify(out.developmentPhases).includes('Sprint 4'));
    assert.ok(!JSON.stringify(out.recommendations).includes('simplebeacon:deploy'));
    assert.ok(out.exportNotes.some((note) => /Mis-scoped complete-scan export/i.test(note)));
});

test('sanitizeRoadmapExport normalizes frozen Simplebeacon benchmark roadmap Downloads (3) via filename inference', () => {
    const fixturePath = path.join(
        'J:',
        'Downloads',
        'c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(3).json'
    );
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeRoadmapExport(raw, {
        exportFilename: 'c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(3).json'
    });

    assert.equal(out.benchmarkScan, true);
    assert.equal(out.misscopedPlatformCodeWalk, true);
    assert.match(out.projectTitle, /tjp420-simplebeacon/i);
    assert.ok(!/simplebeacon-platform/i.test(out.projectTitle));
    assert.equal(out.v1InternalDeploy, undefined);
    assert.ok(!/85\.4%/.test(out.strategicInsights?.complianceNarrative || ''));
    assert.equal(out.codeAnalysis.features.length, 0);
    assert.equal(out.aiIntegration.apiRouteCount, null);
    assert.equal(out.progressMetrics.metrics.apiRouteCount, null);
});

test('sanitizeRoadmapExport normalizes clone-scoped benchmark roadmap Downloads export (4)', () => {
    const fixturePath = path.join(
        'J:',
        'Downloads',
        'c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(4).json'
    );
    if (!fs.existsSync(fixturePath)) {
        return;
    }
    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeRoadmapExport(raw, {
        exportFilename: 'c-users-trevor-cascadeprojects-ai-platform-github-cache-tjp420-simplebeacon-2026-05-31(4).json'
    });

    assert.equal(out.benchmarkScan, true);
    assert.equal(out.misscopedPlatformCodeWalk, undefined);
    assert.equal(out.roadmapHealthStatus, 'benchmark-hygiene');
    assert.match(out.sourceProjectPath, /^C:\/Users\/Trevor\/CascadeProjects\/ai-platform\/github-cache\/tjp420-simplebeacon$/);
    assert.equal(out.exportNotes.filter((note) => /v1-internal deploy block/i.test(note)).length, 1);
    assert.equal(out.projectStructure.totalFiles, 176);
    assert.equal(out.projectStructure.totalFilesTopLevel, 56);
    assert.equal(out.benchmarkSprintModel.phasesRef, 'developmentPhases');
    assert.equal(out.benchmarkSprintModel.phases, undefined);
    assert.equal(out.codebaseMetrics.benchmarkMetricsNote, 'Product codebaseMetrics template omitted on OSS clone — see codeAnalysis.structure.');
    assert.equal(out.aiIntegration.features, undefined);
    assert.equal(out.aiIntegration.benchmarkAiNote, 'Generic AI capability flags omitted on OSS benchmark clone — route inventory only.');
    assert.equal(out.strategicInsights.recommendations[0].category, 'benchmark');
    assert.match(out.strategicInsights.recommendations[0].businessValue, /not product deploy evidence/i);
});

test('dedupeRoadmapExportNotes collapses near-duplicate v1-internal export notes', () => {
    const { dedupeRoadmapExportNotes } = require('../src/lib/roadmap-export-sanitize');
    const notes = [
        'Simplebeacon v1-internal deploy block, template sprint phases, and CI recommendations removed or replaced for github-cache/ benchmark target.',
        'Simplebeacon v1-internal deploy block removed for github-cache/ benchmark target.'
    ];
    const out = dedupeRoadmapExportNotes(notes);
    assert.equal(out.length, 1);
});

test('sanitizeRoadmapExport drops stale empty codebaseMetrics on product exports', () => {
    const out = sanitizeRoadmapExport({
        type: 'dynamic-project-roadmap-analysis',
        sourceProjectPath: 'C:/repo/ai-platform',
        platformRoot: 'C:/repo/ai-platform',
        codebaseMetrics: {
            totalLinesOfCode: 0,
            languages: {},
            complexity: {},
            testCoverage: 0,
            documentation: { readmeFiles: 0, totalDocs: 0, coverage: 0 },
            dependencies: {}
        },
        projectStructure: { totalFiles: 62 },
        codeAnalysis: { structure: { totalFiles: 734 } }
    });

    assert.equal(out.codebaseMetrics, undefined);
    assert.match(out.projectStructure.note, /734/);
});

test('sanitizeRoadmapExport redacts product operator export paths and strips stale coverage fiction', () => {
    const raw = {
        type: 'dynamic-project-roadmap-analysis',
        sourceProjectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        platformRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        requestedScanRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        scanTargetRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        progressMetrics: {
            metrics: {
                testCoverage: 85.4,
                lineCoverage: 85.4,
                branchCoverage: 66.7,
                jestTests: null,
                jestSuites: null
            }
        },
        projectStructure: {
            projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
            platformRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
            mainCategories: {
                server: {
                    name: 'server',
                    path: 'C:/Users/Trevor/CascadeProjects/ai-platform/server'
                }
            }
        },
        rejectedFiction: { warning: 'Enterprise roadmap design claims not produced by this scanner' },
        strategicInsights: {
            complianceNarrative: 'Test coverage (85.4%) supports SOC 2 change-management evidence.',
            sourceMetrics: { testCoverage: 85.4, lineCoverage: 85.4 },
            llmDisclaimer: 'LLM narrative is advisory; deterministic metrics are source of truth.'
        }
    };

    const out = sanitizeRoadmapExport(raw, {
        requestedProjectPath: raw.sourceProjectPath
    });

    assert.equal(out.exportNormalized, true);
    assert.equal(out.securityHandoffEligible, false);
    assert.equal(out.sourceProjectPath, 'ai-platform');
    assert.equal(out.projectStructure.projectRoot, 'ai-platform');
    assert.equal(out.projectStructure.mainCategories.server.path, 'ai-platform/server');
    assert.equal(out.progressMetrics.metrics.testCoverage, null);
    assert.equal(out.coverageEvidenceSource, 'omitted-stale-prior');
    assert.equal(out.strategicInsights.sourceMetrics.testCoverage, null);
    assert.ok(!/85\.4%/.test(out.strategicInsights.complianceNarrative));
    assert.ok(out.exportNotes.some((n) => /securityHandoffEligible is false/i.test(String(n))));
});

test('sanitizeRoadmapExport strips strategicInsights fiction when progressMetrics coverage already null', () => {
    const raw = {
        type: 'dynamic-project-roadmap-analysis',
        sourceProjectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        codeAnalysis: { structure: { totalFiles: 790 } },
        progressMetrics: {
            metrics: {
                testCoverage: null,
                lineCoverage: null,
                jestTests: null,
                jestSuites: null,
                testCoverageNote: 'Coverage % omitted — no live Jest baseline paired in this scan; run npm test with Istanbul before citing in handoffs.'
            }
        },
        rejectedFiction: { warning: 'Enterprise roadmap design claims not produced by this scanner' },
        strategicInsights: {
            executiveSummary: 'The current test coverage of 0% indicates a lack of assurance.',
            llmSummary: 'The current test coverage of 0% indicates a lack of assurance.',
            riskAssessment: {
                riskFactors: [{
                    description: 'Test coverage at 0% — below common enterprise diligence thresholds',
                    recommendation: 'Expand Jest/Istanbul coverage on critical server paths'
                }]
            },
            sourceMetrics: { testCoverage: 0, lineCoverage: 0 },
            llmDisclaimer: 'LLM narrative is advisory; deterministic metrics are source of truth.'
        }
    };

    const out = sanitizeRoadmapExport(raw, {
        requestedProjectPath: raw.sourceProjectPath,
        repositoryFilesTotal: 1685
    });

    assert.equal(out.coverageEvidenceSource, 'omitted-stale-prior');
    assert.equal(out.strategicInsights.sourceMetrics.testCoverage, null);
    assert.equal(out.strategicInsights.llmAdvisoryOnly, true);
    assert.ok(!/0%/.test(out.strategicInsights.llmSummary || ''));
    assert.ok(out.exportNotes.some((n) => /progressMetrics coverage % removed/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /790.*1,685/i.test(String(n))));
    assert.equal(out.hygieneSummary?.gateRepositoryFilesTotal, 1685);
    assert.equal(out.scanScope?.resultsViewScope, 'filesystem-roadmap-advisory');
});

test('sanitizeRoadmapExport strips Desktop-like LLM coverage fiction from strategicInsights', () => {
    const raw = {
        type: 'dynamic-project-roadmap-analysis',
        sourceProjectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        progressMetrics: {
            metrics: {
                testCoverage: null,
                lineCoverage: null,
                jestTests: null,
                jestSuites: null
            }
        },
        strategicInsights: {
            executiveSummary: '* Despite the high code file analysis rate (748/790), test coverage remains at 0%, posing a risk.\n* **High Priority:** Improve test coverage to at least 70% within the next sprint cycle.',
            llmSummary: 'The current 0% test coverage poses a moderate to high risk.',
            sourceMetrics: { testCoverage: null, lineCoverage: null },
            recommendations: [{
                priority: 'HIGH',
                action: 'Improve test coverage to at least 70% within the next sprint cycle'
            }]
        }
    };

    const out = sanitizeRoadmapExport(raw, {
        requestedProjectPath: raw.sourceProjectPath,
        repositoryFilesTotal: 1685,
        gateReport: { jestBaselineChecked: false }
    });

    const blob = `${out.strategicInsights.executiveSummary} ${out.strategicInsights.llmSummary}`;
    assert.ok(!/\b0%\b/.test(blob));
    assert.ok(!/\b70%\b/.test(blob));
    assert.ok(out.exportNotes.some((n) => /did not pair live Jest/i.test(String(n))));
});

test('sanitizeRoadmapExport enriches operator export with gate inventory and fixes truncated LLM risk text', () => {
    const gateReport = {
        gate: { pass: true, blockingCount: 0 },
        repositoryFilesTotal: 1685,
        credentialScanned: 1639,
        fictionJsonFilesScanned: 184,
        fictionSampleFilesScanned: 6,
        jestBaselineChecked: false,
        scanScope: { profile: 'eu-ai-act' }
    };
    const raw = {
        type: 'dynamic-project-roadmap-analysis',
        sourceProjectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        codeAnalysis: { structure: { totalFiles: 790 } },
        progressMetrics: { metrics: { testCoverage: null, lineCoverage: null, jestTests: null, jestSuites: null } },
        rejectedFiction: { warning: 'Enterprise roadmap design claims not produced by this scanner' },
        strategicInsights: {
            llmSummary: '• **Risk Level:** Moderate risk associated with low test coverage\n**Conclusion:** high risk associated with low test coverage and lack of documentation.',
            sourceMetrics: { testCoverage: 0, lineCoverage: 0 },
            llmDisclaimer: 'LLM narrative is advisory; deterministic metrics are source of truth.'
        }
    };

    const out = sanitizeRoadmapExport(raw, {
        requestedProjectPath: raw.sourceProjectPath,
        repositoryFilesTotal: 1685,
        gateReport
    });

    assert.equal(out.scanScope?.gateRuleBundleProfile, 'eu-ai-act');
    assert.equal(out.hygieneSummary?.credentialScanned, 1639);
    assert.equal(out.hygieneSummary?.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary?.gateMetadataOnlyFiles, 46);
    assert.ok(out.exportNotes.some((n) => /CRED\/LEAK rules scanned/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /DATA-002 evaluated/i.test(String(n))));
    assert.ok(out.exportNotes.some((n) => /eu-ai-act/i.test(String(n))));
    assert.ok(!/associated with low\s*\n/i.test(out.strategicInsights.llmSummary || ''));
    assert.ok(/live test coverage not measured/i.test(out.strategicInsights.llmSummary || ''));
});

test('sanitizeRoadmapExport enriches gate FAIL operator export with blocking context', () => {
    const gateReport = {
        gate: { pass: false, blockingCount: 1 },
        repositoryFilesTotal: 1685,
        credentialScanned: 1639,
        fictionJsonFilesScanned: 184,
        fictionSampleFilesScanned: 6,
        jestBaselineChecked: false,
        scanScope: { profile: 'eu-ai-act' }
    };
    const out = sanitizeRoadmapExport({
        type: 'dynamic-project-roadmap-analysis',
        sourceProjectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        codeAnalysis: { structure: { totalFiles: 790 } },
        coverageEvidenceSource: 'omitted-stale-prior',
        strategicInsights: { llmAdvisoryOnly: true }
    }, {
        requestedProjectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        repositoryFilesTotal: 1685,
        gateReport
    });

    assert.equal(out.hygieneSummary.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary.blockingCount, 1);
    assert.equal(out.hygieneSummary.gatePass, false);
    assert.ok(out.exportNotes.some((n) => /Gate FAIL — 1 blocking/i.test(String(n))));
});

test('sanitizeRoadmapExport idempotently re-sanitizes enriched product export from embedded gate context', () => {
    const enriched = {
        type: 'dynamic-project-roadmap-analysis',
        sourceProjectPath: 'ai-platform',
        codeAnalysis: { structure: { totalFiles: 790 } },
        coverageEvidenceSource: 'omitted-stale-prior',
        exportSanitized: true,
        scanScope: {
            gateRepositoryFilesTotal: 1685,
            gateRuleBundleProfile: 'eu-ai-act',
            securityHandoffEligible: false
        },
        hygieneSummary: {
            gateRepositoryFilesTotal: 1685,
            contentFilesScanned: 1639,
            credentialScanned: 1639,
            gateMetadataOnlyFiles: 46,
            fictionJsonFilesScanned: 184,
            fictionSampleFilesScanned: 6,
            gateRuleBundleProfile: 'eu-ai-act',
            gatePass: false,
            blockingCount: 1,
            jestBaselineChecked: false
        }
    };
    const out = sanitizeRoadmapExport(enriched, {
        requestedProjectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform'
    });
    const out2 = sanitizeRoadmapExport(out, {
        requestedProjectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform'
    });
    assert.equal(out.hygieneSummary.contentFilesScanned, 1639);
    assert.equal(out.hygieneSummary.fictionJsonFilesScanned, 184);
    assert.deepEqual(out2.hygieneSummary, out.hygieneSummary);
    assert.deepEqual(out2.exportNotes, out.exportNotes);
});
