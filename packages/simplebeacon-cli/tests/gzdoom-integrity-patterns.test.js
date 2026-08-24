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
    expandIncludes: _expandIncludes
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
        const { reachable, orphans: _orphans } = resolveReachableGzdoomFiles(INCLUDE_FIXTURE, files);
        assert.ok(reachable.has('active.zs'));
        assert.ok(_orphans.includes('orphan-only.zs'));
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

describe('gzdoom case-insensitive path dedup', () => {
    it('does not flag duplicate classes when includes use case-variant paths', async () => {
        const tmp = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'sb-case-'));
        const fs = require('fs');
        const path = require('path');
        // Create a ZSCRIPT entry that includes the same file via two
        // case-variant paths. On Windows (case-insensitive FS), both
        // resolve to the same file on disk. Without case-insensitive
        // dedup, the scanner would collect the file twice and flag
        // every class in it as a duplicate.
        fs.writeFileSync(path.join(tmp, 'ZSCRIPT'),
            '#include "monsters/DemonClass.zs"\n' +
            '#include "monsters/demonclass.zs"\n', 'utf8');
        fs.mkdirSync(path.join(tmp, 'monsters'), { recursive: true });
        fs.writeFileSync(path.join(tmp, 'monsters', 'DemonClass.zs'),
            'class UniqueDemon : Actor {}\n', 'utf8');

        const graph = await buildGzdoomSymbolGraph(tmp, { respectIncludes: true });
        const issues = validateGzdoomCrossReferences(graph);
        const dupIssues = issues.filter((i) =>
            i.type === 'gzdoom-duplicate-class' && /UniqueDemon/.test(i.description));
        assert.equal(dupIssues.length, 0,
            'Case-variant include paths should not create phantom duplicate classes');
    });
});

describe('gzdoom ZSCRIPT.zs entry point detection', () => {
    it('accepts ZSCRIPT.zs (with .zs extension) as entry point', async () => {
        const tmp = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'sb-zs-'));
        const fs = require('fs');
        const path = require('path');
        // Entry file is named ZSCRIPT.zs (with .zs extension), not bare ZSCRIPT.
        // This is the common on-disk form. Without detecting it, the resolver
        // treats all .zs files as orphans (no entry point found).
        fs.writeFileSync(path.join(tmp, 'ZSCRIPT.zs'),
            '#include "active.zs"\n', 'utf8');
        fs.writeFileSync(path.join(tmp, 'active.zs'),
            'class EntryActive : Actor {}\n', 'utf8');
        // Orphan file not reachable from ZSCRIPT.zs
        fs.writeFileSync(path.join(tmp, 'orphan.zs'),
            'class OrphanClass : Actor {}\n', 'utf8');

        const files = await require('../src/lib/gzdoom-symbol-graph').collectGzdoomFiles(tmp);
        const { reachable, orphans: _orphans } = resolveReachableGzdoomFiles(tmp, files);
        assert.ok(reachable.has('ZSCRIPT.zs'), 'ZSCRIPT.zs should be detected as entry point');
        assert.ok(reachable.has('active.zs'), 'active.zs should be reachable from ZSCRIPT.zs');
        assert.ok(_orphans.includes('orphan.zs'), 'orphan.zs should be flagged as unreachable');

        const graph = await buildGzdoomSymbolGraph(tmp, { respectIncludes: true });
        assert.ok(graph.actors.has('EntryActive'), 'EntryActive should be discovered via ZSCRIPT.zs');
        assert.ok(!graph.actors.has('OrphanClass'), 'OrphanClass should not be discovered (unreachable file)');
    });
});

describe('gzdoom expanded vanilla actors', () => {
    it('suppresses unresolved MODELDEF refs to vanilla decorations and props', async () => {
        const tmp = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'sb-vanilla-'));
        const fs = require('fs');
        const path = require('path');
        // MODELDEF references vanilla Doom decorations that exist in the IWAD
        // but have no source in the mod. These should be suppressed via the
        // vanilla actor allowlist, not flagged as unresolved.
        fs.writeFileSync(path.join(tmp, 'MODELDEF'),
            'Model ExplosiveBarrel\n{\n  Path "models/barrel/"\n  Model 0 "barrel.md3"\n  FrameIndex BEXP A 0 0\n}\n' +
            'Model TechLamp\n{\n  Path "models/lamp/"\n  Model 0 "lamp.md3"\n  FrameIndex TLMP A 0 0\n}\n' +
            'Model GreenArmor\n{\n  Path "models/armor/"\n  Model 0 "armor.md3"\n  FrameIndex ARM1 A 0 0\n}\n' +
            'Model CustomMissingActor\n{\n  Path "models/custom/"\n  Model 0 "custom.md3"\n  FrameIndex CUST A 0 0\n}\n',
            'utf8');

        const graph = await buildGzdoomSymbolGraph(tmp, { respectIncludes: false });
        const issues = validateGzdoomCrossReferences(graph);
        // Vanilla actors should NOT be flagged
        assert.ok(!issues.some((i) => i.type === 'gzdoom-unresolved-actor' && /ExplosiveBarrel/.test(i.description)),
            'ExplosiveBarrel is a vanilla actor and should not be flagged');
        assert.ok(!issues.some((i) => i.type === 'gzdoom-unresolved-actor' && /TechLamp/.test(i.description)),
            'TechLamp is a vanilla actor and should not be flagged');
        assert.ok(!issues.some((i) => i.type === 'gzdoom-unresolved-actor' && /GreenArmor/.test(i.description)),
            'GreenArmor is a vanilla actor and should not be flagged');
        // Non-vanilla actor SHOULD still be flagged
        assert.ok(issues.some((i) => i.type === 'gzdoom-unresolved-actor' && /CustomMissingActor/.test(i.description)),
            'CustomMissingActor is not vanilla and should be flagged');
    });

    it('isVanillaActor recognizes newly added decorations', () => {
        const { isVanillaActor } = require('../src/lib/gzdoom-vanilla-actors');
        // Spot-check a representative sample of the expanded list
        assert.ok(isVanillaActor('ExplosiveBarrel'));
        assert.ok(isVanillaActor('BurningBarrel'));
        assert.ok(isVanillaActor('TechLamp'));
        assert.ok(isVanillaActor('TechPillar'));
        assert.ok(isVanillaActor('Candle'));
        assert.ok(isVanillaActor('Candlestick'));
        assert.ok(isVanillaActor('GreenArmor'));
        assert.ok(isVanillaActor('BlueArmor'));
        assert.ok(isVanillaActor('MediKit'));
        assert.ok(isVanillaActor('TallGreenColumn'));
        assert.ok(isVanillaActor('EvilEye'));
        assert.ok(isVanillaActor('FloatingSkull'));
        assert.ok(isVanillaActor('SkullPile'));
        assert.ok(isVanillaActor('DeadMarine'));
        // Non-vanilla should return false
        assert.ok(!isVanillaActor('R3DCustomActor'));
        assert.ok(!isVanillaActor('MyModBarrel'));
    });
});

describe('gzdoom extend class handling', () => {
    it('does not flag duplicate class for ZScript "extend class" blocks', async () => {
        const tmp = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'sb-ext-'));
        const fs = require('fs');
        const path = require('path');
        // ZScript "extend class" adds members to an existing class — it is NOT
        // a new class definition. The scanner must not treat it as a duplicate.
        fs.writeFileSync(path.join(tmp, 'ZSCRIPT'),
            '#include "real.zs"\n', 'utf8');
        fs.writeFileSync(path.join(tmp, 'real.zs'),
            'class MyActor : Actor {\n' +
            '  States { Spawn: TNT1 A 1; Stop; }\n' +
            '}\n' +
            '// Add attack method to existing class\n' +
            'extend class MyActor {\n' +
            '  action void A_CustomAttack() { A_FaceTarget(); }\n' +
            '}\n', 'utf8');
        const graph = await buildGzdoomSymbolGraph(tmp, { respectIncludes: true });
        const issues = validateGzdoomCrossReferences(graph);
        const dupIssues = issues.filter((i) =>
            i.type === 'gzdoom-duplicate-class' && /MyActor/.test(i.description));
        assert.equal(dupIssues.length, 0,
            '"extend class" should not be treated as a new class definition');
    });
});

describe('gzdoom commented-out #include handling', () => {
    it('does not follow #include directives inside comments', async () => {
        const tmp = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'sb-cinc-'));
        const fs = require('fs');
        const path = require('path');
        // ZSCRIPT entry includes active.zs but has commented-out includes
        // for archived files that contain duplicate class definitions.
        // The scanner must NOT follow commented-out #include lines.
        fs.writeFileSync(path.join(tmp, 'ZSCRIPT'),
            '#include "active.zs"\n' +
            '// #include "archived_dup.zs"  // ARCHIVED - duplicate class definitions\n' +
            '/* #include "blocked_dup.zs" */\n', 'utf8');
        fs.writeFileSync(path.join(tmp, 'active.zs'),
            'class ActiveClass : Actor {}\n', 'utf8');
        // These files have duplicate class names but should never be reached
        fs.writeFileSync(path.join(tmp, 'archived_dup.zs'),
            'class ActiveClass : Actor {}\n', 'utf8');
        fs.writeFileSync(path.join(tmp, 'blocked_dup.zs'),
            'class ActiveClass : Actor {}\n', 'utf8');

        const files = await require('../src/lib/gzdoom-symbol-graph').collectGzdoomFiles(tmp);
        const { reachable, orphans: _orphans } = resolveReachableGzdoomFiles(tmp, files);
        assert.ok(reachable.has('active.zs'), 'active.zs should be reachable');
        assert.ok(!reachable.has('archived_dup.zs'),
            'archived_dup.zs should NOT be reachable (commented-out include)');
        assert.ok(!reachable.has('blocked_dup.zs'),
            'blocked_dup.zs should NOT be reachable (block-comment include)');

        const graph = await buildGzdoomSymbolGraph(tmp, { respectIncludes: true });
        const issues = validateGzdoomCrossReferences(graph);
        const dupIssues = issues.filter((i) =>
            i.type === 'gzdoom-duplicate-class' && /ActiveClass/.test(i.description));
        assert.equal(dupIssues.length, 0,
            'Commented-out includes should not pull in duplicate class files');
    });
});
