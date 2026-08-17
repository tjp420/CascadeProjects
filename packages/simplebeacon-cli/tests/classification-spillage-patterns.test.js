'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
    scanTextPatterns,
    scanClassificationSpillagePatterns
} = require('../src/rules/classification-spillage-patterns');

test('scanTextPatterns flags CUI banner in source', () => {
    const content = 'const label = "CUI//SP-DISC";\n';
    const hits = scanTextPatterns('src/config.ts', content, '.ts');
    assert.ok(hits.some((h) => h.pattern === 'SB-GOV-001'));
    assert.equal(hits[0].severity, 'critical');
});

test('scanTextPatterns flags FOUO marking', () => {
    const content = 'export const header = "FOR OFFICIAL USE ONLY";\n';
    const hits = scanTextPatterns('src/report.js', content, '.js');
    assert.ok(hits.some((h) => h.pattern === 'SB-GOV-002'));
});

test('scanTextPatterns flags NOFORN', () => {
    const content = 'distribution: NOFORN\n';
    const hits = scanTextPatterns('lib/export.yaml', content, '.yaml');
    assert.ok(hits.some((h) => h.pattern === 'SB-GOV-003'));
});

test('scanTextPatterns ignores simplebeacon-ignore line', () => {
    const content = '// simplebeacon-ignore classification-spillage\nconst x = "CUI//SP-DISC";\n';
    const hits = scanTextPatterns('src/ignored.js', content, '.js');
    assert.equal(hits.length, 0);
});

test('scanTextPatterns skips scanner catalog path', () => {
    const content = '"regexSource": "\\\\bCUI(?:\\\\/\\\\\\/|\\\\/)\\\\S+"';
    const hits = scanTextPatterns(
        'packages/simplebeacon-cli/src/rules/classification-spillage-catalog.json',
        content,
        '.json'
    );
    assert.equal(hits.length, 0);
});

test('scanClassificationSpillagePatterns finds marking under production path', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-gov-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'src', 'handler.ts'),
        'const banner = "CUI//SP-DISC";\nexport default banner;\n'
    );
    const result = await scanClassificationSpillagePatterns(root, {
        productionPaths: ['src/']
    });
    assert.ok(result.findings >= 1);
    assert.ok(result.issues.some((i) => i.pattern === 'SB-GOV-001'));
});

test('scanClassificationSpillagePatterns skips docs unless scanDocs enabled', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-gov-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(
        path.join(root, 'src', 'notes.md'),
        '# Notes\nCUI//SP-DISC in markdown\n'
    );
    const withoutDocs = await scanClassificationSpillagePatterns(root, {
        productionPaths: ['src/'],
        scanDocs: false
    });
    assert.equal(withoutDocs.findings, 0);

    const withDocs = await scanClassificationSpillagePatterns(root, {
        productionPaths: ['src/'],
        scanDocs: true
    });
    assert.ok(withDocs.findings >= 1);
});
