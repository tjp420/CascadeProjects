// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
/**
 * Tests for the AI-blind anonymized export engine.
 * Ensures zero IP leakage while preserving compliance verifiability.
 */

const assert = require('assert');
const { describe, it } = require('node:test');
const {
    buildAnonymizedExport,
    signAnonymizedExport,
    verifyAnonymizedExport,
    validateAnonymizedSchema,
    resolveTypeCode,
    SEVERITY_BANDS
} = require('../src/lib/anonymized-export');

function makeMockReport(overrides = {}) {
    return {
        projectRoot: '/home/acme/super-secret-project',
        platformRoot: '/home/acme/super-secret-project',
        configPath: '/home/acme/super-secret-project/.simplebeacon/config.json',
        scanPaths: ['/home/acme/super-secret-project/src', '/home/acme/super-secret-project/web/data'],
        repositoryFilesTotal: 1523,
        repositoryFoldersTotal: 89,
        ruleScopedFilesAnalyzed: 312,
        qualityScore: 87,
        schemaCompliance: 95,
        invalidJson: 1,
        emptyFiles: 0,
        duplicateGroups: 2,
        fictionJsonFilesScanned: 45,
        fictionSampleFilesScanned: 12,
        credentialFindings: 3,
        productionLeakFindings: 1,
        sourceFictionPatternHits: 7,
        llmSlopPatternHits: 4,
        euAiActFindings: 2,
        euAiActHighRiskIndicators: 1,
        jestBaselinePassed: false,
        severityCounts: { critical: 0, high: 3, medium: 5, low: 2 },
        rawIssues: [
            {
                id: 'schema-dashboard-sample.json',
                severity: 'high',
                type: 'Schema Violation',
                filePath: '/home/acme/super-secret-project/web/data/dashboard-sample.json',
                count: 1,
                description: 'dashboard-sample.json: Missing required field "revenue"',
                recommendedAction: 'Update mock data to conform to dashboard page schema requirements',
                affectedFiles: ['dashboard-sample.json'],
                metadata: { missingFields: ['revenue'], specFile: 'dashboard-sample.json', violations: [{ message: 'Missing revenue' }] }
            },
            {
                id: 'credential-abc123',
                severity: 'high',
                type: 'Credential Pattern',
                filePath: '/home/acme/super-secret-project/server/config.js',
                count: 2,
                description: 'Potential API key in server/config.js',
                recommendedAction: 'Move secrets to environment variables',
                affectedFiles: ['server/config.js'],
                metadata: { patternId: 'api-key-hardcoded', line: 42 }
            },
            {
                id: 'fiction-kpi-001',
                severity: 'medium',
                type: 'Fiction KPI',
                filePath: '/home/acme/super-secret-project/web/data/metrics-sample.json',
                count: 1,
                description: 'Fictional metric 98.5% detected',
                recommendedAction: 'Replace with real data or mark as mock',
                affectedFiles: ['metrics-sample.json'],
                metadata: { patternId: 'fiction-percentage', line: 7 }
            }
        ],
        gate: { pass: false, failOn: ['high'], warnOn: ['medium', 'low'], blockingCount: 5, warningCount: 7 },
        scanScope: {
            rulesEnabled: ['json-schema', 'credentials', 'fiction-kpi-patterns'],
            profile: 'standard'
        },
        ...overrides
    };
}

describe('anonymized-export', () => {
    describe('resolveTypeCode', () => {
        it('returns known codes for standard issue types', () => {
            assert.strictEqual(resolveTypeCode('Schema Violation').code, 'SB-001');
            assert.strictEqual(resolveTypeCode('Credential Pattern').code, 'SB-006');
            assert.strictEqual(resolveTypeCode('Fiction KPI').code, 'SB-007');
            assert.strictEqual(resolveTypeCode('EU AI Act Risk').code, 'SB-009');
        });

        it('returns hashed fallback for unknown types', () => {
            const meta = resolveTypeCode('Totally Unknown Type');
            assert.ok(meta.code.startsWith('SB-UNK-'));
            assert.strictEqual(meta.category, 'unknown');
        });
    });

    describe('buildAnonymizedExport', () => {
        it('produces a valid anonymized payload', () => {
            const report = makeMockReport();
            const payload = buildAnonymizedExport(report);

            assert.strictEqual(payload.schemaVersion, 'anonymized-v1');
            assert.ok(typeof payload.generatedAt === 'string');
            assert.ok(typeof payload.repoFingerprint === 'string');
            assert.ok(typeof payload.rulesFingerprint === 'string');
            assert.strictEqual(payload.gate.pass, false);
            assert.strictEqual(payload.gate.blockingCount, 5);
            assert.strictEqual(payload.gate.warningCount, 7);
        });

        it('contains only abstract issue tokens (no paths, no descriptions)', () => {
            const report = makeMockReport();
            const payload = buildAnonymizedExport(report);

            assert.ok(Array.isArray(payload.issues));
            assert.strictEqual(payload.issues.length, 3);

            for (const issue of payload.issues) {
                assert.ok(typeof issue.i === 'number', 'issue must have numeric index');
                assert.ok(typeof issue.t === 'string', 'issue must have type code');
                assert.ok(typeof issue.c === 'string', 'issue must have category');
                assert.ok(SEVERITY_BANDS.includes(issue.s), 'severity must be a valid band');
                assert.ok(typeof issue.n === 'number', 'issue must have count');

                assert.strictEqual(issue.filePath, undefined, 'filePath must be stripped');
                assert.strictEqual(issue.description, undefined, 'description must be stripped');
                assert.strictEqual(issue.metadata, undefined, 'metadata must be stripped');
                assert.strictEqual(issue.affectedFiles, undefined, 'affectedFiles must be stripped');
                assert.strictEqual(issue.recommendedAction, undefined, 'recommendedAction must be stripped');
            }
        });

        it('maps issues to deterministic type codes', () => {
            const report = makeMockReport();
            const payload = buildAnonymizedExport(report);

            const codes = payload.issues.map((i) => i.t);
            assert.ok(codes.includes('SB-001'));
            assert.ok(codes.includes('SB-006'));
            assert.ok(codes.includes('SB-007'));
        });

        it('contains metrics but no project paths', () => {
            const report = makeMockReport();
            const payload = buildAnonymizedExport(report);

            assert.strictEqual(payload.metrics.repositoryFilesTotal, 1523);
            assert.strictEqual(payload.metrics.qualityScore, 87);
            assert.strictEqual(payload.metrics.credentialFindings, 3);
            assert.strictEqual(payload.metrics.euAiActHighRiskIndicators, 1);

            assert.strictEqual(payload.projectRoot, undefined);
            assert.strictEqual(payload.platformRoot, undefined);
            assert.strictEqual(payload.configPath, undefined);
            assert.strictEqual(payload.scanPaths, undefined);
        });

        it('produces deterministic repoFingerprint for same root', () => {
            const report = makeMockReport();
            const a = buildAnonymizedExport(report).repoFingerprint;
            const b = buildAnonymizedExport(report).repoFingerprint;
            assert.strictEqual(a, b);
        });

        it('produces different repoFingerprints for different roots', () => {
            const a = buildAnonymizedExport(makeMockReport({ projectRoot: '/a' })).repoFingerprint;
            const b = buildAnonymizedExport(makeMockReport({ projectRoot: '/b' })).repoFingerprint;
            assert.notStrictEqual(a, b);
        });

        it('rolls up aggregate counts', () => {
            const report = makeMockReport();
            const payload = buildAnonymizedExport(report);

            assert.ok(typeof payload.aggregate === 'object');
            assert.ok(typeof payload.aggregate.byType === 'object');
            assert.ok(typeof payload.aggregate.bySeverity === 'object');
            assert.ok(typeof payload.aggregate.byCategory === 'object');
            assert.ok(payload.aggregate.bySeverity.high >= 1);
            assert.ok(payload.aggregate.bySeverity.medium >= 1);
        });
    });

    describe('signAnonymizedExport / verifyAnonymizedExport', () => {
        it('signs and verifies a valid payload', () => {
            const report = makeMockReport();
            const payload = buildAnonymizedExport(report);
            const secret = 'placeholder-secret';
            const signed = signAnonymizedExport(payload, secret);

            assert.ok(signed._integrity, 'signature must be present');
            assert.strictEqual(signed._integrityAlgo, 'hmac-sha256');

            const valid = verifyAnonymizedExport(signed, secret);
            assert.strictEqual(valid, true);
        });

        it('rejects tampered payload', () => {
            const report = makeMockReport();
            const payload = buildAnonymizedExport(report);
            const secret = 'placeholder-secret';
            const signed = signAnonymizedExport(payload, secret);

            signed.gate.pass = true; // tamper
            const valid = verifyAnonymizedExport(signed, secret);
            assert.strictEqual(valid, false);
        });

        it('rejects wrong secret', () => {
            const report = makeMockReport();
            const payload = buildAnonymizedExport(report);
            const signed = signAnonymizedExport(payload, 'correct-secret');
            const valid = verifyAnonymizedExport(signed, 'wrong-secret');
            assert.strictEqual(valid, false);
        });
    });

    describe('validateAnonymizedSchema', () => {
        it('validates a correct payload', () => {
            const report = makeMockReport();
            const payload = buildAnonymizedExport(report);
            const result = validateAnonymizedSchema(payload);
            assert.strictEqual(result.valid, true);
            assert.deepStrictEqual(result.errors, []);
        });

        it('catches missing gate.pass', () => {
            const payload = buildAnonymizedExport(makeMockReport());
            delete payload.gate;
            const result = validateAnonymizedSchema(payload);
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some((e) => e.includes('gate.pass')));
        });

        it('catches malformed issue entries', () => {
            const payload = buildAnonymizedExport(makeMockReport());
            payload.issues[0].t = undefined;
            const result = validateAnonymizedSchema(payload);
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some((e) => e.includes('t missing')));
        });

        it('catches unsupported schema version', () => {
            const payload = buildAnonymizedExport(makeMockReport());
            payload.schemaVersion = 'anonymized-v0';
            const result = validateAnonymizedSchema(payload);
            assert.strictEqual(result.valid, false);
            assert.ok(result.errors.some((e) => e.includes('Unsupported schema')));
        });
    });
});
