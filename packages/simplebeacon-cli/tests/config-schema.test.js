/**
 * Tests for config-schema.js scanners and allowlist validation.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert");
const { validateConfig } = require("../src/config-schema");

describe("validateConfig — scanners", () => {
  it("allows valid scanner config", () => {
    const result = validateConfig({
      scanners: {
        credential_leak: { enabled: true, action: "BLOCK", severity: "high" },
        hallucinated_urls: { enabled: true, action: "WARN" },
      },
    });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it("warns on invalid scanner action", () => {
    const result = validateConfig({
      scanners: { credential_leak: { action: "INVALID" } },
    });
    assert.strictEqual(result.valid, true); // not an error, just a warning
    assert(result.warnings.some((w) => w.includes("invalid action")));
  });

  it("warns on invalid scanner severity", () => {
    const result = validateConfig({
      scanners: { credential_leak: { severity: "critical-plus" } },
    });
    assert(result.warnings.some((w) => w.includes("invalid severity")));
  });
});

describe("validateConfig — allowlist", () => {
  it("allows valid allowlist array", () => {
    const result = validateConfig({
      allowlist: ["internal.local", "://company.com"],
    });
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.errors.length, 0);
  });

  it("errors when allowlist is not an array", () => {
    const result = validateConfig({ allowlist: "not-an-array" });
    assert.strictEqual(result.valid, false);
    assert(result.errors.some((e) => e.includes("allowlist must be an array")));
  });

  it("errors on empty allowlist entries", () => {
    const result = validateConfig({ allowlist: ["valid", ""] });
    assert.strictEqual(result.valid, false);
    assert(result.errors.some((e) => e.includes("non-empty strings")));
  });
});

describe("validateConfig — legacy rules still work", () => {
  it("validates standard profile config", () => {
    const result = validateConfig({
      profile: "standard",
      scanPaths: ["."],
      rules: { credentials: { enabled: true, severity: "high" } },
    });
    assert.strictEqual(result.valid, true);
  });
});
