"use strict";

/**
 * True-Positive Matrix Validation Runner
 *
 * Scans each fixture in the true-positive suite by calling the SimpleBeacon
 * scanner modules directly (bypassing tier restrictions), compares actual
 * findings against the suite-manifest.json labels, and computes precision,
 * recall, and F1-score per engine and for the suite as a whole.
 *
 * Usage:
 *   node tests/fixtures/true-positives/run-matrix-validation.cjs
 *
 * Exit codes:
 *   0 — all expected findings detected (recall = 1.0)
 *   1 — one or more expected findings missing (recall < 1.0)
 *   2 — manifest or scanner error
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

// Import scanners directly — bypasses tier restrictions
const {
  scanCredentialPatterns,
} = require("../../../src/lib/credential-pattern-scanner");
const {
  scanSourceFictionPatterns,
} = require("../../../src/rules/fiction-kpi-patterns");
const { scanLlmSlopPatterns } = require("../../../src/rules/llm-slop-patterns");
const {
  scanTokenBleedPatterns,
} = require("../../../src/rules/token-bleed-patterns");

// ── Severity ranking for minSeverity comparison ──────────────────────────
const SEVERITY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

// ── Rejected fiction baseline (GENERIC_REJECTED_FICTION from config.js) ──
const REJECTED_FICTION = {
  featureCounts: [47, 100, 156, 8, 9],
  completionRates: [74.17, 87, 94.3, 66, 62],
  mockFileCounts: [1247, 999, 1000],
  openIssueCounts: [156, 999],
  modelNames: ["unbreakable-oracle", "gpt-5-oracle", "demo-oracle"],
  throughputClaims: ["1559", "1,559", "9999"],
  aiConfidenceScores: [98.5, 94.3, 87],
};

/**
 * Create a temporary project directory with a single fixture file.
 */
function makeFixtureProject(fixtureDir, fixtureRelPath) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-matrix-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "matrix-fixture", version: "1.0.0" }),
    "utf8",
  );
  const srcFile = path.join(fixtureDir, fixtureRelPath);
  const destFile = path.join(root, "src", path.basename(fixtureRelPath));
  fs.copyFileSync(srcFile, destFile);
  return root;
}

/**
 * Walk a directory and return a list of file objects suitable for the
 * credential scanner (which expects { path, ext, relativePath, size }).
 */
function walkFiles(dir, baseDir, results = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, baseDir, results);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const relativePath = path
        .relative(baseDir, fullPath)
        .split(path.sep)
        .join("/");
      const stat = fs.statSync(fullPath);
      results.push({ path: fullPath, ext, relativePath, size: stat.size });
    }
  }
  return results;
}

/**
 * Run the appropriate scanner for an engine ID on a fixture directory.
 */
async function scanFixture(engineId, root) {
  const srcPath = path.join(root, "src");

  switch (engineId) {
    case "credentials":
    case "dbConnectionString":
    case "awsAccessKey": {
      const files = walkFiles(srcPath, root);
      const result = await scanCredentialPatterns(files, {
        scanProduction: true,
        productionPaths: ["src"],
        ignoreGlobs: [],
      });
      return (result.issues || []).map((f) => ({
        type: f.type || "Credential Pattern",
        severity: String(f.severity || "medium").toLowerCase(),
        filePath: f.filePath || f.file || null,
        line: f.line || null,
        description: f.description || f.message || "",
      }));
    }

    case "fictionKpi": {
      const result = await scanSourceFictionPatterns(root, {
        sourcePaths: ["src"],
        ignoreGlobs: [],
        pathExclusions: [],
        baseline: { rejectedFiction: REJECTED_FICTION },
      });
      return (result.issues || []).map((f) => ({
        type: f.type || "Fictional KPI",
        severity: String(f.severity || "medium").toLowerCase(),
        filePath: f.filePath || f.file || null,
        line: f.line || null,
        description: f.description || "",
      }));
    }

    case "llmSlop":
    case "aiPlaceholderComment": {
      const result = await scanLlmSlopPatterns(root, {
        sourcePaths: ["src"],
        ignoreGlobs: [],
        severity: "medium",
      });
      return (result.issues || []).map((f) => ({
        type: f.type || "LLM Slop Pattern",
        severity: String(f.severity || "medium").toLowerCase(),
        filePath: f.filePath || f.file || null,
        line: f.line || null,
        description: f.description || "",
      }));
    }

    case "tokenBleed": {
      const result = await scanTokenBleedPatterns(root, {
        productionPaths: ["src"],
        ignoreGlobs: [],
        severity: "medium",
      });
      return (result.issues || []).map((f) => ({
        type: f.type || "Token Bleed",
        severity: String(f.severity || "medium").toLowerCase(),
        filePath: f.filePath || f.file || null,
        line: f.line || null,
        description: f.description || "",
      }));
    }

    default:
      throw new Error("Unknown engine ID: " + engineId);
  }
}

/**
 * Check whether an actual finding matches an expected finding from the manifest.
 */
function findingMatches(actual, expected) {
  const actualType = String(actual.type || "").toLowerCase();
  const expectedType = String(expected.type || "").toLowerCase();

  // Type match: expected type is a substring of actual type or vice versa
  const typeMatch =
    actualType.includes(expectedType) || expectedType.includes(actualType);
  if (!typeMatch) return false;

  // Severity match: actual severity must be >= expected minSeverity
  const actualRank = SEVERITY_RANK[String(actual.severity).toLowerCase()] || 0;
  const expectedRank =
    SEVERITY_RANK[String(expected.minSeverity).toLowerCase()] || 0;
  return actualRank >= expectedRank;
}

/**
 * Compute precision, recall, and F1-score.
 */
function computeMetrics(expected, actual, matches) {
  const totalExpected = expected.length;
  const totalActual = actual.length;
  const truePositives = matches.length;
  const falseNegatives = totalExpected - truePositives;
  const falsePositives = totalActual - truePositives;

  const precision = totalActual > 0 ? truePositives / totalActual : 1;
  const recall = totalExpected > 0 ? truePositives / totalExpected : 1;
  const f1 =
    precision + recall > 0
      ? (2 * (precision * recall)) / (precision + recall)
      : 0;

  return {
    truePositives,
    falseNegatives,
    falsePositives,
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1: Math.round(f1 * 1000) / 1000,
  };
}

async function main() {
  const fixtureRoot = __dirname;
  const manifestPath = path.join(fixtureRoot, "suite-manifest.json");

  if (!fs.existsSync(manifestPath)) {
    console.error("ERROR: suite-manifest.json not found at " + manifestPath);
    process.exit(2);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const fixtures = manifest.fixtures || [];

  if (fixtures.length === 0) {
    console.error("ERROR: manifest contains no fixtures");
    process.exit(2);
  }

  console.log("");
  console.log("========================================================");
  console.log("  SimpleBeacon True-Positive Matrix Validation");
  console.log(
    "  Fixtures: " +
      fixtures.length +
      "  |  Engines tested: " +
      new Set(fixtures.map((f) => f.engineId)).size,
  );
  console.log("========================================================");
  console.log("");

  const results = [];
  let allPassed = true;
  let totalTruePositives = 0;
  let totalFalseNegatives = 0;
  let totalFalsePositives = 0;

  for (const fixture of fixtures) {
    const fixtureFile = path.join(fixtureRoot, fixture.filePath);
    if (!fs.existsSync(fixtureFile)) {
      console.error("  [SKIP] Fixture file missing: " + fixture.filePath);
      results.push({
        fixture,
        status: "skip",
        reason: "file missing",
        metrics: null,
      });
      allPassed = false;
      continue;
    }

    process.stdout.write(
      "  [" + fixture.engineId + "] " + fixture.id + " ... ",
    );

    try {
      const root = makeFixtureProject(fixtureRoot, fixture.filePath);
      let actualFindings;
      try {
        actualFindings = await scanFixture(fixture.engineId, root);
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }

      const expectedFindings = fixture.expectedFindings || [];

      // Match each expected finding to an actual finding
      const matches = [];
      const unmatched = [];
      for (const expected of expectedFindings) {
        const match = actualFindings.find((a) => findingMatches(a, expected));
        if (match) {
          matches.push({ expected, actual: match });
        } else {
          unmatched.push(expected);
        }
      }

      const metrics = computeMetrics(expectedFindings, actualFindings, matches);
      totalTruePositives += metrics.truePositives;
      totalFalseNegatives += metrics.falseNegatives;
      totalFalsePositives += metrics.falsePositives;

      if (metrics.recall < 1) {
        console.log("FAIL (recall=" + metrics.recall + ")");
        console.log("    Expected: " + JSON.stringify(unmatched));
        console.log(
          "    Actual:   " +
            JSON.stringify(
              actualFindings.map((f) => ({
                type: f.type,
                severity: f.severity,
              })),
            ),
        );
        results.push({
          fixture,
          status: "fail",
          metrics,
          actualFindings,
          unmatched,
        });
        allPassed = false;
      } else {
        console.log(
          "PASS (precision=" +
            metrics.precision +
            ", recall=" +
            metrics.recall +
            ", F1=" +
            metrics.f1 +
            ")",
        );
        if (metrics.falsePositives > 0) {
          console.log(
            "    " +
              metrics.falsePositives +
              " additional finding(s) — review for false positives",
          );
        }
        results.push({ fixture, status: "pass", metrics, actualFindings });
      }
    } catch (err) {
      console.log("ERROR");
      console.log("    " + err.message);
      results.push({ fixture, status: "error", error: err.message });
      allPassed = false;
    }
  }

  // ── Suite-level metrics ──────────────────────────────────────────────
  const suitePrecision =
    totalTruePositives + totalFalsePositives > 0
      ? totalTruePositives / (totalTruePositives + totalFalsePositives)
      : 1;
  const suiteRecall =
    totalTruePositives + totalFalseNegatives > 0
      ? totalTruePositives / (totalTruePositives + totalFalseNegatives)
      : 1;
  const suiteF1 =
    suitePrecision + suiteRecall > 0
      ? (2 * (suitePrecision * suiteRecall)) / (suitePrecision + suiteRecall)
      : 0;

  console.log("");
  console.log("--------------------------------------------------------");
  console.log("  Suite Summary");
  console.log("--------------------------------------------------------");
  console.log("  True Positives:  " + totalTruePositives);
  console.log("  False Negatives: " + totalFalseNegatives);
  console.log("  False Positives: " + totalFalsePositives);
  console.log("  Precision:       " + Math.round(suitePrecision * 1000) / 1000);
  console.log("  Recall:          " + Math.round(suiteRecall * 1000) / 1000);
  console.log("  F1-Score:        " + Math.round(suiteF1 * 1000) / 1000);
  console.log("");

  // ── Per-engine breakdown ─────────────────────────────────────────────
  const engineMap = {};
  for (const r of results) {
    const eid = r.fixture.engineId;
    if (!engineMap[eid]) engineMap[eid] = { passes: 0, fails: 0, errors: 0 };
    if (r.status === "pass") engineMap[eid].passes++;
    else if (r.status === "fail") engineMap[eid].fails++;
    else engineMap[eid].errors++;
  }

  console.log("  Per-Engine Breakdown:");
  for (const [engine, counts] of Object.entries(engineMap)) {
    const status = counts.fails > 0 || counts.errors > 0 ? "FAIL" : "OK";
    console.log(
      "    " +
        engine.padEnd(25) +
        " " +
        status +
        "  (" +
        counts.passes +
        " pass, " +
        counts.fails +
        " fail, " +
        counts.errors +
        " error)",
    );
  }
  console.log("");

  // ── Coverage map output (for AuditView.tsx consumption) ──────────────
  const coverageMap = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    suite: {
      totalFixtures: fixtures.length,
      totalEngines: new Set(fixtures.map((f) => f.engineId)).size,
      passed: results.filter((r) => r.status === "pass").length,
      failed: results.filter((r) => r.status === "fail").length,
      errors: results.filter((r) => r.status === "error").length,
      skipped: results.filter((r) => r.status === "skip").length,
    },
    metrics: {
      precision: Math.round(suitePrecision * 1000) / 1000,
      recall: Math.round(suiteRecall * 1000) / 1000,
      f1: Math.round(suiteF1 * 1000) / 1000,
    },
    engines: Object.entries(engineMap).map(([id, counts]) => ({
      engineId: id,
      status: counts.fails > 0 || counts.errors > 0 ? "fail" : "pass",
      fixturesPassed: counts.passes,
      fixturesFailed: counts.fails,
      fixturesErrored: counts.errors,
    })),
  };

  const coveragePath = path.join(fixtureRoot, "coverage-map.json");
  fs.writeFileSync(coveragePath, JSON.stringify(coverageMap, null, 2), "utf8");
  console.log("  Coverage map written to: " + coveragePath);
  console.log("");

  if (allPassed && suiteRecall === 1) {
    console.log("  RESULT: ALL PASS — recall = 1.0");
    process.exit(0);
  } else {
    console.log("  RESULT: FAILURES DETECTED — recall < 1.0");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
