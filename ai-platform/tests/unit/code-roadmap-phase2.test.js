const path = require('path');
const os = require('os');
const fs = require('fs');
const {
    buildPhase2Analysis,
    detectCircularDependencies,
    estimateSoloResources,
    detectGgufAvailability,
    FUZZY_THRESHOLD
} = require('../../server/lib/code-roadmap-phase2');
const { renderExecutiveHtml } = require('../../server/lib/code-roadmap-export');
const { generateCodeRoadmap } = require('../../server/lib/code-roadmap-generator');

describe('code roadmap phase 2', () => {
    const baseDir = path.join(__dirname, '../..');

    test('buildPhase2Analysis returns dependency, fuzzy, and resource blocks', async () => {
        const roadmap = await generateCodeRoadmap(baseDir);
        const phase2 = roadmap.codeAnalysis.phase2;

        expect(phase2.phase).toMatch(/Phase 2/);
        expect(phase2.dependencyGraph.summary).toHaveProperty('nodes');
        expect(phase2.fuzzySimilarity.threshold).toBe(FUZZY_THRESHOLD);
        expect(phase2.resourceEstimate.teamSize).toBe(1);
        expect(phase2.resourceEstimate.budgetNote).toMatch(/\$204k/);
        expect(phase2.rejectedFiction.claims.length).toBeGreaterThan(0);
    });

    test('detectCircularDependencies finds a simple cycle', () => {
        const graph = {
            adjacencyList: {
                'a.js': ['b.js'],
                'b.js': ['c.js'],
                'c.js': ['a.js']
            }
        };
        const cycles = detectCircularDependencies(graph);
        expect(cycles.length).toBeGreaterThan(0);
        expect(cycles[0].path.length).toBeGreaterThanOrEqual(3);
    });

    test('estimateSoloResources uses remaining sprint progress', () => {
        const estimate = estimateSoloResources({
            phases: [
                { phase: 'Sprint 3', status: 'in-progress', progress: 80 },
                { phase: 'Sprint 4', status: 'planned', progress: 0 }
            ]
        });
        expect(estimate.teamSize).toBe(1);
        expect(estimate.estimatedHours).toBeGreaterThan(0);
        expect(estimate.internalBudgetUsd).toBe(estimate.estimatedHours * estimate.hourlyRateUsd);
    });

    test('detectGgufAvailability reflects LLAMA_CPP_BIN', () => {
        const original = process.env.LLAMA_CPP_BIN;
        delete process.env.LLAMA_CPP_BIN;
        expect(detectGgufAvailability().available).toBe(false);

        process.env.LLAMA_CPP_BIN = process.execPath;
        const withBin = detectGgufAvailability();
        expect(withBin.available).toBe(true);
        expect(withBin.mode).toBe('llama-cpp-ready');

        if (original === undefined) delete process.env.LLAMA_CPP_BIN;
        else process.env.LLAMA_CPP_BIN = original;
    });

    test('buildPhase2Analysis includes semanticHints block', async () => {
        const roadmap = await generateCodeRoadmap(baseDir);
        expect(roadmap.codeAnalysis.phase2.semanticHints).toHaveProperty('enabled');
        expect(roadmap.codeAnalysis.phase2.semanticHints).toHaveProperty('hints');
    });

    test('renderExecutiveHtml includes sprint phases and phase2 tables', async () => {
        const roadmap = await generateCodeRoadmap(baseDir);
        const html = renderExecutiveHtml(roadmap);

        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('Executive Summary');
        expect(html).toContain('Circular Dependencies');
        expect(html).toContain('Fuzzy Similarity Pairs');
        expect(html).toContain('Semantic Hints');
        expect(html).toContain('Measured baseline');
    });

    test('buildPhase2Analysis scans temp project files', () => {
        const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase2-'));
        const aPath = path.join(tmpRoot, 'a.js');
        const bPath = path.join(tmpRoot, 'b.js');
        fs.writeFileSync(aPath, "const b = require('./b'); module.exports = { a: 1, tokenAlpha beta gamma };");
        fs.writeFileSync(bPath, "const a = require('./a'); module.exports = { b: 1, tokenAlpha beta gamma };");

        const files = [
            { path: aPath, relativePath: 'a.js', ext: '.js', size: 80 },
            { path: bPath, relativePath: 'b.js', ext: '.js', size: 80 }
        ];
        const sprintModel = {
            phases: [{ phase: 'Sprint 1', status: 'planned', progress: 0 }]
        };

        const phase2 = buildPhase2Analysis(files, tmpRoot, sprintModel);
        expect(phase2.dependencyGraph.summary.edges).toBeGreaterThan(0);
        expect(phase2.dependencyGraph.circularDependencies.length).toBeGreaterThan(0);

        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });
});
