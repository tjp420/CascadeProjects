const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

function requireLib(name) {
    return require(path.join(__dirname, '..', 'src', 'lib', name));
}

// Smoke tests for simplebeacon CLI package

describe('Package structure', () => {
    it('has required entry points', () => {
        const indexPath = path.join(__dirname, '..', 'src', 'index.js');
        assert.ok(fs.existsSync(indexPath), 'src/index.js must exist');

        const binPath = path.join(__dirname, '..', 'bin', 'simplebeacon.js');
        assert.ok(fs.existsSync(binPath), 'bin/simplebeacon.js must exist');
    });

    it('package.json has valid version', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
        assert.ok(pkg.version, 'version must be defined');
        assert.match(pkg.version, /^\d+\.\d+\.\d+/, 'version must be semver');
        assert.ok(pkg.main, 'main entry must be defined');
        assert.ok(pkg.bin && pkg.bin.simplebeacon, 'simplebeacon bin must be defined');
    });
});

describe('Core modules load without errors', () => {
    it('src/index.js exports key functions', () => {
        const index = require(path.join(__dirname, '..', 'src', 'index.js'));
        assert.ok(typeof index.runScan === 'function', 'runScan must be exported');
        assert.ok(typeof index.evaluateGate === 'function', 'evaluateGate must be exported');
        assert.ok(typeof index.formatJsonReport === 'function', 'formatJsonReport must be exported');
    });

    it('reporters/json.js exports formatJsonReport', () => {
        const jsonReporter = require(path.join(__dirname, '..', 'src', 'reporters', 'json.js'));
        assert.ok(typeof jsonReporter.formatJsonReport === 'function', 'formatJsonReport must be exported');
    });

    it('lib/normalize-scan-report.js exports normalizePlatformScanReport', () => {
        const normalizer = require(path.join(__dirname, '..', 'src', 'lib', 'normalize-scan-report.js'));
        assert.ok(typeof normalizer.normalizePlatformScanReport === 'function', 'normalizePlatformScanReport must be exported');
    });
});

describe('JSON report enrichment', () => {
    it('formatJsonReport includes gate blockingIssues and warningIssues', () => {
        const { formatJsonReport } = require(path.join(__dirname, '..', 'src', 'reporters', 'json.js'));

        const mockReport = {
            projectRoot: '/test',
            totalFiles: 10,
            filesAnalyzed: 10,
            generatedAt: new Date().toISOString(),
            detectedIssues: [],
            issues: [],
            summary: { totalFindings: 0 },
            severityCounts: { critical: 0, high: 0, medium: 0, low: 0 }
        };

        const mockGate = {
            pass: true,
            failOn: ['high', 'critical'],
            warnOn: ['medium'],
            blockingIssues: [],
            warningIssues: []
        };

        const result = formatJsonReport(mockReport, mockGate);
        assert.ok(result.gate, 'report must have gate object');
        assert.ok(Array.isArray(result.gate.blockingIssues), 'gate.blockingIssues must be an array');
        assert.ok(Array.isArray(result.gate.warningIssues), 'gate.warningIssues must be an array');
    });

    it('formatJsonReport includes module summary objects', () => {
        const { formatJsonReport } = require(path.join(__dirname, '..', 'src', 'reporters', 'json.js'));

        const mockReport = {
            projectRoot: '/test',
            totalFiles: 10,
            filesAnalyzed: 10,
            generatedAt: new Date().toISOString(),
            detectedIssues: [],
            issues: [],
            summary: { totalFindings: 0 },
            severityCounts: { critical: 0, high: 0, medium: 0, low: 0 }
        };

        const result = formatJsonReport(mockReport, { pass: true, blockingIssues: [], warningIssues: [] });
        assert.ok(result.consolidation, 'report must have consolidation module');
        assert.ok(result.codebase, 'report must have codebase module');
        assert.ok(result.dataQuality, 'report must have dataQuality module');
        assert.ok(result.cleanup, 'report must have cleanup module');
        assert.ok(result.compliance, 'report must have compliance module');
        assert.ok(result.fileReduction, 'report must have fileReduction module');
    });
});

describe('Report sanitizer', () => {
    it('preserves gate blockingIssues and warningIssues arrays', () => {
        const { sanitizeScanReport } = requireLib('report-sanitizer.js');

        const report = {
            gate: {
                pass: false,
                blockingCount: 2,
                blockingIssues: [
                    { severity: 'high', type: 'Credential', count: 1, filePath: 'config.js', impact: 'Exposed API key' }
                ],
                warningIssues: [
                    { severity: 'medium', type: 'Debug', count: 3, filePath: 'app.js' }
                ]
            }
        };

        const result = sanitizeScanReport(report);
        assert.ok(Array.isArray(result.gate.blockingIssues), 'blockingIssues must survive sanitization');
        assert.strictEqual(result.gate.blockingIssues.length, 1, 'blockingIssues length must be preserved');
        assert.ok(Array.isArray(result.gate.warningIssues), 'warningIssues must survive sanitization');
        assert.strictEqual(result.gate.warningIssues.length, 1, 'warningIssues length must be preserved');
        assert.strictEqual(result.gate.blockingIssues[0].type, 'Credential', 'issue type must be preserved');
    });

    it('redacts secrets in strings but preserves structure', () => {
        const { sanitizeScanReport } = requireLib('report-sanitizer.js');

        const report = {
            gate: {
                blockingIssues: [
                    { filePath: 'env.js', snippet: 'API_KEY = "sk-1234567890abcdef"' }
                ]
            }
        };

        const result = sanitizeScanReport(report);
        const snippet = result.gate.blockingIssues[0].snippet;
        assert.ok(!snippet.includes('sk-1234567890abcdef'), 'secret must be redacted');
        assert.ok(snippet.includes('REDACTED') || snippet.includes('████████████████'), 'redaction marker must be present');
    });
});
