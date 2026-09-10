/**
 * V3 diversity + hard negatives — measurement only.
 * Unsupported Verified must be 0. Perfect recall is NOT required for pass.
 * Verifier must remain unchanged.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  runVerificationFunnelBenchmarkV3,
  formatHumanReportV3,
  LABELS_V3_PATH,
} = require("../src/lib/verification-funnel-benchmark");

describe("verification-funnel-benchmark v3", () => {
  test("labels.v3.json exists with diversity + hard negatives", () => {
    assert.ok(fs.existsSync(LABELS_V3_PATH), LABELS_V3_PATH);
    const labels = JSON.parse(fs.readFileSync(LABELS_V3_PATH, "utf8"));
    assert.equal(labels.benchmark, "verification-funnel-v3");
    assert.equal(labels.inheritsGroundTruthFrom, "labels.v2.json");
    assert.ok((labels.groundTruth || []).length >= 4);
    assert.ok((labels.hardNegatives || []).length >= 6);
    const pkgRoot = path.resolve(__dirname, "..");
    for (const gt of labels.groundTruth) {
      assert.ok(gt.id);
      assert.equal(gt.expectVerified, true);
      const source = path.join(pkgRoot, gt.root, gt.sourceFile);
      assert.ok(fs.existsSync(source), source);
    }
    for (const hn of labels.hardNegatives) {
      assert.equal(hn.expectVerified, false);
      if (hn.fixture) {
        assert.ok(fs.existsSync(path.join(pkgRoot, hn.fixture)), hn.fixture);
      } else {
        const source = path.join(pkgRoot, hn.root, hn.sourceFile);
        assert.ok(fs.existsSync(source), source);
      }
    }
  });

  test("V3 run: unsupported Verified is 0; hard negatives rejected; misses allowed", () => {
    const report = runVerificationFunnelBenchmarkV3();
    assert.equal(report.benchmark, "verification-funnel-v3");
    assert.equal(report.verifierUnchanged, true);
    assert.equal(report.groundTruth.unsupportedVerified, 0);
    assert.equal(report.groundTruth.hardNegatives.wronglyVerified.length, 0);
    assert.equal(report.pass, true);
    assert.ok(report.groundTruth.knownVulnerabilities >= 10);
    assert.ok(
      report.groundTruth.verifiedBySimpleBeacon <=
        report.groundTruth.knownVulnerabilities,
    );
    assert.ok(report.groundTruth.hardNegatives.total >= 6);
    const text = formatHumanReportV3(report);
    assert.match(text, /HARD NEGATIVES/);
    assert.match(text, /Perfect recall is NOT required/);
  });
});
