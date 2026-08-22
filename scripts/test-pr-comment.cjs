'use strict';

/**
 * Tests for PR comment formatting with 48 analyzers \+ 25 scan engines branding
 *
 * Verifies:
 * 1. formatGithubComment includes "48 analyzers \+ 25 scan engines" branding
 * 2. formatGithubStepSummary includes "48 analyzers \+ 25 scan engines" branding
 * 3. Gate pass/fail headlines are correct
 * 4. Footer uses aligned messaging
 * 5. Issue rows are formatted correctly
 * 6. Workflow file has PR comment posting step
 *
 * Run: node --test scripts/test-pr-comment.cjs
 */

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');

function readFile(relPath) {
    return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

// Load the module
const {
    formatGithubComment,
    formatGithubStepSummary
} = require(path.join(REPO_ROOT, 'packages/simplebeacon-cli/src/reporters/github-comment'));

// ═══════════════════════════════════════════════
// Test fixtures
// ═══════════════════════════════════════════════

const mockReportPass = {
    projectRoot: '/test/repo',
    totalFiles: 100,
    qualityScore: 95,
    severityCounts: { critical: 0, high: 0, medium: 2, low: 3 },
    rawIssues: [],
    gate: { pass: true, blockingCount: 0, failOn: ['high'] }
};

const mockReportFail = {
    projectRoot: '/test/repo',
    totalFiles: 100,
    qualityScore: 45,
    severityCounts: { critical: 1, high: 2, medium: 3, low: 4 },
    rawIssues: [
        {
            severity: 'critical',
            type: 'credentials',
            pattern: 'SB-SEC-013',
            filePath: 'src/config.js',
            line: 42,
            description: 'Hardcoded API key detected',
            remediation: 'Move to environment variable'
        },
        {
            severity: 'high',
            type: 'fiction-kpi',
            pattern: 'SB-MOCK-001',
            filePath: 'src/metrics.js',
            line: 10,
            description: 'Placeholder KPI value',
            remediation: 'Replace with measured baseline'
        }
    ],
    gate: { pass: false, blockingCount: 3, failOn: ['high'], blockingIssues: [] }
};

// ═══════════════════════════════════════════════
// 1. formatGithubComment — Branding
// ═══════════════════════════════════════════════

describe('formatGithubComment branding', () => {

    test('header includes "48 analyzers \+ 25 scan engines"', () => {
        const comment = formatGithubComment(mockReportPass, mockReportPass.gate);
        assert.match(comment, /48 analyzers \+ 25 scan engines/);
    });

    test('header does not use old "AI Circuit Breaker" branding', () => {
        const comment = formatGithubComment(mockReportPass, mockReportPass.gate);
        assert.doesNotMatch(comment, /AI Circuit Breaker/);
    });

    test('footer includes "traditional linting misses" framing', () => {
        const comment = formatGithubComment(mockReportPass, mockReportPass.gate);
        assert.match(comment, /traditional linting misses/);
    });

    test('footer includes "no upload, no LLM, no false positives"', () => {
        const comment = formatGithubComment(mockReportPass, mockReportPass.gate);
        assert.match(comment, /no upload, no LLM, no false positives/);
    });
});

// ═══════════════════════════════════════════════
// 2. formatGithubComment — Gate Status
// ═══════════════════════════════════════════════

describe('formatGithubComment gate status', () => {

    test('pass report shows PASS headline', () => {
        const comment = formatGithubComment(mockReportPass, mockReportPass.gate);
        assert.match(comment, /gate \*\*passed\*\*/);
        assert.match(comment, /\| Gate \| PASS \|/);
    });

    test('fail report shows FAIL headline', () => {
        const comment = formatGithubComment(mockReportFail, mockReportFail.gate);
        assert.match(comment, /gate \*\*failed\*\*/);
        assert.match(comment, /\| Gate \| FAIL \|/);
    });

    test('quality score is included in metrics table', () => {
        const comment = formatGithubComment(mockReportPass, mockReportPass.gate);
        assert.match(comment, /Quality score.*95/);
    });

    test('severity counts are in metrics table', () => {
        const comment = formatGithubComment(mockReportFail, mockReportFail.gate);
        assert.match(comment, /Critical.*1/);
        assert.match(comment, /High.*2/);
        assert.match(comment, /Medium.*3/);
    });
});

// ═══════════════════════════════════════════════
// 3. formatGithubComment — Issue Formatting
// ═══════════════════════════════════════════════

describe('formatGithubComment issue formatting', () => {

    test('blocking issues are listed for fail report', () => {
        const comment = formatGithubComment(mockReportFail, mockReportFail.gate);
        assert.match(comment, /credentials/i);
        assert.match(comment, /Hardcoded API key/);
    });

    test('pass report shows no blocking findings', () => {
        const comment = formatGithubComment(mockReportPass, mockReportPass.gate);
        assert.match(comment, /No blocking findings/);
    });

    test('issue rows include file path and fix hint', () => {
        const comment = formatGithubComment(mockReportFail, mockReportFail.gate);
        assert.match(comment, /src\/config\.js/);
        assert.match(comment, /Move to environment variable/);
    });
});

// ═══════════════════════════════════════════════
// 4. formatGithubStepSummary — Branding
// ═══════════════════════════════════════════════

describe('formatGithubStepSummary branding', () => {

    test('includes "48 analyzers \+ 25 scan engines" branding', () => {
        const summary = formatGithubStepSummary(mockReportPass, mockReportPass.gate);
        assert.match(summary, /48 analyzers \+ 25 scan engines/);
    });

    test('includes gate status', () => {
        const summary = formatGithubStepSummary(mockReportPass, mockReportPass.gate);
        assert.match(summary, /Gate \*\*PASS\*\*/);
    });

    test('includes severity counts', () => {
        const summary = formatGithubStepSummary(mockReportFail, mockReportFail.gate);
        assert.match(summary, /Critical: 1/);
        assert.match(summary, /High: 2/);
    });

    test('includes quality score', () => {
        const summary = formatGithubStepSummary(mockReportPass, mockReportPass.gate);
        assert.match(summary, /Quality: 95/);
    });
});

// ═══════════════════════════════════════════════
// 5. Workflow File
// ═══════════════════════════════════════════════

describe('simplebeacon.yml workflow', () => {

    test('has PR comment generation step', () => {
        const wf = readFile('.github/workflows/simplebeacon.yml');
        assert.match(wf, /Generate PR comment/i);
    });

    test('has PR comment posting step', () => {
        const wf = readFile('.github/workflows/simplebeacon.yml');
        assert.match(wf, /Post PR comment/i);
    });

    test('uses formatGithubComment from github-comment.js', () => {
        const wf = readFile('.github/workflows/simplebeacon.yml');
        assert.match(wf, /formatGithubComment/);
    });

    test('uses formatGithubStepSummary for step summary', () => {
        const wf = readFile('.github/workflows/simplebeacon.yml');
        assert.match(wf, /formatGithubStepSummary/);
    });

    test('updates existing comment instead of duplicating', () => {
        const wf = readFile('.github/workflows/simplebeacon.yml');
        assert.match(wf, /48 analyzers \+ 25 scan engines/);
        assert.match(wf, /updateComment/);
    });

    test('continues on scan failure for comment posting', () => {
        const wf = readFile('.github/workflows/simplebeacon.yml');
        assert.match(wf, /continue-on-error: true/);
    });
});

// ═══════════════════════════════════════════════
// 6. Syntax Validation
// ═══════════════════════════════════════════════

describe('syntax validation', () => {

    test('github-comment.js passes node syntax check', () => {
        const { execSync } = require('child_process');
        const filePath = path.join(REPO_ROOT, 'packages/simplebeacon-cli/src/reporters/github-comment.js');
        execSync(`node -c "${filePath}"`, { stdio: 'pipe' });
    });
});

// ═══════════════════════════════════════════════
// 7. Cross-Component Messaging Consistency
// ═══════════════════════════════════════════════

describe('cross-component messaging consistency', () => {

    test('PR comment and CLI help both mention "48 analyzers \+ 25 scan engines"', () => {
        const comment = formatGithubComment(mockReportPass, mockReportPass.gate);
        const cli = readFile('packages/simplebeacon-cli/bin/simplebeacon.js');
        assert.match(comment, /48 analyzers \+ 25 scan engines/);
        assert.match(cli, /48 analyzers \+ 25 scan engines/);
    });

    test('PR comment and homepage both use "traditional linting" framing', () => {
        const comment = formatGithubComment(mockReportPass, mockReportPass.gate);
        const homepage = readFile('coming-soon/public/index.html');
        assert.match(comment, /traditional linting/);
        assert.match(homepage, /traditional linting/i);
    });
});
