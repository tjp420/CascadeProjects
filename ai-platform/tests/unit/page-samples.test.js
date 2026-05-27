const fs = require('fs');
const path = require('path');
const { detectPayloadType } = require('../../web/scripts/payload-routing');
const { PAGE_SAMPLE_SPECS, ROADMAP_SAMPLES } = require('../helpers/page-sample-specs');
const { resolveSampleFilePath } = require('../../server/lib/sample-path-resolver');

const DATA_DIR = path.join(__dirname, '../../web/data');
const PLATFORM_ROOT = path.join(__dirname, '../..');

function sampleFilePath(filename) {
    return resolveSampleFilePath(PLATFORM_ROOT, filename);
}

describe('sample path resolver', () => {
    test('maps ai-roadmap sample alias to canonical report path', () => {
        const resolved = sampleFilePath('ai-roadmap-sample.json');
        expect(resolved.replace(/\\/g, '/')).toContain('data/roadmap/ai-roadmap-report.json');
        expect(fs.existsSync(resolved)).toBe(true);
    });

    test('maps gguf roadmap sample aliases to canonical data path', () => {
        for (const filename of ['gguf-roadmap-sample.json', 'gguf-development-roadmap-report.json']) {
            const resolved = sampleFilePath(filename);
            expect(resolved.replace(/\\/g, '/')).toContain('data/roadmap/gguf-roadmap-data.json');
            expect(fs.existsSync(resolved)).toBe(true);
        }
        expect(fs.existsSync(path.join(DATA_DIR, 'gguf-roadmap-sample.json'))).toBe(false);
        expect(fs.existsSync(path.join(DATA_DIR, 'gguf-development-roadmap-report.json'))).toBe(false);
    });
});

describe('dashboard page sample JSON files', () => {
    describe.each(Object.entries(PAGE_SAMPLE_SPECS))('%s', (filename, spec) => {
        let payload;

        beforeAll(() => {
            const filePath = sampleFilePath(filename);
            expect(fs.existsSync(filePath)).toBe(true);
            payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        });

        test('parses as valid JSON object', () => {
            expect(payload).toBeTruthy();
            expect(typeof payload).toBe('object');
        });

        test('has expected type field', () => {
            expect(payload.type).toBe(spec.type);
        });

        test('has required overview fields', () => {
            if (!spec.overviewKeys?.length) return;
            expect(payload.overview).toBeTruthy();
            for (const key of spec.overviewKeys) {
                expect(payload.overview).toHaveProperty(key);
            }
        });

        test('has required top-level fields', () => {
            for (const key of spec.topLevelKeys || []) {
                expect(payload).toHaveProperty(key);
            }
            for (const check of spec.nestedChecks || []) {
                let node = payload;
                for (const part of check.path) {
                    node = node?.[part];
                }
                expect(node).toBeDefined();
            }
        });

        test('has required array sections', () => {
            const allowEmpty = new Set(spec.allowEmptyArrays || []);
            for (const key of spec.arrayKeys || []) {
                expect(Array.isArray(payload[key])).toBe(true);
                if (!allowEmpty.has(key)) {
                    expect(payload[key].length).toBeGreaterThan(0);
                }
            }
            for (const key of spec.objectKeys || []) {
                expect(payload[key]).toBeTruthy();
                expect(typeof payload[key]).toBe('object');
            }
        });

        test('routes to correct dashboard section', () => {
            expect(detectPayloadType(payload)).toBeTruthy();
        });
    });

    describe.each(ROADMAP_SAMPLES)('%s', (filename) => {
        test('parses and has roadmap content', () => {
            const filePath = sampleFilePath(filename);
            expect(fs.existsSync(filePath)).toBe(true);
            const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const hasRoadmap = payload.roadmap || payload.developmentPhases || payload.projectOverview;
            expect(hasRoadmap).toBeTruthy();
        });
    });
});

describe('self-contained page scripts exist for samples', () => {
    const PAGE_SCRIPTS = [
        'ai-analysis-page.js',
        'ai-roadmap-page.js',
        'development-roadmap-page.js',
        'development-roadmap-core.js',
        'ai-tools-page.js',
        'analytics-page.js',
        'api-page.js',
        'code-generation-page.js',
        'database-page.js',
        'dashboard-home-page.js',
        'dashboard-deferred-init.js',
        'dashboard-bootstrap.js',
        'dashboard-shell.js',
        'roadmap-feature-chart.js',
        'roadmap-path-builder.js',
        'debt-reduction-page.js',
        'debt-analytics-page.js',
        'feature-backlog-page.js',
        'release-timeline-page.js',
        'billing-system-page.js',
        'project-reports-page.js',
        'assets-library-page.js',
        'code-templates-page.js',
        'coverage-reports-page.js',
        'settings-page.js',
        'help-page.js',
        'implementation-plan-page.js',
        'debt-calculator-page.js',
        'dev-tools-page.js',
        'gguf-analysis-page.js',
        'gguf-enhanced-features.js',
        'issue-resolution-page.js',
        'merger-tool-page.js',
        'performance-page.js',
        'quality-page.js',
        'security-page.js',
        'support-page.js',
        'reports-page.js'
    ];

    const SCRIPTS_DIR = path.join(__dirname, '../../web/scripts');

    test.each(PAGE_SCRIPTS)('%s is present', (script) => {
        expect(fs.existsSync(path.join(SCRIPTS_DIR, script))).toBe(true);
    });
});
