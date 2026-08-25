/**
 * Tests for scan-usage-tracker.js local quota counter.
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");

const {
  readUsage,
  writeUsage,
  checkLocalScanQuota,
  incrementLocalScan,
  incrementPipelineScan,
  isPipelineScan,
  resetPeriodIfNeeded,
  USAGE_FILE,
} = require("../src/lib/scan-usage-tracker");

describe("scan-usage-tracker", () => {
  beforeEach(() => {
    try {
      fs.unlinkSync(USAGE_FILE);
    } catch {
      // file may not exist
    }
  });

  it("reads default usage when file does not exist", () => {
    const usage = readUsage();
    assert.strictEqual(usage.localScans, 0);
    assert.strictEqual(usage.pipelineScans, 0);
    assert.strictEqual(usage.tier, "developer");
  });

  it("increments local scan count", () => {
    const usage = incrementLocalScan("developer");
    assert.strictEqual(usage.localScans, 1);
    assert.strictEqual(usage.tier, "developer");
  });

  it("increments pipeline scan count for pro tier", () => {
    const usage = incrementPipelineScan("pro");
    assert.strictEqual(usage.pipelineScans, 1);
    assert.strictEqual(usage.tier, "pro");
  });

  it("increments pipeline scan count for legacy startup alias", () => {
    const usage = incrementPipelineScan("startup");
    assert.strictEqual(usage.pipelineScans, 1);
    assert.strictEqual(usage.tier, "startup");
  });

  it("allows scan when under quota", () => {
    const result = checkLocalScanQuota({ maxScansPerPeriod: 100 });
    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.quota, 100);
  });

  it("blocks scan when quota exceeded", () => {
    for (let i = 0; i < 100; i++) {
      incrementLocalScan("developer");
    }
    const result = checkLocalScanQuota({ maxScansPerPeriod: 100 });
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.reason, "scan_quota_exceeded");
    assert.strictEqual(result.scansRemaining, 0);
  });

  it("detects pipeline environment from CI vars", () => {
    const ciVars = [
      "CI",
      "GITHUB_ACTIONS",
      "GITLAB_CI",
      "CIRCLECI",
      "TRAVIS",
      "JENKINS_URL",
    ];
    const saved = {};
    for (const v of ciVars) {
      saved[v] = process.env[v];
      delete process.env[v];
    }
    try {
      assert.strictEqual(isPipelineScan(), false);
      process.env.GITHUB_ACTIONS = "true";
      assert.strictEqual(isPipelineScan(), true);
      delete process.env.GITHUB_ACTIONS;
      assert.strictEqual(isPipelineScan(), false);
    } finally {
      for (const v of ciVars) {
        if (saved[v] !== undefined) process.env[v] = saved[v];
      }
    }
  });

  it("resets period when older than 30 days", () => {
    const oldUsage = {
      periodStart: new Date(
        Date.now() - 31 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      localScans: 99,
      pipelineScans: 50,
      tier: "startup",
    };
    writeUsage(oldUsage);
    const reset = resetPeriodIfNeeded(readUsage());
    assert.strictEqual(reset.localScans, 0);
    assert.strictEqual(reset.pipelineScans, 0);
  });
});
