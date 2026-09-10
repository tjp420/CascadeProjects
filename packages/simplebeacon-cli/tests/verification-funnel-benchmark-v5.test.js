/**
 * V5 candidate release validation — fresh OOS + V3/V4 regressions.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  runVerificationFunnelBenchmarkV5,
  formatHumanReportV5,
  LABELS_V5_PATH,
  V3_CONTROL_COMMIT,
  V4_DIAGNOSTIC_COMMIT,
} = require("../src/lib/verification-funnel-benchmark");

describe("verification-funnel-benchmark v5", () => {
  test("labels.v5.json is fresh OOS under corpus/v5", () => {
    assert.ok(fs.existsSync(LABELS_V5_PATH));
    const labels = JSON.parse(fs.readFileSync(LABELS_V5_PATH, "utf8"));
    assert.equal(labels.benchmark, "verification-funnel-v5");
    assert.equal(labels.outOfSample, true);
    assert.equal(labels.v3ControlCommit, V3_CONTROL_COMMIT);
    assert.equal(labels.v4DiagnosticCommit, V4_DIAGNOSTIC_COMMIT);
    assert.ok(!labels.inheritsGroundTruthFrom);
    const pkgRoot = path.resolve(__dirname, "..");
    for (const gt of labels.groundTruth) {
      assert.ok(String(gt.root).includes("corpus/v5"));
      assert.ok(fs.existsSync(path.join(pkgRoot, gt.root, gt.sourceFile)));
    }
  });

  test("V5 hard gate: unsupported=0, hard-negs rejected, V3+V4 regressions PASS", () => {
    const report = runVerificationFunnelBenchmarkV5();
    assert.equal(report.benchmark, "verification-funnel-v5");
    assert.equal(report.groundTruth.unsupportedVerified, 0);
    assert.equal(report.groundTruth.hardNegatives.wronglyVerified.length, 0);
    assert.equal(report.v3Regression.pass, true);
    assert.equal(report.v4Regression.pass, true);
    assert.equal(report.pass, true);
    assert.ok(report.groundTruth.knownVulnerabilities >= 5);
    const text = formatHumanReportV5(report);
    assert.match(text, /REGRESSIONS/);
    assert.match(text, /Hard gate/);
  });
});
