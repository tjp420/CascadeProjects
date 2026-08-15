'use strict';

/**
 * Integration tests for the --certify CLI flag.
 *
 * These tests spawn the actual CLI binary with --certify and a mock
 * HTTP server that simulates the edge signing endpoint. They verify:
 *   1. --certify produces a .sbcert file alongside the report
 *   2. --certify is skipped in offline mode (with warning)
 *   3. --certify is skipped for non-JSON output (with warning)
 *   4. --certify failure is non-blocking (scan still succeeds)
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const crypto = require('crypto');

const CLI_BIN = path.resolve(__dirname, '..', 'bin', 'simplebeacon.js');

/**
 * Start a mock HTTP server that simulates the /api/v1/certify endpoint.
 */
function startMockCertifyServer() {
    return new Promise(async (resolve) => {
        // Generate a test keypair
        const keypair = await crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign', 'verify']
        );
        const privateKeyJwk = await crypto.subtle.exportKey('jwk', keypair.privateKey);
        const publicKeyJwk = await crypto.subtle.exportKey('jwk', keypair.publicKey);

        const server = http.createServer(async (req, res) => {
            const url = new URL(req.url, 'http://localhost');

            if (url.pathname === '/api/v1/certify' && req.method === 'POST') {
                let body = '';
                for await (const chunk of req) body += chunk;
                const payload = JSON.parse(body);

                const privateKey = await crypto.subtle.importKey(
                    'jwk',
                    privateKeyJwk,
                    { name: 'ECDSA', namedCurve: 'P-256' },
                    false,
                    ['sign']
                );

                const canonical = JSON.stringify({
                    hash: payload.hash,
                    metadata: payload.metadata,
                    timestamp: payload.timestamp
                });
                const sigBuf = await crypto.subtle.sign(
                    { name: 'ECDSA', hash: { name: 'SHA-256' } },
                    privateKey,
                    new TextEncoder().encode(canonical)
                );
                const sigHex = Array.from(new Uint8Array(sigBuf))
                    .map(b => b.toString(16).padStart(2, '0')).join('');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    signature: sigHex,
                    algorithm: 'ECDSA-P256-SHA256',
                    issuedAt: new Date().toISOString(),
                    echo: { hash: payload.hash, timestamp: payload.timestamp }
                }));
            } else if (url.pathname === '/api/v1/certify/public-key' && req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    keyId: 'simplebeacon-edge-001',
                    algorithm: 'ECDSA-P256-SHA256',
                    publicKey: publicKeyJwk
                }));
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        });

        server.listen(0, () => {
            const port = server.address().port;
            resolve({
                port,
                url: `http://localhost:${port}`,
                publicKeyJwk,
                close: () => new Promise(r => server.close(r))
            });
        });
    });
}

/**
 * Create a minimal test project that the CLI can scan.
 * Uses a clean source file (no credentials) so the scan passes without gate issues.
 */
function createTestProject() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-cli-cert-'));
    const configDir = path.join(root, '.simplebeacon');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.json'), JSON.stringify({
        profile: 'standard',
        scanPaths: ['src'],
        productionPaths: ['src'],
        gate: { failOn: ['high'] }
    }, null, 2));
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
        name: 'cert-test-project',
        version: '1.0.0'
    }));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src', 'app.js'),
        'function add(a, b) { return a + b; }\nmodule.exports = { add };\n'
    );
    return root;
}

/**
 * Run the CLI with given args and return stdout/stderr.
 * Uses async spawn to avoid spawnSync's event loop blocking issues
 * with child process HTTP connections.
 */
async function runCli(args, cwd) {
    const { spawn } = require('child_process');
    return new Promise((resolve) => {
        const child = spawn('node', [CLI_BIN, ...args], {
            cwd: cwd || process.cwd(),
            encoding: 'utf8',
            env: { ...process.env, SIMPLEBEACON_OFFLINE: '', SB_OFFLINE: '' },
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (d) => { stdout += d; });
        child.stderr.on('data', (d) => { stderr += d; });
        child.on('error', () => resolve({ stdout, stderr, exitCode: 1 }));
        child.on('close', (code) => resolve({ stdout, stderr, exitCode: code === null ? 1 : code }));
        // 30s hard timeout
        setTimeout(() => {
            try { child.kill('SIGKILL'); } catch { /* intentional */ }
            resolve({ stdout, stderr, exitCode: 1 });
        }, 30000);
    });
}

// ── Tests ────────────────────────────────────────────────────────────────

test('--certify produces a .sbcert file alongside the JSON report', async () => {
    const mockServer = await startMockCertifyServer();
    const projectRoot = createTestProject();
    const reportPath = path.join(projectRoot, '.simplebeacon', 'report.json');

    try {
        const result = await runCli([
            'scan',
            '--path', projectRoot,
            '--format', 'json',
            '--output', reportPath,
            '--certify',
            '--certify-url', `${mockServer.url}/api/v1/certify`,
            '--no-trust-banner',
            '--quiet'
        ]);

        // Scan should succeed
        assert.equal(result.exitCode, 0, `CLI should exit 0, got ${result.exitCode}. stderr: ${result.stderr}`);

        // Report should exist
        assert.ok(fs.existsSync(reportPath), 'report.json should exist');

        // .sbcert file should exist
        const certPath = reportPath.replace(/\.json$/i, '.sbcert');
        assert.ok(fs.existsSync(certPath), '.sbcert file should exist');

        // Verify the .sbcert file structure
        const certFile = JSON.parse(fs.readFileSync(certPath, 'utf8'));
        assert.equal(certFile.version, 1);
        assert.equal(certFile.algorithm, 'ECDSA-P256-SHA256');
        assert.ok(certFile.signature, 'should have a signature');
        assert.ok(certFile.payload.hash, 'should have a payload hash');
        assert.ok(certFile.verification.url, 'should have a verification URL');

        // stderr should mention the certificate
        assert.match(result.stderr, /certificate/i);
    } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
        await mockServer.close();
    }
});

test('--certify is skipped in offline mode with a warning', async () => {
    const projectRoot = createTestProject();
    const reportPath = path.join(projectRoot, '.simplebeacon', 'report.json');

    try {
        const result = await runCli([
            'scan',
            '--path', projectRoot,
            '--format', 'json',
            '--output', reportPath,
            '--certify',
            '--offline',
            '--no-trust-banner',
            '--quiet'
        ]);

        // Scan should still succeed
        assert.equal(result.exitCode, 0);

        // Report should exist
        assert.ok(fs.existsSync(reportPath));

        // .sbcert file should NOT exist
        const certPath = reportPath.replace(/\.json$/i, '.sbcert');
        assert.ok(!fs.existsSync(certPath), '.sbcert file should NOT exist in offline mode');

        // stderr should mention the skip
        assert.match(result.stderr, /certify.*offline|offline.*certify/i);
    } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    }
});

test('--certify is skipped for non-JSON output with a warning', async () => {
    const projectRoot = createTestProject();
    const reportPath = path.join(projectRoot, '.simplebeacon', 'report.txt');

    try {
        const result = await runCli([
            'scan',
            '--path', projectRoot,
            '--format', 'text',
            '--output', reportPath,
            '--certify',
            '--no-trust-banner',
            '--quiet'
        ]);

        // Scan should succeed
        assert.equal(result.exitCode, 0);

        // .sbcert file should NOT exist
        const certPath = reportPath.replace(/\.txt$/i, '.sbcert');
        assert.ok(!fs.existsSync(certPath), '.sbcert file should NOT exist for text output');

        // stderr should mention the format issue
        assert.match(result.stderr, /json/i);
    } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
    }
});

test('--certify failure is non-blocking (scan still succeeds)', async () => {
    // Start a server that returns 500 for certify requests
    const server = http.createServer((req, res) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Key not configured' }));
    });

    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    const mockUrl = `http://localhost:${port}`;

    const projectRoot = createTestProject();
    const reportPath = path.join(projectRoot, '.simplebeacon', 'report.json');

    try {
        const result = await runCli([
            'scan',
            '--path', projectRoot,
            '--format', 'json',
            '--output', reportPath,
            '--certify',
            '--certify-url', `${mockUrl}/api/v1/certify`,
            '--no-trust-banner',
            '--quiet'
        ]);

        // Scan should still succeed even though certification failed
        assert.equal(result.exitCode, 0, 'scan should succeed even if certify fails');

        // Report should exist
        assert.ok(fs.existsSync(reportPath), 'report should still be written');

        // .sbcert file should NOT exist
        const certPath = reportPath.replace(/\.json$/i, '.sbcert');
        assert.ok(!fs.existsSync(certPath), '.sbcert should not exist when certify fails');

        // stderr should mention the failure
        assert.match(result.stderr, /certif/i);
    } finally {
        fs.rmSync(projectRoot, { recursive: true, force: true });
        await new Promise(resolve => server.close(resolve));
    }
});
