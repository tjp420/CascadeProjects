const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const {
    runInitCommand,
    runHookInstallCommand,
    runGateStatusCommand
} = require('../src/commands');

const BIN = path.join(__dirname, '..', 'bin', 'simplebeacon.js');

function runCli(args, options = {}) {
    const result = spawnSync(process.execPath, [BIN, ...args], {
        encoding: 'utf8',
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env }
    });
    return result;
}

test('--version prints version and exits 0', () => {
    const result = runCli(['--version']);
    assert.equal(result.status, 0);
    assert.ok(result.stdout.trim().startsWith('1.0.'));
});

test('-V prints version and exits 0', () => {
    const result = runCli(['-V']);
    assert.equal(result.status, 0);
    assert.ok(result.stdout.trim().startsWith('1.0.'));
});

test('--help prints usage and exits 0', () => {
    const result = runCli(['--help']);
    assert.equal(result.status, 0);
    assert.ok(result.stdout.includes('Simplebeacon'));
    assert.ok(result.stdout.includes('scan'));
});

test('unknown command exits 2', () => {
    const result = runCli(['not-a-command']);
    assert.equal(result.status, 2);
    assert.ok(result.stderr.includes('Unknown command'));
});

test('--upload with http:// fails with HTTPS validation', () => {
    const result = runCli(['scan', '--upload', 'http://example.com']);
    assert.equal(result.status, 2);
    assert.ok(result.stderr.includes('HTTPS'));
});

test('--upload with invalid URL fails', () => {
    const result = runCli(['scan', '--upload', 'not-a-url']);
    assert.equal(result.status, 2);
    assert.ok(result.stderr.includes('Invalid --upload URL'));
});

test('--upload with https:// passes validation but fails on missing token', () => {
    const result = runCli([
        'scan', '--upload', 'https://simplebeacon.ai/api',
        '--offline', '--path', __dirname
    ]);
    assert.equal(result.status, 2);
    assert.ok(result.stderr.includes('api-token'));
});

test('runInitCommand creates config in empty directory', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-cli-init-'));
    let stdout = '';
    const originalWrite = process.stdout.write;
    process.stdout.write = (chunk) => {
        stdout += chunk;
        return true;
    };

    try {
        runInitCommand({ path: tmp, profile: 'minimal', dryRun: false, force: true, withCi: false });
    } finally {
        process.stdout.write = originalWrite;
    }

    assert.ok(stdout.includes('Created'));
    assert.ok(stdout.includes('config.json'));
    assert.ok(fs.existsSync(path.join(tmp, '.simplebeacon', 'config.json')));

    try {
        fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
});

test('runInitCommand dry-run previews actions without writing', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-cli-dry-'));
    let stdout = '';
    const originalWrite = process.stdout.write;
    process.stdout.write = (chunk) => {
        stdout += chunk;
        return true;
    };

    try {
        runInitCommand({ path: tmp, profile: 'minimal', dryRun: true, force: false, withCi: false });
    } finally {
        process.stdout.write = originalWrite;
    }

    assert.ok(stdout.includes('DRY RUN'));
    assert.ok(!fs.existsSync(path.join(tmp, '.simplebeacon', 'config.json')));

    try {
        fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
});

test('runHookInstallCommand dry-run previews hook install', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-cli-hook-'));
    fs.mkdirSync(path.join(tmp, '.git'), { recursive: true });
    let stdout = '';
    const originalWrite = process.stdout.write;
    process.stdout.write = (chunk) => {
        stdout += chunk;
        return true;
    };

    try {
        runHookInstallCommand({
            path: tmp,
            hookType: 'pre-commit',
            preferHusky: false,
            dryRun: true,
            withJest: false,
            failOn: null
        });
    } finally {
        process.stdout.write = originalWrite;
    }

    assert.ok(stdout.includes('DRY RUN'));
    assert.ok(stdout.includes('pre-commit'));

    try {
        fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
});
