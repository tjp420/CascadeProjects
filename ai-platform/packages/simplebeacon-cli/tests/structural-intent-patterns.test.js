const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { scanStructuralIntentPatterns } = require('../src/rules/structural-intent-patterns');

test('structural intent scan skips when intelligence disabled', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-intent-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'a.js'), 'const x = 1;\n');
    const result = await scanStructuralIntentPatterns(root, {
        intelligence: { enabled: false }
    });
    assert.equal(result.enabled, false);
    fs.rmSync(root, { recursive: true, force: true });
});

test('structural intent scan runs when intelligence enabled', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-intent-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'src', 'stub.js'),
        'function processData(data) { return data; }\n'
    );
    const result = await scanStructuralIntentPatterns(root, {
        sourcePaths: ['src'],
        intelligence: { enabled: true, languages: ['javascript'], treeSitter: { enabled: false } }
    });
    assert.equal(result.enabled, true);
    assert.ok(result.scanned >= 1);
    fs.rmSync(root, { recursive: true, force: true });
});
