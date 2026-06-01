const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runTextRulePassesParallel, resolveWorkerCount } = require('../src/lib/full-tree-scan-pool');

test('resolveWorkerCount returns 0 for small job batches', () => {
    assert.equal(resolveWorkerCount(10, { parallel: true }), 0);
});

test('runTextRulePassesParallel processes jobs sequentially when below threshold', async () => {
    const jobs = [
        {
            relativePath: 'server/a.js',
            content: 'const x = 1;\n',
            ext: '.js',
            options: {
                productionLeak: false,
                agencyHandoff: false,
                euAiAct: false,
                tokenBleed: false,
                architectureDrift: false,
                fictionPatterns: []
            }
        }
    ];
    const results = await runTextRulePassesParallel(jobs, { parallel: true });
    assert.equal(results.length, 1);
    assert.ok(results[0].issues);
});

test('runTextRulePassesParallel uses workers for large batches when parallel enabled', async () => {
    const jobs = Array.from({ length: 60 }, (_, i) => ({
        relativePath: `server/file-${i}.js`,
        content: 'const value = 1;\n',
        ext: '.js',
        options: {
            productionLeak: false,
            agencyHandoff: false,
            euAiAct: false,
            tokenBleed: false,
            architectureDrift: false,
            fictionPatterns: []
        }
    }));
    const workers = resolveWorkerCount(jobs.length, { parallel: true, parallelMinFiles: 48 });
    assert.ok(workers > 0);
    const results = await runTextRulePassesParallel(jobs, { parallel: true, parallelMinFiles: 48 });
    assert.equal(results.length, 60);
    assert.ok(results.every((r) => Array.isArray(r.issues)));
});
