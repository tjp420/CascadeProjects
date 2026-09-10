/**
 * Verification funnel benchmark v1 contract.
 *
 * Acceptance: maximize verified recall subject to zero unsupported promotion.
 * Dismissed counts are informational only.
 */
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  runVerificationFunnelBenchmark,
  formatHumanReport,
  measureProductionFunnel,
  FIXTURE_ROOT,
  LABELS_PATH,
  BENCHMARK_ID,
} = require("../src/lib/verification-funnel-benchmark");
const { compileGateStatus } = require("../src/scan");

describe("verification-funnel-benchmark v1", () => {
  test("labels + fixtures exist", () => {
    assert.ok(fs.existsSync(LABELS_PATH), LABELS_PATH);
    assert.ok(fs.existsSync(FIXTURE_ROOT));
    assert.ok(
      fs.existsSync(path.join(FIXTURE_ROOT, "mature-noise/examples/eval-demo.js")),
    );
  });

  test("production path is compileGateStatus (not a parallel verifier)", () => {
    const report = { rawIssues: [] };
    compileGateStatus(report);
    assert.ok(report.maintainerHeadline);
    assert.ok(report.verification);
    assert.ok(report.signal);

    const measured = measureProductionFunnel([
      {
        type: "evalDanger",
        severity: "critical",
        filePath: "app/routes/x.js",
        description: "eval",
      },
    ]);
    assert.ok(measured.signalsAnalyzed >= 1);
    assert.equal(typeof measured.verified, "number");
  });

  test("v1 report schema + two-sided acceptance", () => {
    const report = runVerificationFunnelBenchmark();
    assert.equal(report.benchmark, BENCHMARK_ID);
    assert.deepEqual(report.productionPath.slice(0, 2), [
      "rawIssues",
      "compileGateStatus",
    ]);

    const names = report.targets.map((t) => t.name);
    assert.deepEqual(names, [
      "nodegoat",
      "xss-fixture",
      "open-webui",
      "gitea",
      "immich",
      "kubernetes",
    ]);

    const byName = Object.fromEntries(report.targets.map((t) => [t.name, t]));

    // Positive: known → Verified
    assert.deepEqual(byName.nodegoat.expectedVerified, ["ssjs-eval-rce"]);
    assert.equal(byName.nodegoat.verified, 1);
    assert.equal(byName.nodegoat.verifiedRecall, 1);
    assert.equal(byName.nodegoat.falsePositivePromotions, 0);

    assert.deepEqual(byName["xss-fixture"].expectedVerified, ["slice6-dom-xss"]);
    assert.equal(byName["xss-fixture"].verified, 1);
    assert.equal(byName["xss-fixture"].verifiedRecall, 1);

    // Negatives: unsupported → never Verified
    for (const name of ["open-webui", "gitea", "immich", "kubernetes"]) {
      assert.equal(byName[name].verified, 0, name);
      assert.equal(byName[name].falsePositivePromotions, 0, name);
    }

    assert.equal(report.groundTruth.result.recall, "PASS");
    assert.equal(report.groundTruth.result.noiseRejection, "PASS");
    assert.equal(report.groundTruth.result.explainability, "PASS");
    assert.equal(report.pass, true);
    assert.equal(report.groundTruth.unsupportedVerified, 0);
  });

  test("human report matches acceptance framing", () => {
    const text = formatHumanReport(runVerificationFunnelBenchmark());
    assert.match(text, /SIMPLEBEACON VERIFICATION FUNNEL BENCHMARK/);
    assert.match(text, /GROUND TRUTH/);
    assert.match(text, /Unsupported Verified/);
    assert.match(text, /Recall:\s+PASS/);
    assert.match(text, /Noise rejection:\s+PASS/);
    assert.match(text, /not an acceptance metric/i);
  });

  test("V1 baseline is frozen on disk", () => {
    const baselinePath = path.join(FIXTURE_ROOT, "baseline.v1.json");
    assert.ok(fs.existsSync(baselinePath), baselinePath);
    const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
    assert.equal(baseline.status, "frozen");
    assert.equal(baseline.acceptance.verifiedRecall, 1);
    assert.equal(baseline.acceptance.unsupportedVerified, 0);
    assert.equal(baseline.acceptance.knownVulnerabilities, 2);
    assert.match(baseline.claim, /labeled positive controls/i);
    assert.match(baseline.claimIsNot, /detection accuracy/i);
    assert.equal(baseline.nextMilestone, "v2-ground-truth-expansion");
  });
});
