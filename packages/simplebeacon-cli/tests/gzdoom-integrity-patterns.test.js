/**
 * GZDoom integrity scanner — cross-reference and log correlation tests.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { parseGzdoomLog } = require('../src/lib/gzdoom-log-parser');
const {
    buildGzdoomSymbolGraph,
    validateGzdoomCrossReferences,
    correlateLogEntries,
    stripComments,
    expandIncludes
} = require('../src/lib/gzdoom-symbol-graph');
const { scanGzdoomIntegrity } = require('../src/rules/gzdoom-integrity-patterns');
const { isVanillaActor } = require('../src/lib/gzdoom-vanilla-actors');
const { resolveReachableGzdoomFiles } = require('../src/lib/gzdoom-include-resolver');

const FIXTURE_ROOT = path.join(__dirname, 'fixtures', 'gzdoom-minimod');
const INCLUDE_FIXTURE = path.join(__dirname, 'fixtures', 'gzdoom-includes');
const VANILLA_FIXTURE = path.join(__dirname, 'fixtures', 'gzdoom-vanilla');

describe('gzdoom log parser', () => {
    it('parses unknown sprite, unknown class, and duplicate class lines', () => {
        const log = require('fs').readFileSync(path.join(FIXTURE_ROOT, 'fog_pbr.log'), 'utf8');
        const entries = parseGzdoomLog(log);
        assert.ok(entries.length >= 3);
        assert.ok(entries.some((e) => e.kind === 'unknown-sprite' && e.details.sprite === 'RGVX'));
        assert.ok(entries.some((e) => e.kind === 'unknown-class' && e.details.className === 'DitchedPistol'));
        assert.ok(entries.some((e) => e.kind === 'duplicate-class' && e.details.className === 'Rocket'));
    });

    it('parses Script error and missing string lines', () => {
        const log = [
            'Script error, "E:/Ai/Games/Doom/TEst/results/R3DOptions/:sndinfo" line 120:',
            'Missing string (unexpected end of file).'
        ].join('\n');
        const entries = parseGzdoomLog(log);
        assert.ok(entries.some((e) => e.kind === 'script-error' && e.details.line === 120));
        assert.ok(entries.some((e) => e.details.filePath && /sndinfo/i.test(e.details.filePath)));
        assert.ok(entries.some((e) => e.kind === 'missing-string'));
    });
});

describe('gzdoom symbol graph', () => {
    it('flags unresolved sprite, actor, projectile, weaponslot, duplicate, and replaces conflicts', async () => {
        const graph = await buildGzdoomSymbolGraph(FIXTURE_ROOT);
        const issues = validateGzdoomCrossReferences(graph);

        assert.ok(issues.some((i) => i.type === 'gzdoom-unresolved-sprite' && /RGVX/.test(i.description)));
        assert.ok(issues.some((i) => i.type === 'gzdoom-unresolved-actor' && /VoxelRiotgun/.test(i.description)));
        assert.ok(issues.some((i) => i.type === 'gzdoom-unresolved-projectile' && /MissingBullet/.test(i.description)));
        assert.ok(issues.some((i) => i.type === 'gzdoom-unresolved-weaponslot' && /UndefinedMinigun/.test(i.description)));
        assert.ok(issues.some((i) => i.type === 'gzdoom-duplicate-class' && /Rocket/.test(i.description)));
        assert.ok(issues.some((i) => i.type === 'gzdoom-replaces-conflict' && /Shotgun/.test(i.description)));
        assert.ok(issues.some((i) => i.type === 'gzdoom-double-ammo-consumption' && /PistolMag/.test(i.description)));
    });

    it('correlates runtime log entries to source files', async () => {
        const graph = await buildGzdoomSymbolGraph(FIXTURE_ROOT);
        const log = require('fs').readFileSync(path.join(FIXTURE_ROOT, 'fog_pbr.log'), 'utf8');
        const correlated = correlateLogEntries(parseGzdoomLog(log), graph);
        assert.ok(correlated.some((i) => i.type === 'gzdoom-runtime-unknown-sprite' && i.filePath === 'MODELDEF'));
        assert.ok(correlated.some((i) => i.type === 'gzdoom-runtime-unknown-class'));
        assert.ok(correlated.some((i) => i.type === 'gzdoom-runtime-duplicate-class'));
    });
});

describe('scanGzdoomIntegrity', () => {
    it('merges static analysis and log correlation', async () => {
        const result = await scanGzdoomIntegrity(FIXTURE_ROOT, {
            logPath: path.join(FIXTURE_ROOT, 'fog_pbr.log'),
            extendedLint: false
        });
        assert.ok(result.findings >= 8);
        assert.ok(result.scanned >= 3);
        assert.ok(result.graphSummary.actors >= 4);
    });
});

describe('gzdoom vanilla actor allowlist', () => {
    it('suppresses unresolved MODELDEF refs to engine actors like BackPack', async () => {
        const graph = await buildGzdoomSymbolGraph(VANILLA_FIXTURE);
        const issues = validateGzdoomCrossReferences(graph);
        assert.ok(isVanillaActor('BackPack'));
        assert.ok(!issues.some((i) => i.type === 'gzdoom-unresolved-actor' && /BackPack/.test(i.description)));
        assert.ok(issues.some((i) => i.type === 'gzdoom-unresolved-actor' && /CustomMissingActor/.test(i.description)));
    });
});

describe('gzdoom include reachability', () => {
    it('skips orphan .zs files not reachable from ZSCRIPT', async () => {
        const files = await require('../src/lib/gzdoom-symbol-graph').collectGzdoomFiles(INCLUDE_FIXTURE);
        const { reachable, orphans } = resolveReachableGzdoomFiles(INCLUDE_FIXTURE, files);
        assert.ok(reachable.has('active.zs'));
        assert.ok(orphans.includes('orphan-only.zs'));
        const graph = await buildGzdoomSymbolGraph(INCLUDE_FIXTURE, { respectIncludes: true });
        assert.ok(!graph.actors.has('OrphanOnlyClass'));
        assert.ok(graph.actors.has('ActiveWeapon'));
    });

    it('does not flag duplicate ActiveWeapon when orphan file is excluded', async () => {
        const issues = validateGzdoomCrossReferences(await buildGzdoomSymbolGraph(INCLUDE_FIXTURE));
        assert.ok(!issues.some((i) => i.type === 'gzdoom-duplicate-class' && /ActiveWeapon/.test(i.description)));
    });
});

describe('gzdoom inventory cleanup suppression', () => {
    it('suppresses asymmetry inside Strip/Remove helper functions', async () => {
        const graph = await buildGzdoomSymbolGraph(VANILLA_FIXTURE);
        const issues = validateGzdoomCrossReferences(graph);
        assert.ok(!issues.some((i) => i.type === 'gzdoom-inventory-asymmetry' && /RenderAliasToken/.test(i.description)));
        assert.ok(issues.some((i) => i.type === 'gzdoom-inventory-asymmetry' && /NeverGivenItem/.test(i.description)));
    });
});

describe('stripComments', () => {
    it('removes line comments while preserving line numbers', () => {
        const input = 'class A : Actor {\n}\n// class B : Actor {\n// fake class\n';
        const stripped = stripComments(input);
        // The real class A should still be findable
        assert.ok(/\bclass\s+A\b/.test(stripped));
        // The commented class B should be gone
        assert.ok(!/\bclass\s+B\b/.test(stripped));
    });

    it('removes block comments while preserving newlines', () => {
        const input = '/* class CommentedOut : Actor {} */\nclass Real : Actor {}\n';
        const stripped = stripComments(input);
        assert.ok(!/\bclass\s+CommentedOut\b/.test(stripped));
        assert.ok(/\bclass\s+Real\b/.test(stripped));
        // Newline should be preserved
        assert.ok(stripped.includes('\n'));
    });

    it('does not treat // inside string literals as comments', () => {
        const input = 'class Foo : Actor { string url = "http://example.com"; }\n';
        const stripped = stripComments(input);
        assert.ok(stripped.includes('http://example.com'));
    });

    it('handles nested-looking block comment closes correctly', () => {
        const input = '/* outer /* inner */ class NotReal : Actor {} */\nclass Real : Actor {}\n';
        const stripped = stripComments(input);
        // After first */ close, the rest is code — but class NotReal is after the close
        // The key is class Real should always be present
        assert.ok(/\bclass\s+Real\b/.test(stripped));
    });
});

describe('gzdoom comment-aware class parsing', () => {
    it('does not flag duplicate class when name appears in comment', async () => {
        const tmp = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'sb-cmt-'));
        const fs = require('fs');
        const path = require('path');
        // File 1: real class definition
        fs.writeFileSync(path.join(tmp, 'ZSCRIPT'),
            '#include "real.zs"\n#include "comment.zs"\n', 'utf8');
        fs.writeFileSync(path.join(tmp, 'real.zs'),
            'class R3DPainElementalSprite2 : Actor {}\n', 'utf8');
        // File 2: class name only in a comment — should NOT be treated as a duplicate
        fs.writeFileSync(path.join(tmp, 'comment.zs'),
            '// This file uses R3DPainElementalSprite2 as a reference alias.\n' +
            'class AnotherClass : Actor {}\n', 'utf8');
        const graph = await buildGzdoomSymbolGraph(tmp, { respectIncludes: true });
        const issues = validateGzdoomCrossReferences(graph);
        const dupIssues = issues.filter((i) =>
            i.type === 'gzdoom-duplicate-class' && /R3DPainElementalSprite2/.test(i.description));
        assert.equal(dupIssues.length, 0,
            'Class name in a comment should not be treated as a duplicate definition');
    });
});

describe('gzdoom DECORATE include expansion', () => {
    it('follows DECORATE #include to discover actors in .txt files', async () => {
        const tmp = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'sb-inc-'));
        const fs = require('fs');
        const path = require('path');
        // DECORATE entry lump includes a .txt file
        fs.writeFileSync(path.join(tmp, 'DECORATE'),
            '#include "actors/weapons/knuckle.txt"\n', 'utf8');
        fs.mkdirSync(path.join(tmp, 'actors', 'weapons'), { recursive: true });
        // Actor defined in a .txt file (non-GZDoom extension)
        fs.writeFileSync(path.join(tmp, 'actors', 'weapons', 'knuckle.txt'),
            'Actor Knuckle : Weapon\n{\n  States\n  {\n  Ready:\n    KNCK A 1;\n    Loop;\n  }\n}\n', 'utf8');
        // MODELDEF references the Knuckle actor
        fs.writeFileSync(path.join(tmp, 'MODELDEF'),
            'Model Knuckle\n{\n  Path "models/knuckle/"\n  Model 0 "knuckle.md3"\n  FrameIndex KNCK A 0 0\n}\n', 'utf8');

        const graph = await buildGzdoomSymbolGraph(tmp, { respectIncludes: true });
        // The Knuckle actor should be discovered through the include chain
        assert.ok(graph.actors.has('Knuckle'),
            'Knuckle actor should be discovered via DECORATE #include of .txt file');
        const issues = validateGzdoomCrossReferences(graph);
        // Should NOT flag Knuckle as unresolved
        assert.ok(!issues.some((i) =>
            i.type === 'gzdoom-unresolved-actor' && /Knuckle/.test(i.description)),
            'Knuckle should be resolved through DECORATE include chain');
    });
});
