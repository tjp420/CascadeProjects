/**
 * V2 ground-truth expansion — measurement only.
 * Unsupported Verified must be 0. Recall misses are recorded, not fixed.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  runVerificationFunnelBenchmarkV2,
  formatHumanReportV2,
  LABELS_V2_PATH,
  FIXTURE_ROOT,
} = require("../src/lib/verification-funnel-benchmark");

describe("verification-funnel-benchmark v2", () => {
  test("labels.v2.json exists with expanded ground truth", () => {
    assert.ok(fs.existsSync(LABELS_V2_PATH), LABELS_V2_PATH);
    const labels = JSON.parse(fs.readFileSync(LABELS_V2_PATH, "utf8"));
    assert.equal(labels.benchmark, "verification-funnel-v2");
    assert.ok(labels.groundTruth.length >= 6);
    for (const gt of labels.groundTruth) {
      assert.ok(gt.id);
      assert.equal(gt.expectVerified, true);
      assert.ok(gt.evidence?.links?.length >= 1);
      const root = path.resolve(
        FIXTURE_ROOT,
        "..",
        "..",
        gt.root.replace(/^fixtures\//, "fixtures/"),
      );
      // roots are relative to package root
      const pkgRoot = path.resolve(__dirname, "..");
      const source = path.join(pkgRoot, gt.root, gt.sourceFile);
      assert.ok(fs.existsSync(source), source);
    }
  });

  test("V2 run: unsupported Verified is 0; misses recorded without fixing verifier", () => {
    const report = runVerificationFunnelBenchmarkV2();
    assert.equal(report.benchmark, "verification-funnel-v2");
    assert.equal(report.verifierUnchanged, true);
    assert.equal(report.groundTruth.unsupportedVerified, 0);
    assert.equal(report.pass, true);
    assert.ok(report.groundTruth.knownVulnerabilities >= 6);
    assert.ok(
      report.groundTruth.verifiedBySimpleBeacon <=
        report.groundTruth.knownVulnerabilities,
    );
    const text = formatHumanReportV2(report);
    assert.match(text, /GROUND TRUTH → VERIFIED → MISSED/);
    assert.match(text, /Unsupported Verified/);
  });
});
