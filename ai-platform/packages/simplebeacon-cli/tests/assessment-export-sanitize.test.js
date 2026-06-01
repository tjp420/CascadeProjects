const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { sanitizeAssessmentExport } = require('../src/lib/assessment-export-sanitize');

const SOURCE_REPORT = {
    projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
    gate: { pass: true, blockingCount: 0, warningCount: 0 },
    qualityScore: 100,
    mockSampleFiles: 3,
    totalFiles: 3,
    ruleScopedFilesAnalyzed: 263,
    repositoryFilesTotal: 992,
    repositoryInventory: { totalFiles: 992 }
};

test('sanitizeAssessmentExport fixes frozen Downloads assessment export (5)', () => {
    const fixturePath = path.join('J:', 'Downloads', 'simplebeacon-assessment-2026-05-31(5).json');
    if (!fs.existsSync(fixturePath)) return;

    const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const out = sanitizeAssessmentExport(raw, { sourceReport: SOURCE_REPORT });

    assert.equal(out.title, 'SimpleBeacon Free Assessment — ai-platform');
    assert.equal(out.generatedBy, 'SimpleBeacon');
    assert.equal(out.complianceChecklist.title, 'SimpleBeacon Corporate Safety Checklist');
    assert.equal(out.executiveSummary.filesScanned, 263);
    assert.equal(out.executiveSummary.mockSampleFiles, 3);
    assert.equal(out.executiveSummary.complianceReady, true);
    assert.equal(out.complianceChecklist.summary.readyForAutomation, true);
    assert.equal(out.exportVersion, '1.1.0');
    assert.equal(out.exportSanitized, true);
    assert.equal(out.handoffEligible, false);
    assert.ok(Array.isArray(out.disclaimers) && out.disclaimers.length >= 3);
    assert.ok(Array.isArray(out.exportNotes) && out.exportNotes.length >= 1);
    assert.match(String(out.executiveSummary.filesScannedNote || ''), /gate rule scope/i);
    assert.doesNotMatch(out.title, /Simplebeacon|Cascade AI Platform/);
});

test('sanitizeAssessmentExport redacts host paths and preserves embedded sourceReport slice', () => {
    const assessment = {
        type: 'simplebeacon-assessment-report',
        title: 'Simplebeacon Free Assessment — Cascade AI Platform',
        generatedBy: 'Simplebeacon',
        projectRoot: 'C:/Users/Trevor/CascadeProjects/ai-platform',
        executiveSummary: {
            gateResult: 'PASS',
            filesScanned: 3,
            complianceReady: false
        },
        complianceChecklist: {
            title: 'Simplebeacon Corporate Safety Checklist',
            summary: { passed: 5, failed: 0, readyForAutomation: false, headline: '5/5 applicable rules pass' },
            rules: [{ id: 'GATE-001', status: 'pass' }]
        },
        sourceReport: {
            generatedAt: '2026-05-31T19:33:29.126Z',
            scanPaths: ['data/mock'],
            duplicateGroups: 0
        }
    };

    const out = sanitizeAssessmentExport(assessment, { sourceReport: SOURCE_REPORT });

    assert.equal(out.projectRoot, 'ai-platform');
    assert.equal(out.sourceReport.scanPaths, assessment.sourceReport.scanPaths);
    assert.equal(out.sourceReport.generatedAt, assessment.sourceReport.generatedAt);
});
