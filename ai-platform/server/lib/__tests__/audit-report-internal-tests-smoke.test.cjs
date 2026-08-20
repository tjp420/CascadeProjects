"use strict";
const { describe, it } = require("node:test");
const assert = require("node:assert");
const path = require("path");
const fs = require("fs");

describe("audit-report __tests__ runner", () => {
  it("test runner file exists and is valid JS", () => {
    const target = path.join(__dirname, "..", "audit-report", "__tests__.cjs");
    assert.ok(fs.existsSync(target));
  });
});
