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
