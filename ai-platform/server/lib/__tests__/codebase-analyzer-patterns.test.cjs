"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const mod = require("../codebase-analyzer-patterns.cjs");

describe("codebase-analyzer-patterns smoke", () => {
  it("module loads without throwing", () => {
    assert.ok(mod);
  });

  it("exports frozen pattern arrays", () => {
    assert.ok(Array.isArray(mod.TECH_DEBT_PATTERNS));
    assert.ok(Array.isArray(mod.PLACEHOLDER_PATTERNS));
    assert.ok(Array.isArray(mod.AI_RESIDUE_PATTERNS));
    assert.ok(Array.isArray(mod.LLM_SLOP_PATTERNS));
  });

  it("patterns have id and label", () => {
    for (const p of mod.TECH_DEBT_PATTERNS) {
      assert.ok(p.id, "pattern should have id");
      assert.ok(p.label, "pattern should have label");
    }
  });
});
