/**
 * GZDoom CVAR cross-reference lint tests
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  parseCvarDefinitions,
  parseMenuReferences,
  parseZscriptReferences,
  lintGzdoomCvars,
} = require("../src/lib/gzdoom-cvar-lint");

describe("gzdoom cvar lint", () => {
  it("parses CVARINFO definitions", () => {
    const defs = parseCvarDefinitions(
      "user int r3d_mode = 0;\nserver bool r3d_foo = true;",
      "CVARINFO",
    );
    assert.equal(defs.length, 2);
    assert.ok(defs.some((d) => d.name === "r3d_mode"));
  });

  it("parses MENUDEF Option references", () => {
    const refs = parseMenuReferences(
      'Option "Rendering Mode", "r3d_render_mode", "R3DModes"',
      "MENUDEF_R3D",
    );
    assert.equal(refs.length, 1);
    assert.equal(refs[0].name, "r3d_render_mode");
  });

  it("parses ZScript FindCVar references", () => {
    const refs = parseZscriptReferences(
      'CVar c = CVar.FindCVar("r3d_imp_mode");',
      "test.zs",
    );
    assert.equal(refs.length, 1);
    assert.equal(refs[0].name, "r3d_imp_mode");
  });

  it("flags undefined menu CVAR", async () => {
    const tmp = require("fs").mkdtempSync(
      require("path").join(require("os").tmpdir(), "sb-cvar-"),
    );
    const fs = require("fs");
    const path = require("path");
    fs.writeFileSync(
      path.join(tmp, "CVARINFO"),
      "user int r3d_known = 0;\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(tmp, "MENUDEF_R3D"),
      'Option "X", "r3d_missing_menu", "OnOff"\n',
      "utf8",
    );
    const result = await lintGzdoomCvars(tmp, { cvarPrefix: "r3d_" });
    assert.ok(
      result.issues.some(
        (i) =>
          i.type === "gzdoom-cvar-undefined" &&
          /r3d_missing_menu/.test(i.description),
      ),
    );
  });

  it("flags non-r3d_ CVAR definitions as prefix violations", async () => {
    const tmp = require("fs").mkdtempSync(
      require("path").join(require("os").tmpdir(), "sb-cvar2-"),
    );
    const fs = require("fs");
    const path = require("path");
    fs.writeFileSync(
      path.join(tmp, "CVARINFO"),
      "user int hellfire_health = 100;\n",
      "utf8",
    );
    const result = await lintGzdoomCvars(tmp, { cvarPrefix: "r3d_" });
    assert.ok(result.issues.some((i) => i.type === "gzdoom-cvar-prefix"));
  });

  it("does NOT flag MENUDEF Command entries as undefined CVARs", () => {
    // Command entries execute console command aliases (CCMDs), not CVARs.
    // sky_day and music_fix are KEYCONF aliases, not CVARs.
    const refs = parseMenuReferences(
      'Command "Day Sky", "sky_day"\nCommand "Fix Music", "music_fix"',
      "MENUDEF_R3D",
    );
    assert.equal(
      refs.length,
      0,
      "Command entries should not produce CVAR references",
    );
  });

  it("does flag MENUDEF Option and Slider entries as CVAR references", () => {
    const refs = parseMenuReferences(
      'Option "Enable Glow", "r3d_weapon_glow_enabled", "OnOff"\n' +
        'Slider "Glow Intensity", "r3d_weapon_glow_intensity", 0.0, 10.0, 0.1',
      "MENUDEF_R3D",
    );
    assert.equal(refs.length, 2);
    assert.ok(refs.some((r) => r.name === "r3d_weapon_glow_enabled"));
    assert.ok(refs.some((r) => r.name === "r3d_weapon_glow_intensity"));
  });

  it("accepts GZDoom built-in engine CVARs without CVARINFO definitions", async () => {
    const tmp = require("fs").mkdtempSync(
      require("path").join(require("os").tmpdir(), "sb-cvar3-"),
    );
    const fs = require("fs");
    const path = require("path");
    // MENUDEF references r_models and r_drawvoxels (engine built-ins)
    // but CVARINFO doesn't define them — they should NOT be flagged.
    fs.writeFileSync(
      path.join(tmp, "CVARINFO"),
      "user int r3d_custom = 0;\n",
      "utf8",
    );
    fs.writeFileSync(
      path.join(tmp, "MENUDEF_R3D"),
      'Option "Models", "r_models", "OnOff"\n' +
        'Option "Voxels", "r_drawvoxels", "OnOff"\n' +
        'Option "Dynamic Lights", "r_dynamiclights", "OnOff"\n',
      "utf8",
    );
    const result = await lintGzdoomCvars(tmp, { cvarPrefix: "r3d_" });
    const undefinedIssues = result.issues.filter(
      (i) => i.type === "gzdoom-cvar-undefined",
    );
    assert.ok(
      !undefinedIssues.some((i) => /r_models/.test(i.description)),
      "r_models is a built-in engine CVAR and should not be flagged",
    );
    assert.ok(
      !undefinedIssues.some((i) => /r_drawvoxels/.test(i.description)),
      "r_drawvoxels is a built-in engine CVAR and should not be flagged",
    );
    assert.ok(
      !undefinedIssues.some((i) => /r_dynamiclights/.test(i.description)),
      "r_dynamiclights is a built-in engine CVAR and should not be flagged",
    );
  });
});
