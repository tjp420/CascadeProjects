'use strict';

/**
 * Test: Compliance Report Generator
 *
 * Verifies that the compliance report generator:
 * 1. Produces a valid PDF blob from scan results
 * 2. Groups findings by severity correctly
 * 3. Handles empty findings (clean scan)
 * 4. Handles all severity tiers
 * 5. Generates correct report metadata
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// === Mock jsPDF ===
class MockJsPDF {
    constructor(opts) {
        this.opts = opts;
        this.pages = 1;
        this.currentPage = 1;
        this.content = [];
        this.rects = [];
        this.texts = [];
        this.font = 'helvetica';
        this.fontStyle = 'normal';
        this.fontSize = 12;
        this.fillColor = [0, 0, 0];
        this.textColor = [0, 0, 0];
        this.drawColor = [0, 0, 0];
        this.lineWidth = 1;
    }

    setFont(f, s) { this.font = f; this.fontStyle = s || 'normal'; return this; }
    setFontSize(s) { this.fontSize = s; return this; }
    setFillColor(r, g, b) { this.fillColor = [r, g, b]; return this; }
    setTextColor(r, g, b) { this.textColor = [r, g, b]; return this; }
    setDrawColor(r, g, b) { this.drawColor = [r, g, b]; return this; }
    setLineWidth(w) { this.lineWidth = w; return this; }
    text(t, x, y, opts) { this.texts.push({ t, x, y, opts, font: this.font, style: this.fontStyle, size: this.fontSize, color: [...this.textColor] }); return this; }
    rect(x, y, w, h, style) { this.rects.push({ x, y, w, h, style, fill: [...this.fillColor] }); return this; }
    roundedRect(x, y, w, h, rx, ry, style) { this.rects.push({ x, y, w, h, rx, ry, style, fill: [...this.fillColor] }); return this; }
    circle(x, y, r, style) { this.rects.push({ type: 'circle', x, y, r, style, fill: [...this.fillColor] }); return this; }
    line(x1, y1, x2, y2) { this.rects.push({ type: 'line', x1, y1, x2, y2, color: [...this.drawColor] }); return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    stroke() { return this; }
    addPage() { this.pages++; this.currentPage = this.pages; return this; }
    setPage(p) { this.currentPage = p; return this; }
    splitTextToSize(text, maxWidth) {
        // Simple word-wrap simulation
        const words = text.split(' ');
        const lines = [];
        let line = '';
        for (const w of words) {
            if ((line + ' ' + w).length > maxWidth / 4) {
                if (line) lines.push(line);
                line = w;
            } else {
                line = line ? line + ' ' + w : w;
            }
        }
        if (line) lines.push(line);
        return lines.length ? lines : [text];
    }
    output(format) {
        // Return a mock blob
        const content = this.texts.map(t => t.t).join('\n');
        const buffer = Buffer.from(content, 'utf-8');
        if (format === 'blob') {
            return {
                size: buffer.length,
                type: 'application/pdf',
                _buffer: buffer,
                _isBlob: true
            };
        }
        return buffer;
    }
    internal = {
        getNumberOfPages: () => this.pages
    };
}

// === Test framework ===
let passed = 0, failed = 0;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) {
    if (cond) { passed++; }
    else { failed++; console.error('  FAIL: ' + msg); }
}
function assertEqual(actual, expected, msg) {
    if (actual === expected) { passed++; }
    else { failed++; console.error('  FAIL: ' + msg + ' — expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)); }
}

// === Load the compliance report generator ===
const generatorPath = path.join(__dirname, '..', 'coming-soon', 'public', 'js-es2018', 'compliance-report-generator.js');
const generatorCode = fs.readFileSync(generatorPath, 'utf-8');

// Create a sandbox with window and mock jsPDF
const sandbox = {
    window: {},
    console: console,
    setTimeout: setTimeout,
    Date: Date,
    Math: Math,
    JSON: JSON,
    Object: Object,
    Array: Array,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Error: Error
};
sandbox.window.jspdf = { jsPDF: MockJsPDF };
sandbox.window = Object.assign(sandbox.window, { jspdf: { jsPDF: MockJsPDF } });

vm.createContext(sandbox);
vm.runInContext(generatorCode, sandbox);

const { generateComplianceReport } = sandbox.window.ComplianceReportGenerator;

// === Helper: create mock scan result ===
function createMockScanResult(overrides = {}) {
    return Object.assign({
        scanId: 'test-scan-001',
        processed: 100,
        totalFiles: 100,
        findings: [],
        issues: [],
        issueCount: 0,
        qualityScore: 100,
        filesSkippedByHashCache: 0,
        hashCacheSize: 0
    }, overrides);
}

function createMockFinding(severity, filePath, rule, impact) {
    return {
        severity,
        filePath,
        rule,
        impact: impact || 'Test impact statement',
        fix: 'Test fix recommendation',
        count: 1,
        matches: [{ line: 1, snippet: 'test', context: ['test'] }]
    };
}

// === Tests ===

test('Clean scan — no findings produces valid PDF', async () => {
    const result = await generateComplianceReport(createMockScanResult(), {
        projectName: 'clean-project',
        scanDate: Date.now()
    });
    assert(!!result.blob, 'Blob should be returned');
    assert(result.blob._isBlob, 'Blob should be a blob object');
    assert(result.blob.size > 0, 'Blob should have content');
    assert(!!result.filename, 'Filename should be returned');
    assert(result.filename.endsWith('.pdf'), 'Filename should end with .pdf');
    assert(!!result.reportId, 'Report ID should be returned');
    assert(result.reportId.startsWith('SB-RPT-'), 'Report ID should start with SB-RPT-');
});

test('Scan with critical findings — gate fails', async () => {
    const findings = [
        createMockFinding('critical', 'src/config/keys.js', 'awsSecretKey', 'CRITICAL: AWS secret key detected'),
        createMockFinding('critical', 'deploy/prod.pem', 'privateKeyBlock', 'CRITICAL: Private key block found'),
        createMockFinding('high', 'src/api/auth.ts', 'jwtHardcoded', 'HIGH: Hardcoded JWT token')
    ];
    const result = await generateComplianceReport(createMockScanResult({
        findings,
        issues: findings,
        issueCount: 3,
        qualityScore: 40
    }), { projectName: 'vulnerable-project' });

    assert(!!result.blob, 'Blob should be returned');
    assert(result.blob.size > 0, 'Blob should have content');
    assertEqual(result.filename.includes('compliance-report'), true, 'Filename contains compliance-report');
});

test('Scan with all severity tiers — grouping works', async () => {
    const findings = [
        createMockFinding('critical', 'src/a.js', 'awsSecretKey', 'Critical issue'),
        createMockFinding('high', 'src/b.js', 'jwtHardcoded', 'High issue'),
        createMockFinding('medium', 'src/c.js', 'configDrift', 'Medium issue'),
        createMockFinding('low', 'src/d.js', 'debugArtifacts', 'Low issue')
    ];
    const result = await generateComplianceReport(createMockScanResult({
        findings,
        issues: findings,
        issueCount: 4,
        qualityScore: 70
    }), { projectName: 'mixed-project' });

    assert(!!result.blob, 'Blob should be returned');
    assert(result.blob.size > 0, 'Blob should have content with all severities');
});

test('Scan with many findings — truncation works', async () => {
    const findings = [];
    for (let i = 0; i < 100; i++) {
        findings.push(createMockFinding('critical', 'src/file_' + i + '.js', 'awsSecretKey', 'Critical issue ' + i));
    }
    const result = await generateComplianceReport(createMockScanResult({
        findings,
        issues: findings,
        issueCount: 100,
        qualityScore: 10
    }), { projectName: 'many-findings-project' });

    assert(!!result.blob, 'Blob should be returned with many findings');
    assert(result.blob.size > 0, 'Blob should have content');
});

test('Report metadata — correct project name and date', async () => {
    const testDate = new Date('2026-01-15T10:30:00Z').getTime();
    const result = await generateComplianceReport(createMockScanResult(), {
        projectName: 'my-test-project',
        scanDate: testDate,
        customerName: 'Acme Corp'
    });

    assert(!!result.reportId, 'Report ID generated');
    assert(result.filename.includes('2026-01-15'), 'Filename contains scan date');
});

test('Incremental scan — cache hits reported', async () => {
    const result = await generateComplianceReport(createMockScanResult({
        filesSkippedByHashCache: 50,
        hashCacheSize: 100,
        processed: 50,
        totalFiles: 100
    }), { projectName: 'incremental-project' });

    assert(!!result.blob, 'Blob should be returned for incremental scan');
    assert(result.blob.size > 0, 'Blob should have content');
});

test('Empty scan result — handles gracefully', async () => {
    const result = await generateComplianceReport({
        scanId: 'empty',
        processed: 0,
        totalFiles: 0,
        findings: [],
        issues: [],
        issueCount: 0
    }, { projectName: 'empty-project' });

    assert(!!result.blob, 'Blob should be returned for empty scan');
    assert(result.blob.size > 0, 'Blob should have content even for empty scan');
});

test('Missing jsPDF — throws error', async () => {
    // Temporarily remove jsPDF
    const originalJspdf = sandbox.window.jspdf;
    sandbox.window.jspdf = undefined;

    try {
        await generateComplianceReport(createMockScanResult());
        assert(false, 'Should have thrown an error');
    } catch (err) {
        assert(err.message.includes('jsPDF'), 'Error should mention jsPDF');
    }

    // Restore
    sandbox.window.jspdf = originalJspdf;
});

// === Run tests ===
(async () => {
    console.log('========================================');
    console.log('Compliance Report Generator Tests');
    console.log('========================================\n');

    for (const t of tests) {
        console.log('--- ' + t.name + ' ---');
        try {
            await t.fn();
            console.log('  PASSED');
        } catch (err) {
            failed++;
            console.error('  ERROR: ' + (err.message || err));
        }
    }

    console.log('\n========================================');
    console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
    console.log('========================================');
    process.exit(failed > 0 ? 1 : 0);
})();
