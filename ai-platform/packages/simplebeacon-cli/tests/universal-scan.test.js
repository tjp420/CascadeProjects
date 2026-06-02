const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { runScan } = require('../src/scan');

const BIN = path.join(__dirname, '..', 'bin', 'simplebeacon.js');

function makeTempProject(structure) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-univ-'));
    for (const [relPath, content] of Object.entries(structure)) {
        const fullPath = path.join(root, relPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf8');
    }
    return root;
}

test('CLI --universal enables fullDirectoryScan', () => {
    const root = makeTempProject({
        'package.json': JSON.stringify({ name: 'test' }),
        'src/app.js': 'console.log("hello");\n',
        'deep/nested/very/deep/file.py': '# placeholder\n',
        '.simplebeacon/config.json': JSON.stringify({
            rules: { credentials: { enabled: true } }
        })
    });

    const result = spawnSync(process.execPath, [
        BIN, 'scan', '--path', root, '--universal', '--offline', '--gate',
        '--format', 'json', '--output', path.join(root, 'report.json'),
        '--no-trust-banner'
    ], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' }
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(fs.readFileSync(path.join(root, 'report.json'), 'utf8'));
    assert.equal(report.scanScope.fullDirectoryScan, true);
    assert.ok(report.totalFiles >= 4, 'Expected >= 4 files, got ' + report.totalFiles);

    fs.rmSync(root, { recursive: true, force: true });
});

test('Universal scan walks deeper paths than standard scan', async () => {
    const root = makeTempProject({
        'package.json': JSON.stringify({ name: 'test' }),
        'src/shallow.js': 'console.log("shallow");\n',
        'a/b/c/d/e/f/g/deep.js': 'console.log("deep");\n'
    });

    const standardReport = await runScan(root, {
        offline: true,
        format: 'json',
        config: { rules: { credentials: { enabled: true } } }
    });

    const universalReport = await runScan(root, {
        offline: true,
        format: 'json',
        fullDirectoryScan: true,
        universal: true,
        config: { rules: { credentials: { enabled: true } } }
    });

    assert.ok(
        universalReport.totalFiles >= standardReport.totalFiles,
        'Universal should scan >= standard files: ' + universalReport.totalFiles + ' vs ' + standardReport.totalFiles
    );

    fs.rmSync(root, { recursive: true, force: true });
});

test('Universal scan expands extension coverage', async () => {
    const root = makeTempProject({
        'package.json': JSON.stringify({ name: 'test' }),
        'src/app.js': 'console.log("ok");\n',
        'config/app.yaml': 'api_key: test_value\n',
        'scripts/deploy.sh': '#!/bin/bash\necho "hello"\n'
    });

    const report = await runScan(root, {
        offline: true,
        format: 'json',
        fullDirectoryScan: true,
        universal: true,
        config: { rules: { credentials: { enabled: true } } }
    });

    assert.ok(report.totalFiles >= 3, 'Expected >= 3 files, got ' + report.totalFiles);

    fs.rmSync(root, { recursive: true, force: true });
});
