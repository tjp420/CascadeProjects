const {
    tokenJaccardSimilarity,
    lineHashJaccardSimilarity,
    findFuzzyNearDuplicates,
    findPatternConsolidationCandidates,
    buildAdvancedAnalysis,
    DEFAULT_FUZZY_THRESHOLD
} = require('../../server/lib/fuzzy-content-matcher');

describe('fuzzy content matcher', () => {
    test('token Jaccard detects near-identical strings', () => {
        const a = 'function helloWorld() { return 42; }';
        const b = 'function helloWorld() { return 43; }';
        expect(tokenJaccardSimilarity(a, b)).toBeGreaterThan(0.85);
    });

    test('line-hash Jaccard detects shared line structure', () => {
        const a = 'line one\nline two\nline three';
        const b = 'line one\nline two\nline four';
        expect(lineHashJaccardSimilarity(a, b)).toBeGreaterThanOrEqual(0.5);
    });

    test('findFuzzyNearDuplicates respects threshold', () => {
        const files = [
            { path: '/tmp/a.js', relativePath: 'server/a.js', name: 'a.js', ext: '.js', size: 200 },
            { path: '/tmp/b.js', relativePath: 'server/b.js', name: 'b.js', ext: '.js', size: 200 }
        ];
        const originalRead = require('fs').readFileSync;
        require('fs').readFileSync = (p) => {
            if (String(p).includes('a.js')) return 'alpha beta gamma delta';
            if (String(p).includes('b.js')) return 'alpha beta gamma epsilon';
            return originalRead(p);
        };
        try {
            const pairs = findFuzzyNearDuplicates(files, { threshold: 0.5, maxFiles: 10 });
            expect(pairs.length).toBeGreaterThan(0);
            expect(pairs[0]).toHaveProperty('method');
        } finally {
            require('fs').readFileSync = originalRead;
        }
    });

    test('findPatternConsolidationCandidates groups part files without loader', () => {
        const files = [
            { relativePath: 'web/scripts/export-system.part1.js', name: 'export-system.part1.js', size: 1000 },
            { relativePath: 'web/scripts/export-system.part2.js', name: 'export-system.part2.js', size: 1000 }
        ];
        const groups = findPatternConsolidationCandidates(files);
        expect(groups).toHaveLength(1);
        expect(groups[0].fileCount).toBe(2);
    });

    test('findPatternConsolidationCandidates skips intentional chunk loaders', () => {
        const files = [
            { relativePath: 'web/scripts/export-system.js', name: 'export-system.js', size: 900 },
            { relativePath: 'web/scripts/export-system.part1.js', name: 'export-system.part1.js', size: 1000 },
            { relativePath: 'web/scripts/export-system.part2.js', name: 'export-system.part2.js', size: 1000 }
        ];
        const groups = findPatternConsolidationCandidates(files);
        expect(groups).toHaveLength(0);
    });

    test('findFuzzyNearDuplicates skips monorepo generated report pairs', () => {
        const files = [
            { path: '/tmp/root-report.json', relativePath: '.simplebeacon/report.json', name: 'report.json', ext: '.json', size: 200 },
            { path: '/tmp/platform-report.json', relativePath: 'ai-platform/.simplebeacon/report.json', name: 'report.json', ext: '.json', size: 200 }
        ];
        const originalRead = require('fs').readFileSync;
        require('fs').readFileSync = () => '{"type":"simplebeacon-report","generatedAt":"2026-05-26T00:00:00.000Z","gate":{"pass":true}}';
        try {
            const pairs = findFuzzyNearDuplicates(files, { threshold: 0.5, maxFiles: 10 });
            expect(pairs).toHaveLength(0);
        } finally {
            require('fs').readFileSync = originalRead;
        }
    });

    test('buildAdvancedAnalysis includes semantic hints block', () => {
        const analysis = buildAdvancedAnalysis([], { threshold: DEFAULT_FUZZY_THRESHOLD });
        expect(analysis.fuzzyNearDuplicates.threshold).toBe(0.85);
        expect(analysis.patternConsolidation).toHaveProperty('recommendations');
        expect(analysis.semanticHints).toHaveProperty('enabled');
    });
});
