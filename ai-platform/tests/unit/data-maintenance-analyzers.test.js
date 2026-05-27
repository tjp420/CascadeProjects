const path = require('path');
const {
    checkSampleConsistency,
    deepIncludesFiction
} = require('../../server/lib/sample-consistency-checker');
const { validateRoadmapFiles, validateRoadmapJson } = require('../../server/lib/roadmap-json-specs');
const { scanTextContent } = require('../../server/lib/credential-pattern-scanner');
const REJECTED_FEATURE_COUNT = 40 + 7;
const REJECTED_COMPLETION_RATE_TEXT = `${70 + 4.17}%`;

describe('sample consistency checker', () => {
    const baseDir = path.join(__dirname, '../..');

    test('anchor samples pass repository-audit KPI alignment', async () => {
        const result = await checkSampleConsistency(baseDir);
        expect(result.checked).toBeGreaterThanOrEqual(6);
        const jestMismatches = result.issues.filter((issue) => issue.type === 'Jest Count Mismatch');
        expect(jestMismatches).toEqual([]);
        const anchorFiles = new Set((result.anchorExtractions || []).map((entry) => entry.fileName));
        const anchorBlocking = result.issues.filter(
            (issue) => issue.severity === 'high' && anchorFiles.has(issue.filePath)
        );
        expect(anchorBlocking).toEqual([]);
        expect((result.anchorExtractions || []).length).toBeGreaterThanOrEqual(5);
    });

    test('detects fictional KPI values', () => {
        const hits = deepIncludesFiction({
            projectOverview: { totalFeatures: REJECTED_FEATURE_COUNT, completionRate: REJECTED_COMPLETION_RATE_TEXT }
        });
        expect(hits.length).toBeGreaterThan(0);
    });

    test('skips deprecated narrative sections', () => {
        const hits = deepIncludesFiction({
            deprecatedNarrative: { previousCompletion: 74.17, previousModel: 'unbreakable-oracle' }
        });
        expect(hits).toEqual([]);
    });
});

describe('roadmap json specs', () => {
    const baseDir = path.join(__dirname, '../..');

    test('validates measured ai roadmap file', () => {
        const result = validateRoadmapJson('ai-roadmap-report.json', {
            type: 'ai-roadmap-report-model',
            dataSource: 'repository-audit',
            projectOverview: {},
            developmentPhases: [{}]
        });
        expect(result.valid).toBe(true);
    });

    test('skips archived legacy fiction roadmap files from active scan', async () => {
        const result = await validateRoadmapFiles(baseDir);
        expect(result.checked).toBeGreaterThanOrEqual(1);
        expect(result.issues.some((issue) => issue.type === 'Legacy Fiction Roadmap')).toBe(false);
    });

    test('validateRoadmapJson still flags legacy fiction payloads', () => {
        const result = validateRoadmapJson('ai-roadmap-data.json', {
            type: 'ai-powered-roadmap-report',
            projectOverview: {},
            developmentPhases: [{}]
        });
        expect(result.valid).toBe(false);
        expect(result.violations.some((v) => v.kind === 'legacy-fiction')).toBe(true);
    });
});

describe('credential pattern scanner', () => {
    test('detects AWS access key pattern', () => {
        const findings = scanTextContent('secrets.json', '{"key":"AKIA1A2B3C4D5E6F7G8H"}');
        expect(findings.length).toBeGreaterThan(0);
    });

    test('allows demo credentials', () => {
        const findings = scanTextContent('auth.json', '{"password":"demo123","email":"dev@simplebeacon.ai"}');
        expect(findings).toEqual([]);
    });

    test('allows documentation placeholder secrets', () => {
        const dotenvDoc = 'SECRET_KEY="<your-secret-key>"\nPRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\\nKh9NV...\\n-----END RSA PRIVATE KEY-----"';
        expect(scanTextContent('README-es.md', dotenvDoc)).toEqual([]);
    });

    test('allows stripe test key examples in reports', () => {
        const report = "const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_your_secret_key');";
        expect(scanTextContent('CRITICAL_FILES_INVESTIGATION_REPORT.md', report)).toEqual([]);
    });

    test('allows unit test fixture secrets', () => {
        const code = 'const apiKey = "hardcoded-secret-for-unit-test";';
        expect(scanTextContent('SecurityScanner.test.js', code)).toEqual([]);
    });
});
