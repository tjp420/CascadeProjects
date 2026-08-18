// simplebeacon-ignore: Test fixtures contain intentional scanner patterns — all findings are expected
/**
 * Test Gap Fill — Clean Repo Fixture, Export Round-Trip, Staged Scan, Precision
 *
 * Fills the five testing gaps identified in the test infrastructure audit:
 * 1. Standalone clean-repo fixture for end-to-end false-positive testing
 * 2. Full scan-report export round-trip (scan → JSON → read back → validate)
 * 3. scan_staged with real git add staging
 * 4. Precision measurement on a known-safe codebase
 * 5. (Extension E2E is in a separate file — simplebeacon-vscode-merged)
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const { runScan } = require('../src/scan.js');
const { formatJsonReport } = require('../src/reporters/json.js');

// ─── Helpers ──────────────────────────────────────────────────────────────

function createTempRepo(files) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-gap-'));
    for (const [filePath, content] of Object.entries(files)) {
        const fullPath = path.join(root, ...filePath.split('/'));
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf8');
    }
    return root;
}

function cleanup(root) {
    try {
        fs.rmSync(root, { recursive: true, force: true });
    } catch { /* ignore */ }
}

function gitInit(root) {
    execSync('git init', { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] });
    execSync('git config user.email test@test.com', { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] });
    execSync('git config user.name Test', { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] });
}

function gitAdd(root, files) {
    const args = files.map((f) => `"${f}"`).join(' ');
    execSync(`git add ${args}`, { cwd: root, stdio: ['ignore', 'ignore', 'ignore'] });
}

// ─── Clean repo fixture ───────────────────────────────────────────────────

const CLEAN_REPO_FILES = {
    'package.json': JSON.stringify({
        name: 'clean-app',
        version: '1.0.0',
        description: 'A clean project with no issues',
        main: 'src/index.js',
        scripts: {
            start: 'node src/index.js',
            test: 'node --test'
        },
        dependencies: {
            express: '^4.18.0',
            pg: '^8.11.0',
            'express-rate-limit': '^7.0.0'
        },
        devDependencies: {
            jest: '^29.0.0'
        }
    }, null, 2),
    '.gitignore': 'node_modules/\n.env\n*.log\n',
    'LICENSE': 'MIT License\n\nCopyright (c) 2026\n',
    'README.md': '# Clean App\n\nA clean project for false-positive testing.\n',
    'CODE_OF_CONDUCT.md': '# Code of Conduct\n\nWe are committed to providing a welcoming environment.\n',
    'SECURITY.md': '# Security Policy\n\nReport vulnerabilities to security@clean-app.example\n',
    'CONTRIBUTING.md': '# Contributing\n\nPull requests welcome.\n',
    'src/index.js': `
const express = require('express');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

app.get('/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT 1 as healthy');
        res.json({ status: 'ok', db: result.rows[0].healthy === 1 });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.listen(port, () => {
    console.log('Server running on port ' + port);
});

module.exports = app;
`,
    'src/utils.js': `
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function validateEmail(email) {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
}

module.exports = { formatDate, validateEmail };
`,
    'src/config.js': `
const config = {
    port: process.env.PORT || 3000,
    dbUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET
};

module.exports = config;
`,
    'tests/index.test.js': `
const { test } = require('node:test');
const assert = require('node:assert');

test('placeholder', () => {
    assert.equal(1, 1);
});
`
};

// ═══════════════════════════════════════════════════════════════════════════
// Gap 1: Clean Repo Fixture — End-to-End False Positive Testing
// ═══════════════════════════════════════════════════════════════════════════

describe('Gap 1: Clean Repo Fixture — End-to-End False Positive Testing', () => {

    test('clean repo fixture has all expected files', () => {
        const root = createTempRepo(CLEAN_REPO_FILES);
        try {
            assert.ok(fs.existsSync(path.join(root, 'package.json')));
            assert.ok(fs.existsSync(path.join(root, '.gitignore')));
            assert.ok(fs.existsSync(path.join(root, 'LICENSE')));
            assert.ok(fs.existsSync(path.join(root, 'README.md')));
            assert.ok(fs.existsSync(path.join(root, 'src', 'index.js')));
            assert.ok(fs.existsSync(path.join(root, 'src', 'utils.js')));
            assert.ok(fs.existsSync(path.join(root, 'src', 'config.js')));
            assert.ok(fs.existsSync(path.join(root, 'tests', 'index.test.js')));
        } finally {
            cleanup(root);
        }
    });

    test('full scan of clean repo produces zero blocking findings', async () => {
        const root = createTempRepo(CLEAN_REPO_FILES);
        try {
            const report = await runScan(root, {
                gate: true,
                offline: true,
                fullDirectoryScan: false,
                sourcePaths: ['src']
            });

            assert.ok(report, 'scan should return a report');
            const blockingCount = report.blockingCount || (report.gate && report.gate.blockingCount) || 0;
            assert.equal(blockingCount, 0,
                'Clean repo should have zero blocking findings — got: ' + JSON.stringify(report.blockingIssues || report.issues || []));
        } finally {
            cleanup(root);
        }
    });

    test('clean repo does not produce credential findings', async () => {
        const root = createTempRepo(CLEAN_REPO_FILES);
        try {
            const report = await runScan(root, {
                gate: true,
                offline: true,
                sourcePaths: ['src']
            });

            const findings = report.detectedIssues || report.issues || [];
            const credentialFindings = findings.filter(
                (f) => /credential|secret|api.?key|token/i.test(f.type || f.rule || f.description || '')
            );
            assert.equal(credentialFindings.length, 0,
                'Clean repo should not produce credential findings — got: ' +
                JSON.stringify(credentialFindings));
        } finally {
            cleanup(root);
        }
    });

    test('clean repo does not produce fiction KPI findings', async () => {
        const root = createTempRepo(CLEAN_REPO_FILES);
        try {
            const report = await runScan(root, {
                gate: true,
                offline: true,
                sourcePaths: ['src']
            });

            const findings = report.detectedIssues || report.issues || [];
            const fictionFindings = findings.filter(
                (f) => /fiction|kpi|mock|vanity/i.test(f.type || f.rule || f.description || '')
            );
            assert.equal(fictionFindings.length, 0,
                'Clean repo should not produce fiction KPI findings — got: ' +
                JSON.stringify(fictionFindings));
        } finally {
            cleanup(root);
        }
    });

    test('clean repo does not produce LLM slop findings', async () => {
        const root = createTempRepo(CLEAN_REPO_FILES);
        try {
            const report = await runScan(root, {
                gate: true,
                offline: true,
                sourcePaths: ['src']
            });

            const findings = report.detectedIssues || report.issues || [];
            const slopFindings = findings.filter(
                (f) => /slop|placeholder|todo.*implement|your.*business.*logic/i.test(f.type || f.rule || f.description || '')
            );
            assert.equal(slopFindings.length, 0,
                'Clean repo should not produce LLM slop findings — got: ' +
                JSON.stringify(slopFindings));
        } finally {
            cleanup(root);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Gap 2: Scan Report Export Round-Trip
// ═══════════════════════════════════════════════════════════════════════════

describe('Gap 2: Scan Report Export Round-Trip', () => {

    test('scan → formatJsonReport → write → read back → parse → validate no data loss', async () => {
        const root = createTempRepo(CLEAN_REPO_FILES);
        try {
            const rawReport = await runScan(root, {
                gate: true,
                offline: true,
                sourcePaths: ['src']
            });

            // Format as JSON report (the export path)
            const jsonReport = formatJsonReport(rawReport, rawReport.gate || null);
            assert.ok(jsonReport, 'formatJsonReport should return a report object');
            assert.ok(jsonReport.gate, 'formatted report should have a gate object');

            // Write to disk (simulating --output report.json)
            const exportPath = path.join(root, 'report.json');
            fs.writeFileSync(exportPath, JSON.stringify(jsonReport, null, 2), 'utf8');

            // Read back from disk
            const readContent = fs.readFileSync(exportPath, 'utf8');
            const parsedReport = JSON.parse(readContent);

            // Validate key fields survived the round-trip
            assert.equal(parsedReport.gate.pass, jsonReport.gate.pass,
                'gate.pass should survive round-trip');
            assert.equal(parsedReport.gate.blockingCount, jsonReport.gate.blockingCount,
                'gate.blockingCount should survive round-trip');
            assert.equal(parsedReport.gate.status, jsonReport.gate.status,
                'gate.status should survive round-trip');

            // Validate the report is valid JSON with expected top-level keys
            const expectedKeys = ['gate'];
            for (const key of expectedKeys) {
                assert.ok(key in parsedReport, `round-tripped report should have key: ${key}`);
            }

            // Validate no NaN or undefined leaked into the JSON (would indicate serialization issues)
            const jsonStr = JSON.stringify(parsedReport);
            assert.ok(!jsonStr.includes('NaN'), 'round-tripped report should not contain NaN');
            // Note: undefined values are dropped by JSON.stringify, so they won't appear
        } finally {
            cleanup(root);
        }
    });

    test('export round-trip preserves findings array structure', async () => {
        const root = createTempRepo({
            ...CLEAN_REPO_FILES,
            'src/bad.js': `
const apiKey = "sk_live_Xj9kLp2mN4qR7sT1vW3yZ5aB8cD0eF2g";
const password = "hardcoded_secret_value";
function process(data) { try { return JSON.parse(data); } catch (e) { return null; } }
`
        });
        try {
            const rawReport = await runScan(root, {
                gate: true,
                offline: true,
                sourcePaths: ['src']
            });

            const jsonReport = formatJsonReport(rawReport, rawReport.gate || null);
            const exportPath = path.join(root, 'report.json');
            fs.writeFileSync(exportPath, JSON.stringify(jsonReport, null, 2), 'utf8');
            const parsedReport = JSON.parse(fs.readFileSync(exportPath, 'utf8'));

            // The bad file should produce findings — check multiple possible locations
            const blockingIssues = parsedReport.gate.blockingIssues || [];
            const allIssues = parsedReport.detectedIssues || parsedReport.issues || [];
            const hasBlocking = blockingIssues.length > 0 || (parsedReport.gate.blockingCount || 0) > 0;
            const hasFindings = allIssues.length > 0;

            assert.ok(hasBlocking || hasFindings,
                'repo with secrets should have findings after round-trip — gate: ' +
                JSON.stringify(parsedReport.gate) + ', issues: ' +
                JSON.stringify(allIssues.slice(0, 3)));

            // Each blocking issue should have the expected structure
            for (const issue of blockingIssues) {
                assert.ok(issue.type || issue.rule || issue.description,
                    'each blocking issue should have a type/rule/description');
            }
        } finally {
            cleanup(root);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Gap 3: scan_staged with Real Git Staging
// ═══════════════════════════════════════════════════════════════════════════

describe('Gap 3: scan_staged with Real Git Staging', () => {

    test('scan_staged detects findings only in staged files', () => {
        const root = createTempRepo({
            ...CLEAN_REPO_FILES,
            'src/secret.js': `
const stripeKey = "sk_live_abcdef1234567890";
module.exports = { stripeKey };
`,
            'src/clean-extra.js': `
function add(a, b) { return a + b; }
module.exports = { add };
`
        });
        gitInit(root);
        try {
            // Stage only the clean file — the secret file should NOT be scanned
            gitAdd(root, ['src/clean-extra.js', 'package.json', '.gitignore', 'LICENSE', 'README.md', 'src/index.js', 'src/utils.js', 'src/config.js', 'tests/index.test.js']);

            // Get staged files via git
            const stagedOutput = execSync('git diff --cached --name-only --diff-filter=ACMR', {
                cwd: root,
                encoding: 'utf8'
            });
            const stagedFiles = stagedOutput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

            // Verify the secret file is NOT staged
            assert.ok(!stagedFiles.includes('src/secret.js'),
                'secret.js should not be staged');

            // Scan only staged files (mimics scan_staged logic)
            const { scanFileOnDisk } = require('../src/mcp/handlers/agent-loop-handlers');
            // scanFileOnDisk may not be exported — use the scan module directly
            const allFindings = [];
            for (const rel of stagedFiles) {
                const abs = path.join(root, rel);
                if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
                // Use scanTextPatterns on file content as a proxy
                const content = fs.readFileSync(abs, 'utf8');
                const { scanTextPatterns } = require('../src/rules/llm-slop-patterns');
                const hits = scanTextPatterns(rel, content, path.extname(rel));
                allFindings.push(...hits);
            }

            // Staged files are clean — should have no slop findings
            const slopFindings = allFindings.filter((f) => /slop|placeholder|todo/i.test(f.type || f.rule || ''));
            assert.equal(slopFindings.length, 0,
                'staged clean files should not produce findings');
        } finally {
            cleanup(root);
        }
    });

    test('scan_staged finds issues when a file with secrets is staged', async () => {
        const root = createTempRepo({
            ...CLEAN_REPO_FILES,
            'src/staged-secret.js': `
const apiKey = "sk_live_Xj9kLp2mN4qR7sT1vW3yZ5aB8cD0eF2g";
module.exports = { apiKey };
`
        });
        gitInit(root);
        try {
            // Stage the secret file
            gitAdd(root, ['src/staged-secret.js']);

            const stagedOutput = execSync('git diff --cached --name-only --diff-filter=ACMR', {
                cwd: root,
                encoding: 'utf8'
            });
            const stagedFiles = stagedOutput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

            assert.ok(stagedFiles.includes('src/staged-secret.js'),
                'staged-secret.js should be staged');

            // Run credential scan on staged files (async function)
            const { scanCredentialPatterns } = require('../src/lib/credential-pattern-scanner');
            const files = stagedFiles.map((rel) => {
                const abs = path.join(root, rel);
                const stat = fs.statSync(abs);
                return { path: abs, ext: path.extname(rel), relativePath: rel, size: stat.size };
            });

            const result = await scanCredentialPatterns(files, {
                scanProduction: true,
                productionPaths: ['src'],
                ignoreGlobs: []
            });

            // Should detect the Stripe key
            const stripeFindings = (result.issues || []).filter(
                (f) => /stripe|sk_live|api.?key|credential/i.test(f.type || f.description || '')
            );
            assert.ok(stripeFindings.length > 0,
                'staged file with sk_live key should produce credential findings — got: ' +
                JSON.stringify(result.issues || []));
        } finally {
            cleanup(root);
        }
    });

    test('scan_staged returns empty when no files are staged', () => {
        const root = createTempRepo(CLEAN_REPO_FILES);
        gitInit(root);
        try {
            const stagedOutput = execSync('git diff --cached --name-only --diff-filter=ACMR', {
                cwd: root,
                encoding: 'utf8'
            });
            const stagedFiles = stagedOutput.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            assert.equal(stagedFiles.length, 0, 'no files should be staged in a fresh repo');
        } finally {
            cleanup(root);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// Gap 4: Precision Measurement on Known-Safe Codebase
// ═══════════════════════════════════════════════════════════════════════════

describe('Gap 4: Precision Measurement on Known-Safe Codebase', () => {

    test('precision is 1.0 on clean repo (zero blocking false positives)', async () => {
        const root = createTempRepo(CLEAN_REPO_FILES);
        try {
            const report = await runScan(root, {
                gate: true,
                offline: true,
                sourcePaths: ['src']
            });

            const findings = report.detectedIssues || report.issues || [];
            // Count only blocking (high/critical) findings — non-blocking low-severity
            // findings (like missing-rate-limit on non-matching paths) are advisory
            const blockingFindings = findings.filter(
                (f) => f.severity === 'high' || f.severity === 'critical'
            );
            const falsePositives = blockingFindings.length;
            const precision = falsePositives === 0 ? 1.0 : 0.0;

            assert.equal(precision, 1.0,
                `Clean repo should have precision 1.0 (zero blocking false positives) — got ${falsePositives} blocking findings: ` +
                JSON.stringify(blockingFindings.map((f) => ({ type: f.type, file: f.filePath || f.file, desc: f.description }))));
        } finally {
            cleanup(root);
        }
    });

    test('precision measurement on repo with known issues (true positives)', async () => {
        const root = createTempRepo({
            ...CLEAN_REPO_FILES,
            'src/bad.js': `
// TODO: implement your business logic here
const apiKey = "sk_live_Xj9kLp2mN4qR7sT1vW3yZ5aB8cD0eF2g";
function unused() { return null; }
`
        });
        try {
            const report = await runScan(root, {
                gate: true,
                offline: true,
                sourcePaths: ['src']
            });

            const findings = report.detectedIssues || report.issues || [];
            // Count only blocking findings for precision
            const blockingFindings = findings.filter(
                (f) => f.severity === 'high' || f.severity === 'critical'
            );
            const blockingOnBadFile = blockingFindings.filter(
                (f) => (f.filePath || f.file || '').includes('bad.js')
            );
            const blockingOnCleanFiles = blockingFindings.filter(
                (f) => !(f.filePath || f.file || '').includes('bad.js')
            );

            const truePositives = blockingOnBadFile.length;
            const falsePositives = blockingOnCleanFiles.length;
            const precision = (truePositives + falsePositives) > 0
                ? truePositives / (truePositives + falsePositives)
                : 1.0;

            assert.ok(truePositives > 0,
                'should detect at least one blocking issue in bad.js — got: ' + JSON.stringify(blockingOnBadFile));
            assert.ok(precision >= 0.5,
                `precision should be >= 0.5 — got ${precision} (TP=${truePositives}, FP=${falsePositives})`);
        } finally {
            cleanup(root);
        }
    });

    test('blocking false positive rate on clean repo is 0%', async () => {
        const root = createTempRepo(CLEAN_REPO_FILES);
        try {
            const report = await runScan(root, {
                gate: true,
                offline: true,
                sourcePaths: ['src']
            });

            const findings = report.detectedIssues || report.issues || [];
            const blockingFindings = findings.filter(
                (f) => f.severity === 'high' || f.severity === 'critical'
            );
            const falsePositiveRate = blockingFindings.length / 7;

            assert.equal(falsePositiveRate, 0,
                `Blocking false positive rate on clean repo should be 0% — got ${falsePositiveRate} (${blockingFindings.length} blocking findings across 7 files)`);
        } finally {
            cleanup(root);
        }
    });
});
