'use strict';

/**
 * Tests for the CLI certify-client module.
 *
 * These tests verify:
 *   1. Hash computation (file and string)
 *   2. Anonymized metadata extraction (no source code leaks)
 *   3. Payload building (correct structure)
 *   4. .sbcert file writing and reading
 *   5. Full certify + verify roundtrip using a mock server
 *   6. Tamper detection (modified report fails verification)
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const {
    computeFileHash,
    computeStringHash,
    extractAnonymizedMetadata,
    buildCertifyPayload,
    writeSbCertFile,
    certifyReport,
    verifyCertificate
} = require('../src/lib/certify-client');

// ── Test fixtures ────────────────────────────────────────────────────────

function makeMockReport() {
    return {
        summary: {
            critical: 2,
            high: 5,
            medium: 10,
            low: 3,
            totalIssues: 20
        },
        qualityScore: 85,
        totalFiles: 150,
        gate: {
            pass: true,
            blockingIssues: [],
            warningIssues: [{ type: 'low-severity' }]
        },
        engines: {
            credentials: { findings: [{ type: 'aws-key' }], status: 'pass' },
            'llm-slop-patterns': { findings: [], status: 'pass' }
        },
        rawIssues: [
            { type: 'credential', filePath: '/secret/path.js', description: 'should NOT appear in metadata' }
        ]
    };
}

// ── Hash computation tests ───────────────────────────────────────────────

test('computeStringHash produces a 64-char SHA-256 hex string', () => {
    const hash = computeStringHash('hello world');
    assert.equal(hash.length, 64);
    assert.match(hash, /^[a-f0-9]+$/);
});

test('computeStringHash is deterministic', () => {
    const a = computeStringHash('test content');
    const b = computeStringHash('test content');
    assert.equal(a, b);
});

test('computeStringHash differs for different inputs', () => {
    const a = computeStringHash('content a');
    const b = computeStringHash('content b');
    assert.notEqual(a, b);
});

test('computeFileHash matches computeStringHash for the same content', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-cert-'));
    const filePath = path.join(tmpDir, 'test.json');
    const content = '{"test":true}';
    fs.writeFileSync(filePath, content);

    try {
        const fileHash = computeFileHash(filePath);
        const stringHash = computeStringHash(content);
        assert.equal(fileHash, stringHash);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

// ── Metadata extraction tests ────────────────────────────────────────────

test('extractAnonymizedMetadata includes aggregate counts', () => {
    const report = makeMockReport();
    const metadata = extractAnonymizedMetadata(report);

    assert.equal(metadata.criticalCount, 2);
    assert.equal(metadata.highCount, 5);
    assert.equal(metadata.mediumCount, 10);
    assert.equal(metadata.lowCount, 3);
    assert.equal(metadata.totalIssues, 20);
    assert.equal(metadata.qualityScore, 85);
    assert.equal(metadata.totalFiles, 150);
});

test('extractAnonymizedMetadata includes gate status', () => {
    const report = makeMockReport();
    const metadata = extractAnonymizedMetadata(report);

    assert.equal(metadata.gatePassed, true);
    assert.equal(metadata.gateBlockingIssues, 0);
    assert.equal(metadata.gateWarningIssues, 1);
});

test('extractAnonymizedMetadata includes engine summary', () => {
    const report = makeMockReport();
    const metadata = extractAnonymizedMetadata(report);

    assert.equal(metadata.engineCount, 2);
    assert.equal(metadata.engineSummary.credentials.findings, 1);
    assert.equal(metadata.engineSummary['llm-slop-patterns'].findings, 0);
});

test('extractAnonymizedMetadata does NOT include source paths or descriptions', () => {
    const report = makeMockReport();
    const metadata = extractAnonymizedMetadata(report);
    const metadataStr = JSON.stringify(metadata);

    // The rawIssues contain a file path and description — these must NOT appear in metadata
    assert.doesNotMatch(metadataStr, /secret\/path\.js/);
    assert.doesNotMatch(metadataStr, /should NOT appear/);
});

test('extractAnonymizedMetadata handles empty report gracefully', () => {
    const metadata = extractAnonymizedMetadata({});
    assert.deepEqual(metadata, {});
});

// ── Payload building tests ───────────────────────────────────────────────

test('buildCertifyPayload produces correct structure', () => {
    const report = makeMockReport();
    const payload = buildCertifyPayload(report);

    assert.ok(payload.hash, 'should have a hash');
    assert.equal(payload.hash.length, 64);
    assert.equal(typeof payload.timestamp, 'number');
    assert.ok(payload.metadata, 'should have metadata');
});

test('buildCertifyPayload uses provided hash when given', () => {
    const report = makeMockReport();
    const customHash = 'a'.repeat(64);
    const payload = buildCertifyPayload(report, customHash);

    assert.equal(payload.hash, customHash);
});

test('buildCertifyPayload computes hash from report JSON when not provided', () => {
    const report = makeMockReport();
    const expectedHash = computeStringHash(JSON.stringify(report));
    const payload = buildCertifyPayload(report);

    assert.equal(payload.hash, expectedHash);
});

// ── .sbcert file writing tests ───────────────────────────────────────────

test('writeSbCertFile creates a valid JSON certificate file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-cert-'));
    const certPath = path.join(tmpDir, 'test.sbcert');

    const payload = {
        hash: 'b'.repeat(64),
        timestamp: Date.now(),
        metadata: { totalIssues: 5 }
    };

    const certResponse = {
        success: true,
        signature: 'deadbeef',
        algorithm: 'ECDSA-P256-SHA256',
        issuedAt: new Date().toISOString(),
        echo: { hash: payload.hash, timestamp: payload.timestamp }
    };

    try {
        writeSbCertFile(certPath, payload, certResponse, '/path/to/report.json');
        const certFile = JSON.parse(fs.readFileSync(certPath, 'utf8'));

        assert.equal(certFile.version, 1);
        assert.equal(certFile.algorithm, 'ECDSA-P256-SHA256');
        assert.equal(certFile.signature, 'deadbeef');
        assert.equal(certFile.payload.hash, payload.hash);
        assert.equal(certFile.payload.metadata.totalIssues, 5);
        assert.equal(certFile.reportFile, 'report.json');
        assert.ok(certFile.verification.url);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

// ── Full roundtrip test with mock server ─────────────────────────────────

async function startMockServer(privateKeyJwk, publicKeyJwk) {
    const http = require('http');
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

    return new Promise((resolve) => {
        server.listen(0, () => {
            const port = server.address().port;
            resolve({
                port,
                url: `http://localhost:${port}`,
                close: () => new Promise(r => server.close(r))
            });
        });
    });
}

test('full roundtrip: certify report and verify certificate', async () => {
    // Generate test keypair
    const keypair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
    );
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keypair.privateKey);
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keypair.publicKey);

    const mockServer = await startMockServer(privateKeyJwk, publicKeyJwk);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-cert-'));
    const reportPath = path.join(tmpDir, 'scan-report.json');
    const certPath = path.join(tmpDir, 'scan-report.sbcert');

    try {
        // Write a mock report
        const report = makeMockReport();
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Certify the report
        const result = await certifyReport(reportPath, {
            certifyUrl: `${mockServer.url}/api/v1/certify`,
            outputPath: certPath
        });

        assert.ok(fs.existsSync(certPath), '.sbcert file should exist');
        assert.ok(result.signature, 'should have a signature');
        assert.ok(result.hash, 'should have a hash');

        // Verify the certificate
        const verification = await verifyCertificate(certPath, reportPath, `${mockServer.url}/api/v1/certify/public-key`);
        assert.equal(verification.valid, true, 'certificate should verify');
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        await mockServer.close();
    }
});

test('tampered report fails verification', async () => {
    const keypair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        true,
        ['sign', 'verify']
    );
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keypair.privateKey);
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keypair.publicKey);

    const mockServer = await startMockServer(privateKeyJwk, publicKeyJwk);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-cert-'));
    const reportPath = path.join(tmpDir, 'scan-report.json');
    const certPath = path.join(tmpDir, 'scan-report.sbcert');

    try {
        const report = makeMockReport();
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Certify
        await certifyReport(reportPath, {
            certifyUrl: `${mockServer.url}/api/v1/certify`,
            outputPath: certPath
        });

        // Tamper with the report
        const tampered = makeMockReport();
        tampered.summary.critical = 999;
        fs.writeFileSync(reportPath, JSON.stringify(tampered, null, 2));

        // Verify — should fail due to hash mismatch
        const verification = await verifyCertificate(certPath, reportPath, `${mockServer.url}/api/v1/certify/public-key`);
        assert.equal(verification.valid, false);
        assert.match(verification.reason, /hash mismatch/);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        await mockServer.close();
    }
});

test('certifyReport throws on missing report file', async () => {
    await assert.rejects(
        () => certifyReport('/nonexistent/report.json'),
        /Report file not found/
    );
});
