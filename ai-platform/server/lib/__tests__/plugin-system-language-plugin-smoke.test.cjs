"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert");

const mod = require("../plugin-system/language-plugin.cjs");

describe("plugin-system-language-plugin smoke", () => {
  it("module loads without throwing", () => {
    assert.ok(mod);
  });
  it("exports at least one function", () => {
    assert.ok(Object.keys(mod).length > 0);
  });
});
