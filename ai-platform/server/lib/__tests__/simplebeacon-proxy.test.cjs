/**
 * Unit tests for simplebeacon-proxy.cjs
 * Run with: node --test __tests__/simplebeacon-proxy.test.cjs
 */

const assert = require("assert");
const { describe, it } = require("node:test");

const proxy = require("../simplebeacon-proxy.cjs");

describe("simplebeacon-proxy", () => {
  it("exports a frozen object", () => {
    assert.strictEqual(Object.isFrozen(proxy), true);
  });

  it("has version or version undefined", () => {
    assert.ok(proxy.version === undefined || typeof proxy.version === "string");
  });

  it("exposes scan functions", () => {
    assert.strictEqual(typeof proxy.runScan, "function");
    assert.strictEqual(typeof proxy.evaluateGate, "function");
    assert.strictEqual(typeof proxy.runFileReductionScan, "function");
  });

  it("exposes reporter functions", () => {
    assert.strictEqual(typeof proxy.formatJsonReport, "function");
    assert.strictEqual(typeof proxy.buildAssessmentReport, "function");
    assert.strictEqual(typeof proxy.compileAuditReportMarkdown, "function");
  });

  it("exposes sanitizer functions", () => {
    assert.strictEqual(typeof proxy.sanitizeScanReport, "function");
    assert.strictEqual(typeof proxy.redactProjectPathForExport, "function");
    assert.strictEqual(typeof proxy.sanitizeCompleteScanExport, "function");
  });

  it("exposes config constants", () => {
    assert.ok(Array.isArray(proxy.DEFAULT_MOCK_SCAN_RELATIVE_PATHS));
    assert.strictEqual(typeof proxy.DEFAULT_CONFIG, "object");
    assert.strictEqual(typeof proxy.PROFILE_RULES, "object");
    assert.ok(proxy.PROFILE_RULES.standard);
  });

  it("exposes EU AI Act helpers", () => {
    assert.strictEqual(typeof proxy.evaluateEuExportEligibility, "function");
    assert.strictEqual(typeof proxy.isLegalReviewAttestation, "function");
    assert.strictEqual(typeof proxy.DEFAULT_MAX_STALE_MS, "number");
  });

  it("exposes project detection functions", () => {
    assert.strictEqual(typeof proxy.detectProjectProfile, "function");
    assert.strictEqual(typeof proxy.resolvePlatformRoot, "function");
  });

  it("exposes deep-path helpers not in CLI index", () => {
    assert.strictEqual(typeof proxy.isExternalBenchmarkCachePath, "function");
    assert.strictEqual(typeof proxy.resolveScanProgressPath, "function");
    assert.strictEqual(typeof proxy.readScanProgress, "function");
    assert.strictEqual(typeof proxy.verifyLicenseToken, "function");
    assert.strictEqual(typeof proxy.sanitizeComplianceBundleExport, "function");
    assert.strictEqual(typeof proxy.buildAuditPayload, "function");
  });

  it("exposes consolidation helpers", () => {
    assert.strictEqual(typeof proxy.isConsolidationExcludedPair, "function");
    assert.strictEqual(
      typeof proxy.consolidationCandidateTouchesExcluded,
      "function",
    );
    assert.strictEqual(typeof proxy.countIntentionalPairExclusions, "function");
  });

  it("no export is undefined", () => {
    for (const [key, value] of Object.entries(proxy)) {
      assert.notStrictEqual(value, undefined, `export "${key}" is undefined`);
    }
  });

  it("enrichCleanupReport passes through objects", () => {
    const input = { foo: "bar" };
    assert.deepStrictEqual(proxy.enrichCleanupReport(input), input);
  });

  it("enrichCleanupReport returns empty object for invalid input", () => {
    assert.deepStrictEqual(proxy.enrichCleanupReport(null), {});
    assert.deepStrictEqual(proxy.enrichCleanupReport("string"), {});
    assert.deepStrictEqual(proxy.enrichCleanupReport([1, 2]), {});
  });

  it("compactDataCleanupReportForClient passes through objects", () => {
    const input = { baz: 1 };
    assert.deepStrictEqual(
      proxy.compactDataCleanupReportForClient(input),
      input,
    );
  });

  it("compactDataCleanupReportForClient returns empty object for invalid input", () => {
    assert.deepStrictEqual(
      proxy.compactDataCleanupReportForClient(undefined),
      {},
    );
    assert.deepStrictEqual(proxy.compactDataCleanupReportForClient(42), {});
  });

  it("syncMeasuredBaseline throws on invalid baseDir", () => {
    assert.throws(
      () => proxy.syncMeasuredBaseline(null),
      /baseDir must be a non-empty string/,
    );
    assert.throws(
      () => proxy.syncMeasuredBaseline(""),
      /baseDir must be a non-empty string/,
    );
    assert.throws(
      () => proxy.syncMeasuredBaseline(123),
      /baseDir must be a non-empty string/,
    );
  });
});
