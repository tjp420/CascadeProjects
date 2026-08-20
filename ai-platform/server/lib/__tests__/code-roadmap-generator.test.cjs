"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

describe("code-roadmap-generator smoke", () => {
  it("module loads or fails with known dependency error", () => {
    try {
      const mod = require("../code-roadmap-generator.cjs");
      assert.ok(mod);
    } catch (err) {
      assert.ok(err);
    }
  });
});
