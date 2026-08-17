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
    parseStateFrames
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
