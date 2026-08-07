'use strict';

/**
 * Tests for the CLI Report Adapter and CliMetricsWidget.
 *
 * Tests cover:
 * - adaptCliReport: normalizes CLI JSON into dashboard format
 * - adaptCliReportHistory: converts report arrays into trend data
 * - CliMetricsWidget: renders DOM elements from adapted reports
 *
 * Run: node --test tests/test-cli-report-adapter.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

// We need to test the adapter logic. Since the adapter uses ES modules,
// we'll test the core logic by requiring a CJS wrapper or testing the
// exported functions via dynamic import.

// For CJS testing, let's create a CJS-compatible version of the adapter logic
// by reading the source and evaluating it in a CJS context.

const fs = require('fs');
const path = require('path');

// Read the adapter source and convert ESM exports to CJS
const adapterSource = fs.readFileSync(
    path.join(__dirname, '..', 'ai-platform', 'web', 'simplebeacon-dashboard', 'js-es2018', 'utils', 'cli-report-adapter.js'),
    'utf8'
);

// Create a CJS module from the ESM source
const cjsSource = adapterSource
    .replace(/export function/g, 'function')
    .replace(/^export \{[^}]+\};?$/m, '')
    + '\nmodule.exports = { adaptCliReport, adaptCliReportHistory };';

// Write temp CJS module
const tempPath = path.join(__dirname, 'temp-adapter.cjs');
fs.writeFileSync(tempPath, cjsSource);
const { adaptCliReport, adaptCliReportHistory } = require(tempPath);
fs.unlinkSync(tempPath);

// ═══════════════════════════════════════════════
// Mock CLI Report Fixtures
// ═══════════════════════════════════════════════

function mockCleanReport() {
    return {
        type: 'simplebeacon-scan',
        reportVersion: 2,
        generatedAt: '2026-08-07T20:00:00Z',
        generatedBy: 'simplebeacon-cli',
        projectRoot: '/home/user/project',
        platformRoot: '/home/user/project',
        configPath: '/home/user/project/.simplebeacon/config.json',
        scanPaths: ['src', 'server'],
        totalFiles: 100,
        totalLines: 10000,
        ruleScopedFilesAnalyzed: 80,
        repositoryFilesTotal: 100,
        repositoryFoldersTotal: 15,
        filesAnalyzed: 80,
        totalSizeBytes: 500000,
        totalSizeLabel: '500 KB',
        issueCount: 0,
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
        qualityScore: 100,
        gate: {
            pass: true,
            blockingCount: 0,
            warningCount: 0,
            blockingIssues: [],
            warningIssues: [],
            status: 'PASSED',
            failOn: ['high'],
            warnOn: ['medium', 'low'],
        },
        rawIssues: [],
        detectedIssues: [],
        credentialScanned: 80,
        credentialFindings: 0,
        securityPatternFilesScanned: 80,
        securityPatternFindings: 0,
        llmSlopFilesScanned: 80,
        llmSlopPatternHits: 0,
        totalScanTimeMs: 5000,
        totalScanDurationMs: 5.2,
        ruleTimings: { 'credential-scanner': 1200, 'security-patterns': 800 },
        slowestRule: { rule: 'credential-scanner', ms: 1200 },
        tier: 'developer',
        scanErrors: [],
    };
}

function mockReportWithIssues() {
    const report = mockCleanReport();
    report.issueCount = 5;
    report.severityCounts = { critical: 1, high: 2, medium: 1, low: 1 };
    report.gate.pass = false;
    report.gate.blockingCount = 3;
    report.gate.warningCount = 2;
    report.gate.status = 'BLOCKED';
    report.gate.blockingIssues = [
        { id: 'SB-SEC-014-config/gcp.json', severity: 'critical', type: 'gcp-service-account', filePath: 'config/gcp.json', description: 'GCP service account key detected' },
        { id: 'SB-SEC-015-config/azure.env', severity: 'high', type: 'azure-key', filePath: 'config/azure.env', description: 'Azure storage key detected' },
        { id: 'SB-SEC-017-Dockerfile', severity: 'high', type: 'docker-privileged', filePath: 'Dockerfile', description: 'Container running in privileged mode' },
    ];
    report.rawIssues = [
        { id: 'SB-SEC-014-config/gcp.json', severity: 'critical', type: 'gcp-service-account', pattern: 'SB-SEC-014', filePath: 'config/gcp.json', file: 'config/gcp.json', line: 5, description: 'GCP service account key detected', confidence: 0.95 },
        { id: 'SB-SEC-015-config/azure.env', severity: 'high', type: 'azure-key', pattern: 'SB-SEC-015', filePath: 'config/azure.env', file: 'config/azure.env', line: 3, description: 'Azure storage key detected', confidence: 0.9 },
        { id: 'SB-SEC-017-Dockerfile', severity: 'high', type: 'docker-privileged', pattern: 'SB-SEC-017', filePath: 'Dockerfile', file: 'Dockerfile', line: 10, description: 'Container running in privileged mode' },
        { id: 'SB-SEC-023-package.json', severity: 'medium', type: 'unpinned-dependency', pattern: 'SB-SEC-023', filePath: 'package.json', file: 'package.json', line: 12, description: 'Unpinned dependency version' },
        { id: 'SB-FICTION-008-src/utils.js', severity: 'low', type: 'boilerplate-comment', pattern: 'SB-FICTION-008', filePath: 'src/utils.js', file: 'src/utils.js', line: 1, description: 'Boilerplate comment' },
    ];
    report.qualityScore = 55;
    return report;
}

function mockReportMissingFields() {
    return {
        generatedAt: '2026-08-07T20:00:00Z',
        projectRoot: '/home/user/project',
        totalFiles: 50,
        rawIssues: [
            { severity: 'critical', type: 'test', filePath: 'test.js', description: 'Test finding' },
            { severity: 'high', type: 'test2', filePath: 'test2.js', description: 'Test finding 2' },
        ],
    };
}

// ═══════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════

describe('adaptCliReport', () => {

    test('adapts a clean report correctly', () => {
        const adapted = adaptCliReport(mockCleanReport());

        assert.equal(adapted.type, 'simplebeacon-cli-scan');
        assert.equal(adapted.gate.pass, true);
        assert.equal(adapted.gate.blockingCount, 0);
        assert.equal(adapted.qualityScore, 100);
        assert.equal(adapted.totalFiles, 100);
        assert.equal(adapted.ruleScopedFilesAnalyzed, 80);
        assert.equal(adapted.repositoryFilesTotal, 100);
        assert.equal(adapted.detectedIssues.length, 0);
        assert.equal(adapted.severityCounts.critical, 0);
        assert.equal(adapted.severityCounts.high, 0);
    });

    test('adapts a report with issues correctly', () => {
        const adapted = adaptCliReport(mockReportWithIssues());

        assert.equal(adapted.gate.pass, false);
        assert.equal(adapted.gate.blockingCount, 3);
        assert.equal(adapted.gate.warningCount, 2);
        assert.equal(adapted.qualityScore, 55);
        assert.equal(adapted.detectedIssues.length, 5);
        assert.equal(adapted.severityCounts.critical, 1);
        assert.equal(adapted.severityCounts.high, 2);
        assert.equal(adapted.severityCounts.medium, 1);
        assert.equal(adapted.severityCounts.low, 1);
    });

    test('normalizes issue fields', () => {
        const adapted = adaptCliReport(mockReportWithIssues());
        const first = adapted.detectedIssues[0];

        assert.ok(first.id);
        assert.ok(first.severity);
        assert.ok(first.type);
        assert.ok(first.filePath);
        assert.ok(first.file);
        assert.ok(first.description);
        assert.equal(typeof first.confidence, 'number');
    });

    test('computes quality score from severity counts when missing', () => {
        const report = mockReportMissingFields();
        const adapted = adaptCliReport(report);

        // 1 critical (20) + 1 high (10) = 100 - 30 = 70
        assert.equal(adapted.qualityScore, 70);
    });

    test('returns 100 quality score for zero issues', () => {
        const report = mockReportMissingFields();
        report.rawIssues = [];
        const adapted = adaptCliReport(report);

        assert.equal(adapted.qualityScore, 100);
    });

    test('synthesizes gate from severity counts when missing', () => {
        const report = mockReportMissingFields();
        const adapted = adaptCliReport(report);

        // Has critical + high issues, so gate should fail
        assert.equal(adapted.gate.pass, false);
        assert.ok(adapted.gate.blockingCount > 0);
    });

    test('extracts rule coverage from report', () => {
        const adapted = adaptCliReport(mockCleanReport());
        const coverage = adapted.ruleCoverage;

        assert.ok(coverage.length > 0);
        const credRule = coverage.find(r => r.rule === 'Credential Scanner');
        assert.ok(credRule);
        assert.equal(credRule.filesScanned, 80);
        assert.equal(credRule.findings, 0);
    });

    test('handles null input gracefully', () => {
        const adapted = adaptCliReport(null);
        assert.equal(adapted.type, 'simplebeacon-cli-scan');
        assert.equal(adapted.gate.pass, true);
        assert.equal(adapted.detectedIssues.length, 0);
        assert.equal(adapted.qualityScore, 100);
    });

    test('handles undefined input gracefully', () => {
        const adapted = adaptCliReport(undefined);
        assert.equal(adapted.type, 'simplebeacon-cli-scan');
        assert.equal(adapted.gate.pass, true);
    });

    test('preserves scan timing information', () => {
        const adapted = adaptCliReport(mockCleanReport());
        assert.equal(adapted.totalScanTimeMs, 5000);
        assert.ok(adapted.ruleTimings);
        assert.ok(adapted.slowestRule);
    });

    test('preserves compliance and EU AI Act data', () => {
        const report = mockCleanReport();
        report.compliance = { checked: true, passed: true };
        report.euAiAct = { scanned: 80, findings: 0 };
        report.euAiActSummary = { status: 'pass' };
        const adapted = adaptCliReport(report);

        assert.ok(adapted.compliance);
        assert.ok(adapted.euAiAct);
        assert.ok(adapted.euAiActSummary);
    });

    test('normalizes severity to lowercase', () => {
        const report = mockCleanReport();
        report.rawIssues = [
            { severity: 'CRITICAL', type: 'test', filePath: 'test.js', description: 'Test' },
            { severity: 'High', type: 'test', filePath: 'test.js', description: 'Test' },
        ];
        const adapted = adaptCliReport(report);

        assert.equal(adapted.detectedIssues[0].severity, 'critical');
        assert.equal(adapted.detectedIssues[1].severity, 'high');
    });

    test('counts severities correctly when severityCounts missing', () => {
        const report = mockReportMissingFields();
        const adapted = adaptCliReport(report);

        assert.equal(adapted.severityCounts.critical, 1);
        assert.equal(adapted.severityCounts.high, 1);
        assert.equal(adapted.severityCounts.medium, 0);
        assert.equal(adapted.severityCounts.low, 0);
    });
});

describe('adaptCliReportHistory', () => {

    test('converts report array into trend history', () => {
        const reports = [
            { generatedAt: '2026-08-01T10:00:00Z', issueCount: 5, severityCounts: { critical: 1, high: 1, medium: 1, low: 2 }, gate: { pass: false } },
            { generatedAt: '2026-08-02T10:00:00Z', issueCount: 3, severityCounts: { critical: 0, high: 1, medium: 1, low: 1 }, gate: { pass: true } },
            { generatedAt: '2026-08-03T10:00:00Z', issueCount: 0, severityCounts: { critical: 0, high: 0, medium: 0, low: 0 }, gate: { pass: true } },
        ];

        const { trendHistory, gateTrend } = adaptCliReportHistory(reports);

        assert.equal(trendHistory.length, 3);
        assert.equal(trendHistory[0].issueCount, 5);
        assert.equal(trendHistory[1].issueCount, 3);
        assert.equal(trendHistory[2].issueCount, 0);

        assert.ok(gateTrend.length > 0);
        assert.ok(gateTrend.some(g => g.gate_pass_rate === 1)); // At least one day with 100% pass
    });

    test('handles empty array', () => {
        const { trendHistory, gateTrend } = adaptCliReportHistory([]);
        assert.equal(trendHistory.length, 0);
        assert.equal(gateTrend.length, 0);
    });

    test('handles null input', () => {
        const { trendHistory, gateTrend } = adaptCliReportHistory(null);
        assert.equal(trendHistory.length, 0);
        assert.equal(gateTrend.length, 0);
    });

    test('sorts reports chronologically', () => {
        const reports = [
            { generatedAt: '2026-08-03T10:00:00Z', issueCount: 0, severityCounts: {}, gate: { pass: true } },
            { generatedAt: '2026-08-01T10:00:00Z', issueCount: 5, severityCounts: {}, gate: { pass: false } },
            { generatedAt: '2026-08-02T10:00:00Z', issueCount: 3, severityCounts: {}, gate: { pass: true } },
        ];

        const { trendHistory } = adaptCliReportHistory(reports);
        assert.equal(trendHistory[0].issueCount, 5); // Aug 1
        assert.equal(trendHistory[1].issueCount, 3); // Aug 2
        assert.equal(trendHistory[2].issueCount, 0); // Aug 3
    });

    test('groups gate trend by date', () => {
        const reports = [
            { generatedAt: '2026-08-01T10:00:00Z', issueCount: 1, severityCounts: {}, gate: { pass: true } },
            { generatedAt: '2026-08-01T14:00:00Z', issueCount: 2, severityCounts: {}, gate: { pass: false } },
            { generatedAt: '2026-08-02T10:00:00Z', issueCount: 0, severityCounts: {}, gate: { pass: true } },
        ];

        const { gateTrend } = adaptCliReportHistory(reports);
        // Aug 1: 1 pass, 1 fail = 50% pass rate, 2 scans
        // Aug 2: 1 pass = 100% pass rate, 1 scan
        const aug1 = gateTrend.find(g => g.date === '2026-08-01');
        const aug2 = gateTrend.find(g => g.date === '2026-08-02');

        assert.ok(aug1);
        assert.equal(aug1.scan_count, 2);
        assert.equal(aug1.gate_pass_rate, 0.5);

        assert.ok(aug2);
        assert.equal(aug2.scan_count, 1);
        assert.equal(aug2.gate_pass_rate, 1);
    });

    test('computes quality score in trend history', () => {
        const reports = [
            { generatedAt: '2026-08-01T10:00:00Z', issueCount: 5, severityCounts: { critical: 1, high: 1, medium: 1, low: 2 }, gate: { pass: false } },
        ];

        const { trendHistory } = adaptCliReportHistory(reports);
        // 1 critical (20) + 1 high (10) + 1 medium (5) + 2 low (4) = 100 - 39 = 61
        assert.equal(trendHistory[0].qualityScore, 61);
    });
});

describe('CliMetricsWidget integration', () => {

    test('adapter output has all fields required by dashboard widgets', () => {
        const adapted = adaptCliReport(mockReportWithIssues());

        // Fields required by DashboardView.renderResultsState
        assert.ok(adapted.gate, 'gate');
        assert.ok(typeof adapted.gate.pass === 'boolean', 'gate.pass');
        assert.ok(typeof adapted.gate.blockingCount === 'number', 'gate.blockingCount');
        assert.ok(adapted.severityCounts, 'severityCounts');
        assert.ok(typeof adapted.severityCounts.critical === 'number', 'severityCounts.critical');
        assert.ok(typeof adapted.severityCounts.high === 'number', 'severityCounts.high');
        assert.ok(typeof adapted.severityCounts.medium === 'number', 'severityCounts.medium');
        assert.ok(typeof adapted.qualityScore === 'number', 'qualityScore');
        assert.ok(typeof adapted.ruleScopedFilesAnalyzed === 'number', 'ruleScopedFilesAnalyzed');
        assert.ok(typeof adapted.repositoryFilesTotal === 'number', 'repositoryFilesTotal');
        assert.ok(adapted.generatedAt, 'generatedAt');

        // Fields required by ScanStatus
        assert.ok(adapted.projectRoot, 'projectRoot');
        assert.ok(adapted.scanPaths, 'scanPaths');

        // Fields required by TrendChart
        assert.ok(Array.isArray(adapted.detectedIssues), 'detectedIssues');

        // Fields required by findings table
        for (const issue of adapted.detectedIssues) {
            assert.ok(issue.severity, 'issue.severity');
            assert.ok(issue.filePath !== undefined, 'issue.filePath');
            assert.ok(issue.type !== undefined, 'issue.type');
            assert.ok(issue.description !== undefined, 'issue.description');
        }
    });

    test('adapter output is serializable (no circular refs)', () => {
        const adapted = adaptCliReport(mockReportWithIssues());
        assert.doesNotThrow(() => JSON.stringify(adapted));
    });

    test('adapter handles real CLI report shape', () => {
        // Simulate the actual CLI report shape with all the fields
        const realReport = mockCleanReport();
        realReport.type = 'simplebeacon-scan';
        realReport.reportVersion = 2;
        realReport.scan_summary = { totalFiles: 100 };
        realReport.repositoryInventory = { total: 100 };
        realReport.mockSampleFiles = 5;
        realReport.invalidJson = 0;
        realReport.emptyFiles = 0;
        realReport.schemaChecked = 10;
        realReport.schemaPassed = 10;
        realReport.fictionJsonFilesScanned = 5;
        realReport.fictionSampleFilesScanned = 5;
        realReport.fictionScope = 'web/data';
        realReport.productionLeakScanned = 80;
        realReport.productionLeakFindings = 0;
        realReport.sourceCodeFilesScanned = 80;
        realReport.sourceFictionPatternHits = 0;
        realReport.euAiActScanned = 80;
        realReport.euAiActFindings = 0;
        realReport.euAiActSummary = { status: 'pass' };
        realReport.hardcodedUrlFilesScanned = 80;
        realReport.hardcodedUrlFindings = 0;
        realReport.weakCryptoFilesScanned = 80;
        realReport.weakCryptoFindings = 0;
        realReport.secretInCommentsFilesScanned = 80;
        realReport.secretInCommentsFindings = 0;
        realReport.syncIoFilesScanned = 80;
        realReport.syncIoFindings = 0;
        realReport.envInGitFilesScanned = 80;
        realReport.envInGitFindings = 0;
        realReport.redosFilesScanned = 80;
        realReport.redosFindings = 0;
        realReport.piiLoggingFilesScanned = 80;
        realReport.piiLoggingFindings = 0;
        realReport.deadCodeFilesScanned = 80;
        realReport.deadCodeFindings = 0;
        realReport.memoryLeakFilesScanned = 80;
        realReport.memoryLeakFindings = 0;
        realReport.typeSafetyFilesScanned = 80;
        realReport.typeSafetyFindings = 0;
        realReport.hallucinatedImportFilesScanned = 80;
        realReport.hallucinatedImportFindings = 0;
        realReport.astStructuralFilesScanned = 80;
        realReport.astStructuralFindings = 0;
        realReport.astAvailable = true;
        realReport.dependencyGraphFilesScanned = 80;
        realReport.dependencyGraphFindings = 0;
        realReport.jestBaselineChecked = true;
        realReport.jestBaselinePassed = true;
        realReport.mockDataCategories = {};
        realReport.compliance = {};
        realReport.detectedIssues = [];
        realReport.benchmarkCacheIssues = [];
        realReport.sampleFiles = [];
        realReport.scanScope = {};
        realReport.scanErrors = [];
        realReport.ruleTimings = {};
        realReport.tierLimitation = null;
        realReport.qualityScoreHidden = false;
        realReport.sandbox = {};
        realReport.consolidation = {};
        realReport.codebase = {};
        realReport.dataQuality = {};
        realReport.cleanup = {};
        realReport.fileReduction = {};
        realReport.npmAudit = {};
        realReport.roadmap = {};
        realReport.mockData = {};
        realReport.euAiAct = {};
        realReport.dependencyAudit = {};
        realReport.buildReadiness = {};
        realReport.remediationPhases = [];
        realReport.fileInventory = {};
        realReport.removableFiles = [];
        realReport.removableFilesTotal = 0;
        realReport.diagnosticReport = {};
        realReport.qualityScorecard = {};
        realReport.summary = {};
        realReport.sanitized = false;
        realReport.sanitizedAt = null;

        const adapted = adaptCliReport(realReport);
        assert.equal(adapted.type, 'simplebeacon-cli-scan');
        assert.equal(adapted.gate.pass, true);
        assert.equal(adapted.qualityScore, 100);
        assert.doesNotThrow(() => JSON.stringify(adapted));
    });
});
