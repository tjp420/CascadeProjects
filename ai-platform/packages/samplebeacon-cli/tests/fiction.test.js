const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
    checkSampleConsistency,
    deepIncludesFiction,
    detectStaleRoadmapTemplate,
    listSampleJsonFiles
} = require('../src/lib/sample-consistency-checker');

test('deepIncludesFiction ignores documentation mentions of rejected models', () => {
    const baseline = {
        rejectedFiction: {
            modelNames: ['unbreakable-oracle']
        }
    };
    const hits = deepIncludesFiction({
        modelInfo: {
            name: 'platform-checklist',
            notes: 'Replaced unbreakable-oracle fiction'
        },
        fictionRemoved: ['unbreakable-oracle'],
        previousModel: 'unbreakable-oracle'
    }, baseline);
    assert.equal(hits.length, 0);
});

test('deepIncludesFiction flags active model set to rejected name', () => {
    const baseline = {
        rejectedFiction: {
            modelNames: ['unbreakable-oracle']
        }
    };
    const hits = deepIncludesFiction({
        modelInfo: { name: 'unbreakable-oracle' }
    }, baseline);
    assert.ok(hits.some((h) => h.includes('unbreakable-oracle')));
});

test('deepIncludesFiction detects 47 features and 98.5 confidence', () => {
    const baseline = {
        rejectedFiction: {
            featureCounts: [47],
            completionRates: [74.17, 62],
            aiConfidenceScores: [98.5]
        }
    };
    const hits = deepIncludesFiction({
        overview: { totalFeatures: 47, completionRate: 62 },
        modelInfo: { confidence: 98.5 }
    }, baseline);
    assert.ok(hits.some((h) => h.includes('47')));
    assert.ok(hits.some((h) => h.includes('62')));
    assert.ok(hits.some((h) => h.includes('98.5')));
});

test('deepIncludesFiction flags completionRate 62 in measured samples', () => {
    const baseline = {
        rejectedFiction: {
            completionRates: [62]
        }
    };
    const hits = deepIncludesFiction({
        overview: { completionRate: 62, totalFeatures: 4 }
    }, baseline);
    assert.ok(hits.some((h) => h.includes('62')));
});

test('deepIncludesFiction flags totalFeatures 8 in measured samples', () => {
    const baseline = {
        rejectedFiction: {
            featureCounts: [8]
        }
    };
    const hits = deepIncludesFiction({
        dataSource: 'repository-audit',
        projectOverview: { totalFeatures: 8, completionRate: 100 }
    }, baseline);
    assert.ok(hits.some((h) => h.includes('totalFeatures=8')));
});

test('deepIncludesFiction ignores bare number 8 outside totalFeatures', () => {
    const baseline = {
        rejectedFiction: {
            featureCounts: [8]
        }
    };
    const hits = deepIncludesFiction({
        dataSource: 'repository-audit',
        overview: { tierCount: 8, stubRoutes: 8 }
    }, baseline);
    assert.equal(hits.length, 0);
});

test('real ai-tools-sample overview metrics are not fiction KPIs', () => {
    const samplePath = path.join(__dirname, '../../../web/data/ai-tools-sample.json');
    if (!fs.existsSync(samplePath)) {
        return;
    }

    const payload = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
    const baseline = {
        rejectedFiction: {
            featureCounts: [8, 9],
            completionRates: [62]
        }
    };

    const hits = deepIncludesFiction(payload, baseline);
    assert.equal(hits.length, 0, `unexpected fiction hits: ${hits.join('; ')}`);
});

test('detectStaleRoadmapTemplate flags Sprint 3 in-progress at 75%', () => {
    const hits = detectStaleRoadmapTemplate({
        type: 'gguf-development-roadmap-report',
        dataSource: 'repository-audit',
        developmentPhases: [{
            phase: 'Sprint 3: Honest Dashboard Data',
            status: 'in-progress',
            progress: 75
        }]
    });
    assert.ok(hits.some((h) => h.includes('Sprint 3 stale template')));
});

test('detectStaleRoadmapTemplate flags 8 features at 62% combo', () => {
    const hits = detectStaleRoadmapTemplate({
        type: 'gguf-development-roadmap-report',
        dataSource: 'repository-audit',
        projectOverview: { totalFeatures: 8, completionRate: 62 }
    });
    assert.ok(hits.some((h) => h.includes('stale roadmap template')));
});

test('detectStaleRoadmapTemplate skips roadmap-comparison-report', () => {
    const hits = detectStaleRoadmapTemplate({
        type: 'roadmap-comparison-report',
        dataSource: 'repository-audit',
        developmentPhases: [{
            phase: 'Sprint 3: Honest Dashboard Data',
            status: 'in-progress',
            progress: 75
        }]
    });
    assert.equal(hits.length, 0);
});

test('deepIncludesFiction skips comparison report lenses', () => {
    const baseline = {
        rejectedFiction: {
            completionRates: [62],
            featureCounts: [47]
        }
    };
    const hits = deepIncludesFiction({
        type: 'roadmap-comparison-report',
        ggufReport: {
            completionRate: 62,
            totalFeatures: 8
        },
        aiReport: {
            completionRate: '53%'
        },
        differences: {
            completionRate: { gguf: 62, ai: 53 }
        },
        visualComparison: {
            charts: {
                completionRateComparison: {
                    data: [{ label: 'GGUF Assessment', value: 62 }]
                }
            }
        },
        overview: { totalFeatures: 4, completionRate: 100 }
    }, baseline);
    assert.equal(hits.length, 0);
});

test('deepIncludesFiction ignores catalog model registry entries', () => {
    const baseline = {
        rejectedFiction: {
            modelNames: ['unbreakable-oracle']
        }
    };
    const hits = deepIncludesFiction({
        modelInfo: { name: 'platform-checklist' },
        models: [{
            id: 'unbreakable-oracle-demo',
            name: 'unbreakable-oracle',
            status: 'registered'
        }]
    }, baseline);
    assert.equal(hits.length, 0);
});

test('checkSampleConsistency scans all sample files for fiction', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'truthcheck-fiction-'));
    const dataDir = path.join(tmp, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'anchor-sample.json'), `${JSON.stringify({
        type: 'test-model',
        dataSource: 'repository-audit',
        overview: { jestTests: '10/10' }
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(dataDir, 'other-sample.json'), `${JSON.stringify({
        type: 'test-model',
        overview: { totalFeatures: 47 }
    }, null, 2)}\n`);

    const result = await checkSampleConsistency(tmp, {
        sampleDir: 'data',
        baseline: {
            dataSource: 'repository-audit',
            jestTestsPassing: 10,
            jestTestsLabel: '10/10',
            rejectedFiction: { featureCounts: [47] }
        },
        anchorSamples: ['anchor-sample.json']
    });

    assert.equal(result.samplesScanned, 2);
    assert.ok(result.issues.some((i) => i.type === 'Fictional KPI' && i.filePath === 'other-sample.json'));
});

test('listSampleJsonFiles finds sample suffix files', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'truthcheck-list-'));
    fs.writeFileSync(path.join(tmp, 'a-sample.json'), '{}');
    fs.writeFileSync(path.join(tmp, 'b.json'), '{}');
    assert.deepEqual(listSampleJsonFiles(tmp), ['a-sample.json']);
});
