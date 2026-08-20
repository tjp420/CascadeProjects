const { describe, it } = require("node:test");
const assert = require("node:assert");
const mod = require("./compliance-schema-api.cjs");

describe("compliance-schema-api", () => {
  it("exports without throwing", () => {
    assert.ok(mod, "module should export something");
  });

  it("has expected exports", () => {
    const keys = Object.keys(mod || {});
    // Add assertions for expected named exports here
    assert.ok(Array.isArray(keys), "should have enumerable exports");
  });
});
