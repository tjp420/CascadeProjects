/**
 * GZDoom CVAR cross-reference lint tests
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
    parseCvarDefinitions,
    parseMenuReferences,
    parseZscriptReferences,
    lintGzdoomCvars
} = require('../src/lib/gzdoom-cvar-lint');

describe('gzdoom cvar lint', () => {
    it('parses CVARINFO definitions', () => {
        const defs = parseCvarDefinitions('user int r3d_mode = 0;\nserver bool r3d_foo = true;', 'CVARINFO');
        assert.equal(defs.length, 2);
        assert.ok(defs.some((d) => d.name === 'r3d_mode'));
    });

    it('parses MENUDEF Option references', () => {
        const refs = parseMenuReferences('Option "Rendering Mode", "r3d_render_mode", "R3DModes"', 'MENUDEF_R3D');
        assert.equal(refs.length, 1);
        assert.equal(refs[0].name, 'r3d_render_mode');
    });

    it('parses ZScript FindCVar references', () => {
        const refs = parseZscriptReferences('CVar c = CVar.FindCVar("r3d_imp_mode");', 'test.zs');
        assert.equal(refs.length, 1);
        assert.equal(refs[0].name, 'r3d_imp_mode');
    });

    it('flags undefined menu CVAR', async () => {
        const tmp = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'sb-cvar-'));
        const fs = require('fs');
        const path = require('path');
        fs.writeFileSync(path.join(tmp, 'CVARINFO'), 'user int r3d_known = 0;\n', 'utf8');
        fs.writeFileSync(path.join(tmp, 'MENUDEF_R3D'), 'Option "X", "r3d_missing_menu", "OnOff"\n', 'utf8');
        const result = await lintGzdoomCvars(tmp, { cvarPrefix: 'r3d_' });
        assert.ok(result.issues.some((i) => i.type === 'gzdoom-cvar-undefined' && /r3d_missing_menu/.test(i.description)));
    });

    it('skips CVARs matching cvarAllowlistPrefixes in undefined, dead, and prefix checks', async () => {
        const tmp = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'sb-cvar-prefixes-'));
        const fs = require('fs');
        const path = require('path');
        fs.writeFileSync(
            path.join(tmp, 'CVARINFO'),
            'user int r3d_dead_option = 0;\nuser int hellfire_health = 100;\n',
            'utf8'
        );
        fs.writeFileSync(path.join(tmp, 'MENUDEF_R3D'), 'Option "X", "r3d_missing_menu", "OnOff"\n', 'utf8');

        const baseline = await lintGzdoomCvars(tmp, { cvarPrefix: 'r3d_' });
        assert.ok(baseline.issues.some((i) => i.type === 'gzdoom-cvar-undefined'));
        assert.ok(baseline.issues.some((i) => i.type === 'gzdoom-cvar-dead'));
        assert.ok(baseline.issues.some((i) => i.type === 'gzdoom-cvar-prefix'));

        const result = await lintGzdoomCvars(tmp, {
            cvarPrefix: 'r3d_',
            cvarAllowlistPrefixes: ['r3d_missing', 'r3d_dead_', 'hellfire_']
        });
        assert.equal(result.issues.length, 0);
    });

    it('flags non-r3d_ CVAR definitions as prefix violations', async () => {
        const tmp = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'sb-cvar2-'));
        const fs = require('fs');
        const path = require('path');
        fs.writeFileSync(path.join(tmp, 'CVARINFO'), 'user int hellfire_health = 100;\n', 'utf8');
        const result = await lintGzdoomCvars(tmp, { cvarPrefix: 'r3d_' });
        assert.ok(result.issues.some((i) => i.type === 'gzdoom-cvar-prefix'));
    });
});
