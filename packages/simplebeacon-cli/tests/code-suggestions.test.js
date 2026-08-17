const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    buildCodeSuggestions,
    formatCodeSuggestionsMarkdown,
    attachCodeSuggestions,
    writeCodeSuggestionArtifacts
} = require('../src/lib/code-suggestions');
const { reconcileScanReport } = require('../src/lib/normalize-scan-report');

test('buildCodeSuggestions maps gate issues to simple hints', () => {
    const report = {
        generatedAt: '2026-08-17T00:00:00.000Z',
        rawIssues: [{
            severity: 'high',
            type: 'llm-placeholder',
            pattern: 'SB-FICTION-001',
            filePath: 'src/api.js',
            line: 12,
            message: 'Unresolved LLM placeholder'
        }]
    };
    const payload = buildCodeSuggestions(report);
    assert.ok(payload.suggestions.length >= 1);
    assert.match(payload.suggestions[0].suggestion, /placeholder/i);
    assert.ok(payload.suggestions[0].codeHint);
    assert.match(formatCodeSuggestionsMarkdown(payload), /SB-FICTION-001/);
});

test('buildCodeSuggestions merges trim dead-export actions', () => {
    const report = {
        trimSuggestions: {
            topActions: [{
                phase: 'removeDeadExport',
                path: 'lib/util.js',
                symbol: 'deadFn',
                codeChange: true,
                confidence: 'medium',
                reason: 'never imported'
            }]
        }
    };
    const payload = buildCodeSuggestions(report);
    assert.ok(payload.suggestions.some((s) => s.symbol === 'deadFn'));
});

test('reconcileScanReport attaches codeSuggestions', () => {
    const report = reconcileScanReport({
        type: 'simplebeacon-report',
        gate: { pass: true, blockingCount: 0, blockingIssues: [] },
        rawIssues: [{
            severity: 'medium',
            type: 'production-leak',
            pattern: 'sample-json',
            filePath: 'server/load.js',
            message: 'sample json import'
        }]
    });
    assert.ok(report.codeSuggestions);
    assert.ok(report.codeSuggestions.suggestions.length >= 1);
});

test('writeCodeSuggestionArtifacts persists markdown and json', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-code-'));
    const report = attachCodeSuggestions({
        type: 'simplebeacon-report',
        gate: { pass: true, blockingCount: 0, blockingIssues: [] },
        rawIssues: [{
            severity: 'high',
            pattern: 'SB-JS-TB-001',
            filePath: 'src/ai.js',
            line: 4,
            type: 'token-bleed'
        }]
    });
    const out = writeCodeSuggestionArtifacts(root, report);
    assert.ok(fs.existsSync(out.jsonPath));
    assert.ok(fs.existsSync(out.mdPath));
    const md = fs.readFileSync(out.mdPath, 'utf8');
    assert.match(md, /code suggestions/i);
});
