"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");

const STORE_DIR = path.join(os.tmpdir(), `sb-perf-test-${Date.now()}`);
const STORE_PATH = path.join(STORE_DIR, "usage-analytics.json");

process.env.USAGE_ANALYTICS_STORE_PATH = STORE_PATH;

describe("getScanPerformanceStats", () => {
  let analyticsStore;

  beforeEach(() => {
    if (fs.existsSync(STORE_PATH)) fs.unlinkSync(STORE_PATH);
    delete require.cache[
      require.resolve("../lib/usage-analytics-store.cjs")
    ];
    analyticsStore = require("../lib/usage-analytics-store.cjs");
  });

  afterEach(() => {
    if (fs.existsSync(STORE_DIR)) {
      try {
        fs.rmSync(STORE_DIR, { recursive: true });
      } catch (_) {}
    }
  });

  it("returns zero stats when no scans exist", () => {
    const perf = analyticsStore.getScanPerformanceStats();
    assert.strictEqual(perf.totalScans, 0);
    assert.strictEqual(perf.successCount, 0);
    assert.strictEqual(perf.errorCount, 0);
    assert.strictEqual(perf.successRate, 0);
    assert.strictEqual(perf.durationMs.median, 0);
    assert.strictEqual(perf.throughputFilesPerSecond, 0);
  });

  it("calculates total scans and success rate", () => {
    analyticsStore.recordScan({
      orgId: "org1",
      projectPath: "/test",
      summary: { codeFilesAnalyzed: 100, totalFindings: 5, severityCounts: {} },
      scanDurationMs: 5000,
      gateStatus: "pass",
    });
    analyticsStore.recordScan({
      orgId: "org1",
      projectPath: "/test",
      summary: { codeFilesAnalyzed: 200, totalFindings: 0, severityCounts: {} },
      scanDurationMs: 3000,
      gateStatus: "pass",
    });

    const perf = analyticsStore.getScanPerformanceStats();
    assert.strictEqual(perf.totalScans, 2);
    assert.strictEqual(perf.successCount, 2);
    assert.strictEqual(perf.successRate, 100);
    assert.strictEqual(perf.errorCount, 0);
  });

  it("calculates duration percentiles correctly", () => {
    for (let i = 1; i <= 10; i++) {
      analyticsStore.recordScan({
        orgId: "org1",
        projectPath: "/test",
        summary: { codeFilesAnalyzed: 10, totalFindings: 0, severityCounts: {} },
        scanDurationMs: i * 1000, // 1s, 2s, ..., 10s
        gateStatus: "pass",
      });
    }

    const perf = analyticsStore.getScanPerformanceStats();
    assert.strictEqual(perf.durationMs.min, 1000);
    assert.strictEqual(perf.durationMs.max, 10000);
    assert.ok(perf.durationMs.median >= 5000 && perf.durationMs.median <= 6000);
    assert.ok(perf.durationMs.p90 >= 9000);
    assert.ok(perf.durationMs.avg > 0);
  });

  it("calculates gate pass rate", () => {
    analyticsStore.recordScan({
      orgId: "org1",
      projectPath: "/test",
      summary: { codeFilesAnalyzed: 10, totalFindings: 0, severityCounts: {} },
      gateStatus: "pass",
    });
    analyticsStore.recordScan({
      orgId: "org1",
      projectPath: "/test",
      summary: { codeFilesAnalyzed: 10, totalFindings: 5, severityCounts: {} },
      gateStatus: "fail",
    });
    analyticsStore.recordScan({
      orgId: "org1",
      projectPath: "/test",
      summary: { codeFilesAnalyzed: 10, totalFindings: 0, severityCounts: {} },
      gateStatus: "pass",
    });

    const perf = analyticsStore.getScanPerformanceStats();
    assert.strictEqual(perf.gatePassCount, 2);
    assert.strictEqual(perf.gateFailCount, 1);
    assert.ok(perf.gatePassRate > 60 && perf.gatePassRate < 70);
  });

  it("calculates throughput (files per second)", () => {
    analyticsStore.recordScan({
      orgId: "org1",
      projectPath: "/test",
      summary: { codeFilesAnalyzed: 1000, totalFindings: 0, severityCounts: {} },
      scanDurationMs: 10000, // 10 seconds
    });

    const perf = analyticsStore.getScanPerformanceStats();
    assert.strictEqual(perf.totalFilesAnalyzed, 1000);
    assert.ok(perf.throughputFilesPerSecond > 0);
    // 1000 files / 10 seconds = 100 files/sec
    assert.strictEqual(perf.throughputFilesPerSecond, 100);
  });

  it("filters by orgId", () => {
    analyticsStore.recordScan({
      orgId: "org-a",
      projectPath: "/test",
      summary: { codeFilesAnalyzed: 10, totalFindings: 0, severityCounts: {} },
      scanDurationMs: 1000,
    });
    analyticsStore.recordScan({
      orgId: "org-b",
      projectPath: "/test",
      summary: { codeFilesAnalyzed: 20, totalFindings: 0, severityCounts: {} },
      scanDurationMs: 2000,
    });

    const perf = analyticsStore.getScanPerformanceStats({ orgId: "org-a" });
    assert.strictEqual(perf.totalScans, 1);
    assert.strictEqual(perf.totalFilesAnalyzed, 10);
  });

  it("filters by date range", () => {
    analyticsStore.recordScan({
      orgId: "org1",
      projectPath: "/test",
      summary: { codeFilesAnalyzed: 10, totalFindings: 0, severityCounts: {} },
      scanDurationMs: 1000,
    });

    // Filter to a future date range — should return zero
    const future = new Date(Date.now() + 86400000).toISOString();
    const perf = analyticsStore.getScanPerformanceStats({
      startDate: future,
    });
    assert.strictEqual(perf.totalScans, 0);
  });

  it("includes time range (first and last scan timestamps)", () => {
    analyticsStore.recordScan({
      orgId: "org1",
      projectPath: "/test",
      summary: { codeFilesAnalyzed: 10, totalFindings: 0, severityCounts: {} },
      scanDurationMs: 1000,
    });

    const perf = analyticsStore.getScanPerformanceStats();
    assert.ok(perf.timeRange.firstScanAt);
    assert.ok(perf.timeRange.lastScanAt);
  });

  it("calculates files-per-scan stats", () => {
    analyticsStore.recordScan({
      orgId: "org1",
      projectPath: "/test",
      summary: { codeFilesAnalyzed: 100, totalFindings: 0, severityCounts: {} },
    });
    analyticsStore.recordScan({
      orgId: "org1",
      projectPath: "/test",
      summary: { codeFilesAnalyzed: 500, totalFindings: 0, severityCounts: {} },
    });

    const perf = analyticsStore.getScanPerformanceStats();
    assert.strictEqual(perf.filesPerScan.min, 100);
    assert.strictEqual(perf.filesPerScan.max, 500);
    assert.ok(perf.filesPerScan.avg > 0);
  });
});
