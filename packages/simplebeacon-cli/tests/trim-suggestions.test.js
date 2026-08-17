const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runFileReductionAnalysis } = require('../src/analyzers/file-reduction');
const { buildTrimSuggestions, formatTrimSuggestionsMarkdown } = require('../src/lib/trim-suggestions');
const { buildFileReductionPlan } = require('../src/lib/file-reduction-plan');
const { enrichCleanupReport } = require('../src/lib/enrich-cleanup-report');

function makeTempProject(structure) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-trim-'));
    for (const [relPath, content] of Object.entries(structure)) {
        const fullPath = path.join(root, relPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content, 'utf8');
    }
    return root;
}

test('buildTrimSuggestions prioritizes logs and dead exports', () => {
    const report = {
        generatedAt: '2026-08-17T00:00:00.000Z',
        findings: {
            deadCode: [{
                type: 'dead-export',
                path: 'src/util.js',
                confidence: 'medium',
                action: 'remove-dead-export',
                reason: 'never imported',
                metadata: { symbol: 'unusedFn' }
            }]
        },
        fileReductionPlan: {
            reviewBeforeDelete: {
                logs: [{ path: 'app.log', bytes: 4096 }]
            },
            duplicateAssets: { topGroups: [] },
            unusedFiles: { candidates: 0 }
        }
    };

    const trim = buildTrimSuggestions(report, report.fileReductionPlan);
    assert.equal(trim.phases.deleteLogs.count, 1);
    assert.equal(trim.phases.removeDeadExports.count, 1);
    assert.ok(trim.topActions.length >= 2);
    assert.match(trim.agentPrompt, /Phase 1/);
    assert.match(formatTrimSuggestionsMarkdown(trim), /unusedFn/);
});

test('buildFileReductionPlan attaches trimSuggestions and deadCode section', async () => {
    const root = makeTempProject({
        'package.json': JSON.stringify({ main: 'index.js' }),
        'index.js': 'export const used = 1;\nexport const dead = 2;\nconsole.log(used);',
        'lib/helper.js': 'import { used } from "../index.js";\nconsole.log(used);',
        'debug.log': 'line\n'
    });

    const report = await runFileReductionAnalysis(root, {
        scanners: {
            'build-artifacts': { enabled: true },
            'dead-code': { enabled: true }
        }
    });
    const plan = buildFileReductionPlan(report);

    assert.ok(plan.deadCode);
    assert.ok(plan.trimSuggestions);
    assert.ok(Array.isArray(plan.trimSuggestions.topActions));
});

test('enrichCleanupReport exposes trimSuggestions for dashboard', async () => {
    const root = makeTempProject({
        'package.json': JSON.stringify({ main: 'index.js' }),
        'index.js': 'export const dead = 1;\n',
        'src/app.log': 'log entry\n'
    });

    const raw = await runFileReductionAnalysis(root, {
        scanners: {
            'build-artifacts': { enabled: true },
            'dead-code': { enabled: true }
        }
    });
    raw.scanProfile = 'file-reduction';
    const enriched = enrichCleanupReport(raw, { profile: 'file-reduction' });

    assert.ok(enriched.trimSuggestions);
    assert.ok(enriched.fileReductionPlan.deadCode);
});
