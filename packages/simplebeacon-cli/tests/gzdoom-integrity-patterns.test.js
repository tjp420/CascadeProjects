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
    correlateLogEntries
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
