const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { scanFileNamingPatterns, analyzeFileName, suggestBetterName } = require('../src/rules/file-naming-patterns');

test('analyzeFileName detects copy debris', () => {
    const issues = analyzeFileName('src/app (2).js');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].id, 'SB-FNAME-001');
    assert.equal(issues[0].suggestion, 'app.js');
});

test('analyzeFileName detects placeholder names', () => {
    const issues = analyzeFileName('lib/temp.js');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].id, 'SB-FNAME-002');
    assert.equal(issues[0].suggestion, 'temporary.js');
});

test('analyzeFileName allows test-prefixed compound names', () => {
    assert.deepEqual(analyzeFileName('server/test-gateway.js'), []);
    assert.deepEqual(analyzeFileName('lib/test-helper.ts'), []);
});

test('analyzeFileName detects Untitled placeholder', () => {
    const issues = analyzeFileName('components/Untitled 1.vue');
    assert.equal(issues.length, 1);
    assert.equal(issues[0].id, 'SB-FNAME-002');
    assert.equal(issues[0].suggestion, 'module.vue');
});

test('analyzeFileName detects LLM naming slop', () => {
    const issues = analyzeFileName('src/optimized_final_actual.js');
    assert.ok(issues.some((i) => i.id === 'SB-FNAME-003'));
    assert.ok(issues.some((i) => i.suggestion === 'optimized.js'));
});

test('analyzeFileName detects version chain', () => {
    const issues = analyzeFileName('utils/utils_v1_final.js');
    assert.ok(issues.some((i) => i.id === 'SB-FNAME-004'));
    assert.ok(issues.some((i) => i.suggestion === 'utils.js'));
});

test('analyzeFileName returns empty for clean names', () => {
    assert.deepEqual(analyzeFileName('src/user-service.js'), []);
    assert.deepEqual(analyzeFileName('lib/auth-middleware.ts'), []);
    assert.deepEqual(analyzeFileName('components/DashboardPanel.vue'), []);
});

test('analyzeFileName allows package.json and README.md', () => {
    assert.deepEqual(analyzeFileName('package.json'), []);
    assert.deepEqual(analyzeFileName('README.md'), []);
});

test('suggestBetterName strips redundant suffixes', () => {
    assert.equal(suggestBetterName('app_final_actual.js'), 'app.js');
    assert.equal(suggestBetterName('utils_v1_v2.js'), 'utils.js');
});

test('scanFileNamingPatterns scans directory and finds issues', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-fname-'));
    const src = path.join(tmp, 'src');
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src, 'app (2).js'), 'const x = 1;');
    fs.writeFileSync(path.join(src, 'temp.js'), 'const y = 2;');
    fs.writeFileSync(path.join(src, 'clean-name.js'), 'const z = 3;');

    const result = await scanFileNamingPatterns(tmp, { sourcePaths: ['src'] });

    assert.equal(result.scanned, 3);
    assert.equal(result.findings, 2);
    assert.ok(result.issues.some((i) => i.id === 'SB-FNAME-001'));
    assert.ok(result.issues.some((i) => i.id === 'SB-FNAME-002'));
    assert.ok(!result.issues.some((i) => i.file.includes('clean-name')));

    try {
        fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
});

test('scanFileNamingPatterns respects ignoreGlobs', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-fname-ig-'));
    const src = path.join(tmp, 'src');
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src, 'temp.js'), 'const x = 1;');

    const result = await scanFileNamingPatterns(tmp, {
        sourcePaths: ['src'],
        ignoreGlobs: ['src/temp.js']
    });

    assert.equal(result.scanned, 0);
    assert.equal(result.findings, 0);

    try {
        fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
});
