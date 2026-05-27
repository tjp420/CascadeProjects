const express = require('express');
const {
    setupTrustAPI
} = require('../../src/api/trust-api');

describe('trust-api routes', () => {
    async function withTrustServer(run) {
        const app = express();
        setupTrustAPI(app, {
            platformRoot: process.cwd(),
            monorepoRoot: process.cwd()
        });

        const server = await new Promise((resolve) => {
            const s = app.listen(0, () => resolve(s));
        });

        const { port } = server.address();
        const baseUrl = `http://127.0.0.1:${port}`;
        try {
            await run(baseUrl);
        } finally {
            await new Promise((resolve, reject) => {
                server.close((err) => (err ? reject(err) : resolve()));
            });
        }
    }

    test('verification endpoint returns full payload envelope', async () => {
        await withTrustServer(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/trust/verification`);
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toContain('application/json');
            const payload = await response.json();
            expect(payload.success).toBe(true);
            expect(payload.type).toBe('simplebeacon-trust-verification');
            expect(payload.verificationId).toBeTruthy();
            expect(payload.headline).toBeTruthy();
        });
    });

    test('verify endpoint returns compact json for format=json', async () => {
        await withTrustServer(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/trust/verify?format=json`);
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toContain('application/json');
            const payload = await response.json();
            expect(payload.verified).toBe(true);
            expect(payload.verificationId).toBeTruthy();
            expect(Object.prototype.hasOwnProperty.call(payload, 'gatePass')).toBe(true);
            expect(Object.prototype.hasOwnProperty.call(payload, 'issues')).toBe(true);
        });
    });

    test('verification and verify json stay coherent', async () => {
        await withTrustServer(async (baseUrl) => {
            const full = await fetch(`${baseUrl}/api/trust/verification`).then((r) => r.json());
            const compact = await fetch(`${baseUrl}/api/trust/verify?format=json`).then((r) => r.json());
            expect(compact.verified).toBe(true);
            expect(compact.verificationId).toBe(full.verificationId);
            expect(compact.headlineSource).toBe(full.headlineSource);
            expect(compact.issues).toBe(full.headline?.issueCount);
        });
    });

    test('verify endpoint defaults to compact json when format omitted', async () => {
        await withTrustServer(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/trust/verify`);
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toContain('application/json');
            const payload = await response.json();
            expect(payload.verified).toBe(true);
            expect(payload.verificationId).toBeTruthy();
            expect(Object.prototype.hasOwnProperty.call(payload, 'qualityScore')).toBe(true);
            expect(Object.prototype.hasOwnProperty.call(payload, 'headlineSource')).toBe(true);
        });
    });

    test('badge svg route always returns svg content', async () => {
        await withTrustServer(async (baseUrl) => {
            const response = await fetch(`${baseUrl}/api/trust/badge.svg?raw=1`);
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toContain('image/svg+xml');
            const body = await response.text();
            expect(body.length).toBeGreaterThan(40);
            expect(body).toContain('<svg');
            expect(body).toContain('Gate');
        });
    });
});
