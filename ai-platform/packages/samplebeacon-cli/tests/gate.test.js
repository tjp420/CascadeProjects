const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CLI_ROOT = path.join(__dirname, '..');
const AI_PLATFORM = path.join(CLI_ROOT, '../..');
const BIN = path.join(CLI_ROOT, 'bin/samplebeacon.js');

function runSamplebeacon(args, cwd) {
    return spawnSync(process.execPath, [BIN, ...args], {
        cwd,
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' }
    });
}

test('ai-platform samplebeacon --gate exits 0 with cascade config', () => {
    const configPath = path.join(AI_PLATFORM, '.samplebeacon/config.json');
    if (!fs.existsSync(configPath)) {
        return;
    }

    const result = runSamplebeacon(['scan', '--gate', '--path', AI_PLATFORM, '--format', 'text'], AI_PLATFORM);
    assert.equal(
        result.status,
        0,
        `gate failed:\n${result.stdout}\n${result.stderr}`
    );
    assert.match(result.stdout, /Gate: PASS/i);
});

test('ai-platform gate report has zero high-severity issues', () => {
    const configPath = path.join(AI_PLATFORM, '.samplebeacon/config.json');
    if (!fs.existsSync(configPath)) {
        return;
    }

    const outFile = path.join(AI_PLATFORM, '.samplebeacon/gate-test-report.json');
    const result = runSamplebeacon([
        'scan',
        '--path', AI_PLATFORM,
        '--format', 'json',
        '--output', outFile
    ], AI_PLATFORM);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    assert.equal(report.severityCounts?.high ?? 0, 0);
    assert.equal(
        (report.rawIssues || []).filter((i) => i.type === 'Fictional KPI').length,
        0
    );
});
