const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    buildTrustVerificationPayload,
    buildTrustBadgeSvg,
    buildTrustVerifyHtml,
    buildTrustVerifyCompact
} = require('../../server/lib/trust-verification-payload');
const {
    appendTrustSnapshot,
    readTrustHistory,
    buildTrustTrend
} = require('../../server/lib/trust-history-store');
const { setupTrustAPI } = require('../../src/api/trust-api');
const express = require('express');
const {
    buildValidationSummary
} = require('../../tools/validate-trust-publish-env');

describe('trust-verification-payload', () => {
    let tmpRoot;

    beforeEach(() => {
        tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'trust-'));
    });

    afterEach(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    function writeReport(root, report) {
        const dir = path.join(root, '.simplebeacon');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report), 'utf8');
    }

    test('methodology documents fiction JSON scope from report metrics', () => {
        writeReport(tmpRoot, {
            type: 'simplebeacon-report',
            generatedAt: '2026-05-27T23:10:28.816Z',
            projectRoot: tmpRoot,
            platformRoot: tmpRoot,
            qualityScore: 100,
            issueCount: 0,
            fictionJsonFilesScanned: 67,
            fictionSampleFilesScanned: 40,
            fictionScope: 'repository-json',
            mockSampleFiles: 40,
            gate: { pass: true }
        });

        const payload = buildTrustVerificationPayload({ platformRoot: tmpRoot, monorepoRoot: tmpRoot });
        expect(payload.fictionScope.fictionJsonFilesScanned).toBe(67);
        expect(payload.fictionScope.fictionSampleFilesScanned).toBe(40);
        expect(payload.fictionScope.mode).toBe('repository-json');
        expect(payload.methodology.some((line) => /67 JSON pattern-checked/.test(line))).toBe(true);
        expect(payload.methodology.some((line) => /config\.ignore/.test(line))).toBe(true);
    });

    test('builds platform snapshot with scoped metrics', () => {
        writeReport(tmpRoot, {
            type: 'simplebeacon-report',
            generatedAt: '2026-05-24T23:22:47.559Z',
            projectRoot: tmpRoot,
            qualityScore: 99,
            issueCount: 0,
            schemaCompliance: 100,
            schemaChecked: 44,
            schemaPassed: 44,
            consistencyScore: 100,
            filesAnalyzed: 119,
            gate: { pass: true }
        });

        const payload = buildTrustVerificationPayload({ platformRoot: tmpRoot, monorepoRoot: tmpRoot });
        expect(payload.platform.qualityScore).toBe(99);
        expect(payload.platform.gatePass).toBe(true);
        expect(payload.verificationId).toHaveLength(16);
    });

    test('prefers monorepo headline when monorepo has issues', () => {
        const platformRoot = path.join(tmpRoot, 'ai-platform');
        const monorepoRoot = tmpRoot;
        fs.mkdirSync(platformRoot, { recursive: true });

        writeReport(platformRoot, {
            type: 'simplebeacon-report',
            generatedAt: '2026-05-24T23:22:47.559Z',
            projectRoot: platformRoot,
            qualityScore: 99,
            issueCount: 0,
            gate: { pass: true }
        });
        writeReport(monorepoRoot, {
            type: 'simplebeacon-report',
            generatedAt: '2026-05-25T10:00:00.000Z',
            projectRoot: monorepoRoot,
            reportVersion: 2,
            qualityScore: 58,
            issueCount: 149,
            gate: { pass: false }
        });

        const payload = buildTrustVerificationPayload({ platformRoot, monorepoRoot });
        expect(payload.monorepo.issueCount).toBe(149);
        expect(payload.headline.issueCount).toBe(149);
        expect(payload.headlineSource).toBe('monorepo');
        expect(payload.headlineReason).toMatch(/higher issue count/i);
        expect(payload.disclaimers[0]).toMatch(/differs from monorepo/);
    });

    test('prefers newest snapshot when issue counts are tied', () => {
        const platformRoot = path.join(tmpRoot, 'ai-platform');
        const monorepoRoot = tmpRoot;
        fs.mkdirSync(platformRoot, { recursive: true });

        writeReport(platformRoot, {
            type: 'simplebeacon-report',
            generatedAt: '2026-05-25T08:31:43.000Z',
            projectRoot: platformRoot,
            qualityScore: 55,
            issueCount: 140,
            gate: { pass: false }
        });
        writeReport(monorepoRoot, {
            type: 'simplebeacon-report',
            generatedAt: '2026-05-25T08:16:59.000Z',
            projectRoot: monorepoRoot,
            reportVersion: 2,
            qualityScore: 55,
            issueCount: 140,
            gate: { pass: false }
        });

        const payload = buildTrustVerificationPayload({ platformRoot, monorepoRoot });
        expect(payload.headlineSource).toBe('platform');
        expect(payload.headlineReason).toMatch(/newer|equally recent/i);
        expect(payload.headline.issueCount).toBe(140);
    });

    test('buildTrustBadgeSvg returns svg', () => {
        const svg = buildTrustBadgeSvg({
            headline: { qualityScore: 99, gatePass: true, issueCount: 0 }
        });
        expect(svg).toContain('<svg');
        expect(svg).toContain('Gate PASS');
    });

    test('buildTrustVerifyHtml renders readable page', () => {
        writeReport(tmpRoot, {
            type: 'simplebeacon-report',
            generatedAt: '2026-05-24T23:22:47.559Z',
            projectRoot: tmpRoot,
            qualityScore: 58,
            issueCount: 149,
            gate: { pass: false }
        });
        const payload = buildTrustVerificationPayload({ platformRoot: tmpRoot, monorepoRoot: tmpRoot });
        const html = buildTrustVerifyHtml(payload);
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('GATE REVIEW');
        expect(buildTrustVerifyCompact(payload).issues).toBe(149);
    });

    test('trust history store appends and computes trend', () => {
        const historyPath = path.join(tmpRoot, '.simplebeacon', 'trust-history.json');
        appendTrustSnapshot({
            historyPath,
            source: 'test',
            payload: {
                generatedAt: '2026-05-25T12:00:00.000Z',
                verificationId: 'abc123',
                verificationMethod: 'simplebeacon-deterministic-gate',
                headlineSource: 'platform',
                headline: {
                    gatePass: false,
                    qualityScore: 88,
                    issueCount: 5,
                    schemaCompliance: 96
                },
                platform: {
                    gatePass: false,
                    issueCount: 5,
                    generatedAt: '2026-05-25T11:59:00.000Z'
                }
            }
        });
        appendTrustSnapshot({
            historyPath,
            source: 'test',
            payload: {
                generatedAt: '2026-05-26T12:00:00.000Z',
                verificationId: 'def456',
                verificationMethod: 'simplebeacon-deterministic-gate',
                headlineSource: 'platform',
                headline: {
                    gatePass: true,
                    qualityScore: 92,
                    issueCount: 1,
                    schemaCompliance: 100
                },
                platform: {
                    gatePass: true,
                    issueCount: 1,
                    generatedAt: '2026-05-26T11:59:00.000Z'
                }
            }
        });

        const history = readTrustHistory(historyPath);
        expect(history.entries).toHaveLength(2);
        const trend = buildTrustTrend(history.entries, 30);
        expect(trend.snapshots).toBe(2);
        expect(trend.latest.issues).toBe(1);
        expect(trend.issueDelta).toBeLessThan(0);
    });

    test('trust publish env validation enforces strict https guardrail', () => {
        const prev = {
            endpoint: process.env.TRUST_PUBLISH_ENDPOINT,
            strict: process.env.TRUST_PUBLISH_STRICT,
            required: process.env.TRUST_PUBLISH_REQUIRED,
            token: process.env.TRUST_PUBLISH_TOKEN,
            tokenRequired: process.env.TRUST_PUBLISH_REQUIRE_TOKEN,
            allowHttp: process.env.TRUST_PUBLISH_ALLOW_HTTP
        };
        process.env.TRUST_PUBLISH_ENDPOINT = 'http://trust.example.internal/api/trust/publish';
        process.env.TRUST_PUBLISH_STRICT = 'true';
        process.env.TRUST_PUBLISH_REQUIRED = 'true';
        process.env.TRUST_PUBLISH_TOKEN = 'dummy-token';
        process.env.TRUST_PUBLISH_REQUIRE_TOKEN = 'true';
        process.env.TRUST_PUBLISH_ALLOW_HTTP = 'false';
        try {
            const summary = buildValidationSummary();
            expect(summary.ready).toBe(false);
            expect(summary.errors.join(' ')).toMatch(/not HTTPS/i);
        } finally {
            if (prev.endpoint === undefined) delete process.env.TRUST_PUBLISH_ENDPOINT; else process.env.TRUST_PUBLISH_ENDPOINT = prev.endpoint;
            if (prev.strict === undefined) delete process.env.TRUST_PUBLISH_STRICT; else process.env.TRUST_PUBLISH_STRICT = prev.strict;
            if (prev.required === undefined) delete process.env.TRUST_PUBLISH_REQUIRED; else process.env.TRUST_PUBLISH_REQUIRED = prev.required;
            if (prev.token === undefined) delete process.env.TRUST_PUBLISH_TOKEN; else process.env.TRUST_PUBLISH_TOKEN = prev.token;
            if (prev.tokenRequired === undefined) delete process.env.TRUST_PUBLISH_REQUIRE_TOKEN; else process.env.TRUST_PUBLISH_REQUIRE_TOKEN = prev.tokenRequired;
            if (prev.allowHttp === undefined) delete process.env.TRUST_PUBLISH_ALLOW_HTTP; else process.env.TRUST_PUBLISH_ALLOW_HTTP = prev.allowHttp;
        }
    });

    test('trust methodology endpoint exposes scope transparency', async () => {
        const platformRoot = path.join(tmpRoot, 'ai-platform');
        const monorepoRoot = tmpRoot;
        fs.mkdirSync(platformRoot, { recursive: true });

        writeReport(platformRoot, {
            type: 'simplebeacon-report',
            generatedAt: '2026-05-26T12:00:00.000Z',
            projectRoot: platformRoot,
            qualityScore: 96,
            issueCount: 2,
            schemaCompliance: 100,
            repositoryFilesTotal: 42000,
            ruleScopedFilesAnalyzed: 1200,
            fictionJsonFilesScanned: 67,
            fictionSampleFilesScanned: 40,
            fictionScope: 'repository-json',
            gate: { pass: true }
        });

        const app = express();
        setupTrustAPI(app, { platformRoot, monorepoRoot });
        const server = await new Promise((resolve) => {
            const s = app.listen(0, () => resolve(s));
        });
        const { port } = server.address();
        try {
            const response = await fetch(`http://127.0.0.1:${port}/api/trust/methodology`);
            expect(response.ok).toBe(true);
            const body = await response.json();
            expect(body.success).toBe(true);
            expect(body.scope).toBeTruthy();
            expect(typeof body.scope.coveragePercent === 'number' || body.scope.coveragePercent === null).toBe(true);
            expect(Array.isArray(body.methodology)).toBe(true);
            expect(body.fictionScope).toBeTruthy();
            expect(body.scope.fictionJsonFilesScanned).toBe(67);
        } finally {
            await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
        }
    });
});
