/**
 * GZDoom state lint — death-frame reuse detection.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const {
    lintZScriptDeathFrameReuse,
    lintGzdoomDeathFrameReuse,
    parseStateFrames,
    is3DVariantClass,
    lintStatesBlock
} = require('../src/lib/gzdoom-state-lint');

const FIXTURE = path.join(__dirname, 'fixtures', 'gzdoom-death-frame', 'revenant_model_variants.zs');
const BUGGY = fs.readFileSync(FIXTURE, 'utf8');

describe('gzdoom death-frame reuse lint', () => {
    it('parses labeled state frames from a States block', () => {
        const body = BUGGY.slice(BUGGY.indexOf('States') + 'States'.length);
        const open = body.indexOf('{');
        const close = body.indexOf('\n}', open);
        const statesBody = body.slice(open + 1, close);
        const byLabel = parseStateFrames(statesBody, 4);
        assert.ok(byLabel.has('Missile'));
        assert.ok(byLabel.has('Death'));
        const missileM = byLabel.get('Missile').filter((f) => f.frame === 'M' && f.sprite === 'RSKN');
        assert.equal(missileM.length, 1);
    });

    it('flags RSKN K/L/M shared between Missile/Melee and Death in buggy Revenant fixture', () => {
        const issues = lintZScriptDeathFrameReuse(BUGGY, 'zscript/monsters/Demons/Revenant/revenant_model_variants.zs');
        assert.ok(issues.length >= 6, `expected >=6 issues, got ${issues.length}`);
        assert.ok(issues.every((i) => i.type === 'gzdoom-death-frame-reuse'));
        const combat = issues.filter((i) => i.severity === 'high');
        assert.ok(combat.length >= 6, `expected >=6 high/combat issues, got ${combat.length}`);
        assert.ok(combat.some((i) =>
            i.metadata.sprite === 'RSKN' &&
            i.metadata.frame === 'M' &&
            i.metadata.otherState === 'Missile' &&
            /3D model/.test(i.description)
        ));
        assert.ok(combat.some((i) =>
            i.metadata.frame === 'K' &&
            i.metadata.otherState === 'Melee'
        ));
    });

    it('does not flag fixed Revenant when attack frames E/F/G are disjoint from death', () => {
        const fixedOnly = BUGGY.split('class R3DRevenantModelFixed')[1];
        const issues = lintZScriptDeathFrameReuse(fixedOnly, 'fixed.zs');
        assert.equal(issues.length, 0);
    });

    it('scans fixture directory via lintGzdoomDeathFrameReuse', async () => {
        const result = await lintGzdoomDeathFrameReuse(path.join(__dirname, 'fixtures', 'gzdoom-death-frame'), {
            respectIncludes: false
        });
        assert.ok(result.scanned >= 1);
        assert.ok(result.findings >= 6);
    });
});

describe('is3DVariantClass', () => {
    it('identifies 3D model variant classes', () => {
        assert.ok(is3DVariantClass('R3DRevenantModel1'));
        assert.ok(is3DVariantClass('Pure3DRevenantBase'));
        assert.ok(is3DVariantClass('PureVoxelArchvileBase'));
        assert.ok(is3DVariantClass('R3DCacodemonModel1'));
        assert.ok(is3DVariantClass('R3DLostSoulVoxel1'));
    });

    it('does NOT identify sprite-only or render-parity classes as 3D variants', () => {
        assert.ok(!is3DVariantClass('R3DRevenantSprite1'));
        assert.ok(!is3DVariantClass('ArchvileRenderParity'));
        assert.ok(!is3DVariantClass('CacodemonSpriteVariants'));
        assert.ok(!is3DVariantClass('ImpRenderParity'));
    });
});

describe('death-frame reuse 3D variant filter', () => {
    it('flags death-frame reuse in 3D model variant classes', () => {
        const statesBody = `
Death:
  VILE Q 5;
  VILE R 5;
  Stop;
Missile:
  VILE Q 5;
  VILE S 5;
`;
        const issues = lintStatesBlock('Pure3DArchvileBase', 'test.zs', statesBody, 1, 'high');
        assert.ok(issues.length > 0, 'Should flag death-frame reuse in 3D model class');
    });

    it('does NOT flag death-frame reuse in sprite-only variant classes', () => {
        const statesBody = `
Death:
  VILE Q 5;
  VILE R 5;
  Stop;
Missile:
  VILE Q 5;
  VILE S 5;
`;
        const issues = lintStatesBlock('ArchvileSpriteVariants', 'test.zs', statesBody, 1, 'high');
        assert.equal(issues.length, 0, 'Should NOT flag sprite-only variant (vanilla behavior)');
    });

    it('does NOT flag death-frame reuse in RenderParity classes', () => {
        const statesBody = `
Death:
  HEAD G 5;
  Stop;
Pain:
  HEAD G 5;
`;
        const issues = lintStatesBlock('CacodemonRenderParity', 'test.zs', statesBody, 1, 'high');
        assert.equal(issues.length, 0, 'Should NOT flag RenderParity class');
    });
});
