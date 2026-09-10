/**
 * V4 out-of-sample — measurement only.
 * V3 control must remain PASS. Perfect OOS recall is NOT required.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  runVerificationFunnelBenchmarkV4,
  formatHumanReportV4,
  LABELS_V4_PATH,
  V3_CONTROL_COMMIT,
} = require("../src/lib/verification-funnel-benchmark");

describe("verification-funnel-benchmark v4", () => {
  test("labels.v4.json is out-of-sample and does not overwrite V3", () => {
    assert.ok(fs.existsSync(LABELS_V4_PATH), LABELS_V4_PATH);
    const labels = JSON.parse(fs.readFileSync(LABELS_V4_PATH, "utf8"));
    assert.equal(labels.benchmark, "verification-funnel-v4");
    assert.equal(labels.outOfSample, true);
    assert.equal(labels.v3ControlCommit, V3_CONTROL_COMMIT);
    assert.ok(!labels.inheritsGroundTruthFrom);
    assert.ok((labels.groundTruth || []).length >= 5);
    assert.ok((labels.hardNegatives || []).length >= 8);
    const pkgRoot = path.resolve(__dirname, "..");
    const v3Labels = path.join(pkgRoot, "fixtures/benchmark/labels.v3.json");
    assert.ok(fs.existsSync(v3Labels));
    for (const gt of labels.groundTruth) {
      const source = path.join(pkgRoot, gt.root, gt.sourceFile);
      assert.ok(fs.existsSync(source), source);
      assert.ok(
        String(gt.root).includes("corpus/v4"),
        "OOS positives must live under corpus/v4",
      );
    }
  });

  test("V4 run: measures OOS + V3 regression; hard gate may fail honestly", () => {
    const report = runVerificationFunnelBenchmarkV4();
    assert.equal(report.benchmark, "verification-funnel-v4");
    assert.equal(report.verifierUnchanged, true);
    assert.equal(report.outOfSample, true);
    assert.equal(report.v3Regression.pass, true);
    assert.equal(
      report.v3Regression.controlCommit,
      V3_CONTROL_COMMIT,
    );
    assert.ok(report.groundTruth.knownVulnerabilities >= 5);
    assert.ok(report.groundTruth.perClass);
    assert.ok(Array.isArray(report.groundTruth.failureAnalysis));
    assert.ok(typeof report.pass === "boolean");
    // Hard gate: unsupported Verified must be counted; do not assert pass —
    // V4 exists to surface generalization failures without retuning the verifier.
    assert.ok(
      report.groundTruth.verifiedBySimpleBeacon <=
        report.groundTruth.knownVulnerabilities,
    );
    const text = formatHumanReportV4(report);
    assert.match(text, /OUT-OF-SAMPLE/);
    assert.match(text, /V3 REGRESSION/);
    assert.match(text, /Perfect out-of-sample recall is NOT required/);
  });
});
