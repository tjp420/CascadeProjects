const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
    sanitizeAiProblemAnalyzerExport,
    aiProblemAnalyzerExportFilename,
    reconcileRiskSummary,
    enrichAnalyzerResultForExport
} = require('../src/lib/ai-problem-analyzer-export-sanitize');

const SAMPLE_ANALYSIS = {
    summary: { selectedIssueCount: 2, implementedCount: 2, stubCount: 0 },
    categoryDistribution: [{ categoryId: 'technical-ai-issues', categoryName: 'Technical AI Issues', selectedCount: 2, percentage: 100 }],
    riskSummary: {
        overallRiskLevel: 'Low',
        averageRiskScore: 12,
        totalRiskScore: 24,
        measuredAnalyzerCount: 2,
        executionStatus: { measured: 2, insufficientData: 0, stub: 0 },
        severityCounts: { critical: 0, high: 0, medium: 0, low: 2 }
    },
    topPriorityIssues: [],
    coverageGaps: [],
    mitigationThemes: [{ categoryId: 'technical-ai-issues', categoryName: 'Technical AI Issues', themes: ['a', 'b'] }],
    architecture: { dataCollectionLayer: { selectedIssueCount: 2, selectedIssueIds: ['A-01', 'A-02'] } },
    analyzerResults: [
        { id: 'A-01', analyzerId: 'hallucination-analyzer', status: 'implemented', severity: 'low', score: 10, riskBand: 'Low', evidenceStatus: 'limited_data', metrics: [{ direction: 'lower_better' }] },
        { id: 'A-02', analyzerId: 'regulatory-compliance-analyzer', status: 'implemented', severity: 'critical', score: 9.17, riskBand: 'High', evidenceStatus: 'sufficient', metrics: [{ direction: 'higher_better' }] }
    ],
    payload: {
        type: 'ai-problem-analyzer-suite',
        selectedIssueIds: ['A-01', 'A-02'],
        selectedIssueCount: 2,
        registry: [{ id: 'hallucination-analyzer', name: 'Hallucination Analyzer' }]
    }
};

test('sanitizeAiProblemAnalyzerExport wraps analyzer suite output with export metadata', () => {
    const out = sanitizeAiProblemAnalyzerExport(SAMPLE_ANALYSIS, {
        projectPath: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        context: {
            inputKind: 'scan-report',
            scannedAt: '2026-05-31T12:00:00.000Z',
            healthScore: 88
        }
    });

    assert.equal(out.exportVersion, '1.3.0');
    assert.equal(out.title, 'SimpleBeacon AI Problem Analyzer Suite — ai-platform');
    assert.equal(out.payload.selectedIssueIds, undefined);
    assert.equal(out.payload.selectedIssueIdsRef, 'root.selectedIssueIds');
    assert.ok(out.hygieneSummary);
    assert.ok(out.mitigationThemes.sharedThemes);
    assert.equal(out.analyzerResults[1].metricScore, 9.17);
    assert.equal(out.analyzerResults[1].riskScore, 90.83);
    assert.equal(out.analyzerResults[1].scoringDirection, 'higher_better');
    assert.equal(out.analyzerResults[1].score, undefined);
    assert.ok(out.riskSummary.riskBandLegend);
    assert.ok(!out.exportNotes.some((note) => note === out.riskSummary.overallRiskLevelNote));
});

test('enrichAnalyzerResultForExport inverts higher_better metric scores for riskScore', () => {
    const result = enrichAnalyzerResultForExport({
        id: 'A-19',
        severity: 'critical',
        score: 9.17,
        metrics: [{ direction: 'higher_better' }]
    });
    assert.equal(result.metricScore, 9.17);
    assert.equal(result.riskScore, 90.83);
    assert.equal(result.scoringDirection, 'higher_better');
});

test('reconcileRiskSummary adds peakSeverity and note when average Low but critical present', () => {
    const risk = reconcileRiskSummary({
        overallRiskLevel: 'Low',
        averageRiskScore: 22.32,
        severityCounts: { critical: 2, high: 3, medium: 4, low: 20 }
    });
    assert.equal(risk.peakSeverity, 'critical');
    assert.match(String(risk.overallRiskLevelNote || ''), /peakSeverity is critical/i);
});

test('aiProblemAnalyzerExportFilename uses project slug and date', () => {
    const name = aiProblemAnalyzerExportFilename('C:/Users/Trevor/CascadeProjects/ai-platform', new Date('2026-05-31T00:00:00.000Z'));
    assert.equal(name, 'ai-problem-analyzer-ai-platform-2026-05-31.json');
});

test('sanitizeAiProblemAnalyzerExport fixes frozen Downloads export (1)', () => {
    const fixturePath = path.join('J:', 'Downloads', 'ai-problem-analyzer-ai-platform-2026-05-31(1).json');
    if (!fs.existsSync(fixturePath)) return;

    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const { sanitizedAt: _sanitizedAt, generatedAt: _generatedAt, ...frozenBody } = raw;
    const out = sanitizeAiProblemAnalyzerExport(frozenBody, {
        projectPath: 'ai-platform',
        context: { inputKind: raw.inputKind, scannedAt: raw.scannedAt, healthScore: raw.healthScore }
    });

    const a19 = out.analyzerResults.find((result) => result.id === 'A-19');
    const top = out.topPriorityIssues.find((issue) => issue.id === 'A-19');

    assert.equal(out.exportVersion, '1.3.0');
    assert.equal(out.payload.selectedIssueIds, undefined);
    assert.equal(a19.metricScore, 9.17);
    assert.equal(a19.riskScore, 90.83);
    assert.equal(a19.scoringDirection, 'higher_better');
    assert.equal(a19.score, undefined);
    assert.equal(top.riskScore, 90.83);
    assert.equal(top.metricScore, 9.17);
    assert.ok(out.hygieneSummary);
    assert.ok(out.mitigationThemes.sharedThemes);
    const peakNotes = out.exportNotes.filter((note) => /peakSeverity/i.test(String(note)));
    assert.equal(peakNotes.length, 1);
    assert.match(String(peakNotes[0]), /healthScore 100/i);
    assert.match(String(peakNotes[0]), /riskScore/i);
    assert.doesNotMatch(JSON.stringify(out), /CascadeProjects/i);
});

test('sanitizeAiProblemAnalyzerExport fixes frozen Downloads export', () => {
    const fixturePath = path.join('J:', 'Downloads', 'ai-problem-analyzer-ai-platform-2026-05-31.json');
    if (!fs.existsSync(fixturePath)) return;

    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const { sanitizedAt: _sanitizedAt, generatedAt: _generatedAt, ...frozenBody } = raw;
    const out = sanitizeAiProblemAnalyzerExport(frozenBody, {
        projectPath: 'ai-platform',
        context: { inputKind: raw.inputKind, scannedAt: raw.scannedAt, healthScore: raw.healthScore }
    });

    assert.equal(out.exportVersion, '1.3.0');
    assert.equal(out.payload.registry, undefined);
    assert.equal(out.riskSummary.peakSeverity, 'critical');
});

test('sanitizeAiProblemAnalyzerExport fixes frozen Downloads export (2)', () => {
    const fixturePath = path.join('J:', 'Downloads', 'ai-problem-analyzer-ai-platform-2026-05-31(2).json');
    if (!fs.existsSync(fixturePath)) return;

    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const { sanitizedAt: _sanitizedAt, generatedAt: _generatedAt, ...frozenBody } = raw;
    const out = sanitizeAiProblemAnalyzerExport(frozenBody, {
        projectPath: 'ai-platform',
        context: { inputKind: raw.inputKind, scannedAt: raw.scannedAt, healthScore: raw.healthScore }
    });

    assert.equal(out.exportVersion, '1.3.0');
    assert.ok(out.riskSummary.riskBandLegend);
    assert.equal(out.riskSummary.riskBandLegend.High, 'critical');
    assert.ok(out.analyzerResults.every((result) => result.score === undefined));
    assert.equal(out.architecture?.dataCollectionLayer?.selectedMethodDefinitions, undefined);
    assert.equal(out.architecture?.dataCollectionLayer?.selectedIssueIdsRef, 'root.selectedIssueIds');
    assert.equal(out.architecture?.dataCollectionLayer?.selectedIssueIds, undefined);
    assert.ok(!out.architecture?.keyDesignPrinciples?.some((p) => /contract-valid safe stubs/i.test(String(p))));
    const peakNotes = out.exportNotes.filter((note) => /peakSeverity/i.test(String(note)));
    assert.equal(peakNotes.length, 1);
    assert.match(String(peakNotes[0]), /healthScore 100/i);
    assert.ok(out.exportNotes.some((note) => /8 prioritized coverage gap/i.test(String(note)) && /19 total insufficient_data/i.test(String(note))));
    assert.ok(out.analysisGeneratedAt || out.scannedAt);
    assert.doesNotMatch(JSON.stringify(out), /CascadeProjects/i);
});

test('sanitizeAiProblemAnalyzerExport fixes frozen Downloads export 2026-06-01', () => {
    const fixturePath = path.join('J:', 'Downloads', 'ai-problem-analyzer-ai-platform-2026-06-01.json');
    if (!fs.existsSync(fixturePath)) return;

    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const { sanitizedAt: _sanitizedAt, generatedAt: _generatedAt, ...frozenBody } = raw;
    const out = sanitizeAiProblemAnalyzerExport(frozenBody, {
        projectPath: 'ai-platform',
        context: { inputKind: raw.inputKind, scannedAt: raw.scannedAt, healthScore: raw.healthScore }
    });

    assert.equal(out.exportVersion, '1.3.0');
    assert.equal(out.riskSummary.peakSeverity, 'critical');
    const a19 = out.analyzerResults.find((result) => result.id === 'A-19');
    assert.equal(a19.metricScore, 9.17);
    assert.equal(a19.riskScore, 90.83);
    assert.ok(out.hygieneSummary.attestationNote.includes('healthScore'));
});
