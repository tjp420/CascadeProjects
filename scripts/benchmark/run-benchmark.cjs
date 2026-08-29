"use strict";

/**
 * Secret Detection Benchmark Harness
 *
 * Runs SimpleBeacon's credential pattern scanner (and optionally gitleaks)
 * against a labeled corpus of true-positive and true-negative fixtures,
 * computing precision, recall, and F1-score for each tool.
 *
 * Usage:
 *   node scripts/benchmark/run-benchmark.cjs                    # simplebeacon only
 *   node scripts/benchmark/run-benchmark.cjs --with-gitleaks    # also run gitleaks
 *   node scripts/benchmark/run-benchmark.cjs --json             # output JSON only
 *
 * Output:
 *   scripts/benchmark/report.json — full comparison report
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

// ── Paths ────────────────────────────────────────────────────────────────
const BENCH_DIR = __dirname;
const CORPUS_DIR = path.join(BENCH_DIR, "corpus");
const TP_DIR = path.join(CORPUS_DIR, "true-positives");
const TN_DIR = path.join(CORPUS_DIR, "true-negatives");
const LABELS_PATH = path.join(CORPUS_DIR, "labels.json");
const REPORT_PATH = path.join(BENCH_DIR, "report.json");

// ── SimpleBeacon scanner import ──────────────────────────────────────────
const CLI_ROOT = path.resolve(__dirname, "../../packages/simplebeacon-cli");
const { scanCredentialPatterns } = require(path.join(
  CLI_ROOT,
  "src/lib/credential-pattern-scanner",
));

// ── Helpers ──────────────────────────────────────────────────────────────

function readLabels() {
  return JSON.parse(fs.readFileSync(LABELS_PATH, "utf8"));
}

/**
 * Walk a directory and return file objects for the credential scanner.
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
 * Create a temporary project directory with a single fixture file.
 */
function makeFixtureProject(filePath) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-bench-"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "bench-fixture", version: "1.0.0" }),
    "utf8",
  );
  const destFile = path.join(root, "src", path.basename(filePath));
  fs.copyFileSync(filePath, destFile);
  return { root, destFile };
}

/**
 * Run SimpleBeacon credential scanner on a single file.
 * Returns an array of finding objects.
 */
async function runSimplebeacon(filePath) {
  const { root, destFile } = makeFixtureProject(filePath);
  try {
    const files = walkFiles(path.join(root, "src"), root);
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
      ruleId: f.ruleId || f.id || null,
    }));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/**
 * Run gitleaks on a single file.
 * Returns an array of finding objects, or null if gitleaks is not available.
 */
function runGitleaks(filePath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-gitleaks-"));
  try {
    const destFile = path.join(tmpDir, path.basename(filePath));
    fs.copyFileSync(filePath, destFile);

    // Run gitleaks detect on the file with no config (default rules)
    let output;
    try {
      output = execFileSync(
        "gitleaks",
        ["detect", "--source", tmpDir, "--no-git", "--report-format", "json", "--report-path", "-", "--no-banner", "--exit-code", "0"],
        { encoding: "utf8", timeout: 30000, cwd: tmpDir },
      );
    } catch (err) {
      // gitleaks exits non-zero if findings are detected, but with --exit-code 0 it should not
      // If it still fails, treat as no findings
      if (err.status === 1 || err.code === 1) {
        output = err.stdout || "";
      } else {
        return null; // gitleaks not available or errored
      }
    }

    let findings;
    try {
      findings = JSON.parse(output || "[]");
    } catch {
      findings = [];
    }

    return findings.map((f) => ({
      type: "Secret",
      severity: "high",
      filePath: f.File || null,
      line: f.StartLine || null,
      description: f.Description || f.RuleID || "",
      ruleId: f.RuleID || null,
    }));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Check if gitleaks is installed and available.
 */
function isGitleaksAvailable() {
  try {
    execFileSync("gitleaks", ["version"], { encoding: "utf8", timeout: 5000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// ── Metrics computation ──────────────────────────────────────────────────

/**
 * Compute precision, recall, F1 from TP/FN/FP counts.
 */
function computeMetrics(tp, fn, fp) {
  const precision = tp + fp > 0 ? tp / (tp + fp) : 1;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 1;
  const f1 = precision + recall > 0 ? (2 * (precision * recall)) / (precision + recall) : 0;
  return {
    truePositives: tp,
    falseNegatives: fn,
    falsePositives: fp,
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1: Math.round(f1 * 1000) / 1000,
  };
}

// ── Main benchmark runner ────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const withGitleaks = args.includes("--with-gitleaks");
  const jsonOnly = args.includes("--json");

  const labels = readLabels();
  const tpFiles = labels.truePositives;
  const tnFiles = labels.trueNegatives;

  const useGitleaks = withGitleaks && isGitleaksAvailable();

  if (!jsonOnly) {
    console.log("");
    console.log("========================================================");
    console.log("  Secret Detection Benchmark");
    console.log("  Corpus: " + (tpFiles.length + tnFiles.length) + " files");
    console.log("    True Positives: " + tpFiles.length);
    console.log("    True Negatives: " + tnFiles.length);
    console.log("  Tools: simplebeacon" + (useGitleaks ? " + gitleaks" : ""));
    console.log("========================================================");
    console.log("");
  }

  // ── Run SimpleBeacon ──────────────────────────────────────────────────
  const sbResults = {
    truePositives: [],
    falseNegatives: [],
    falsePositives: [],
    perCategory: {},
  };

  // True positives — each file should produce at least 1 finding
  for (const tp of tpFiles) {
    const filePath = path.join(TP_DIR, tp.file);
    if (!fs.existsSync(filePath)) {
      sbResults.falseNegatives.push({ file: tp.file, reason: "file missing", category: tp.category });
      continue;
    }

    const findings = await runSimplebeacon(filePath);
    if (findings.length > 0) {
      sbResults.truePositives.push({ file: tp.file, category: tp.category, findings });
    } else {
      sbResults.falseNegatives.push({ file: tp.file, category: tp.category, reason: "no findings" });
    }

    // Track per-category
    if (!sbResults.perCategory[tp.category]) {
      sbResults.perCategory[tp.category] = { tp: 0, fn: 0, fp: 0 };
    }
    if (findings.length > 0) sbResults.perCategory[tp.category].tp++;
    else sbResults.perCategory[tp.category].fn++;
  }

  // True negatives — each file should produce 0 findings
  for (const tn of tnFiles) {
    const filePath = path.join(TN_DIR, tn.file);
    if (!fs.existsSync(filePath)) continue;

    const findings = await runSimplebeacon(filePath);
    if (findings.length > 0) {
      sbResults.falsePositives.push({ file: tn.file, reason: tn.reason, findings });
    }
  }

  const sbMetrics = computeMetrics(
    sbResults.truePositives.length,
    sbResults.falseNegatives.length,
    sbResults.falsePositives.length,
  );

  // ── Run gitleaks (if available) ───────────────────────────────────────
  let glResults = null;
  let glMetrics = null;

  if (useGitleaks) {
    glResults = {
      truePositives: [],
      falseNegatives: [],
      falsePositives: [],
      perCategory: {},
    };

    for (const tp of tpFiles) {
      const filePath = path.join(TP_DIR, tp.file);
      if (!fs.existsSync(filePath)) {
        glResults.falseNegatives.push({ file: tp.file, reason: "file missing", category: tp.category });
        continue;
      }

      const findings = runGitleaks(filePath);
      if (findings === null) {
        glResults.falseNegatives.push({ file: tp.file, category: tp.category, reason: "gitleaks error" });
      } else if (findings.length > 0) {
        glResults.truePositives.push({ file: tp.file, category: tp.category, findings });
      } else {
        glResults.falseNegatives.push({ file: tp.file, category: tp.category, reason: "no findings" });
      }

      if (!glResults.perCategory[tp.category]) {
        glResults.perCategory[tp.category] = { tp: 0, fn: 0, fp: 0 };
      }
      if (findings && findings.length > 0) glResults.perCategory[tp.category].tp++;
      else glResults.perCategory[tp.category].fn++;
    }

    for (const tn of tnFiles) {
      const filePath = path.join(TN_DIR, tn.file);
      if (!fs.existsSync(filePath)) continue;

      const findings = runGitleaks(filePath);
      if (findings && findings.length > 0) {
        glResults.falsePositives.push({ file: tn.file, reason: tn.reason, findings });
      }
    }

    glMetrics = computeMetrics(
      glResults.truePositives.length,
      glResults.falseNegatives.length,
      glResults.falsePositives.length,
    );
  }

  // ── Build report ──────────────────────────────────────────────────────
  const report = {
    benchmarkVersion: 1,
    generatedAt: new Date().toISOString(),
    corpus: {
      totalFiles: tpFiles.length + tnFiles.length,
      truePositives: tpFiles.length,
      trueNegatives: tnFiles.length,
      categories: Object.keys(labels.categories),
    },
    tools: {
      simplebeacon: {
        name: "SimpleBeacon Credential Scanner",
        metrics: sbMetrics,
        perCategory: sbResults.perCategory,
        falseNegatives: sbResults.falseNegatives,
        falsePositives: sbResults.falsePositives,
      },
    },
  };

  if (glResults) {
    report.tools.gitleaks = {
      name: "Gitleaks",
      metrics: glMetrics,
      perCategory: glResults.perCategory,
      falseNegatives: glResults.falseNegatives,
      falsePositives: glResults.falsePositives,
    };
  }

  // ── Console output ────────────────────────────────────────────────────
  if (!jsonOnly) {
    console.log("  SimpleBeacon:");
    console.log("    TP: " + sbMetrics.truePositives + "  FN: " + sbMetrics.falseNegatives + "  FP: " + sbMetrics.falsePositives);
    console.log("    Precision: " + sbMetrics.precision + "  Recall: " + sbMetrics.recall + "  F1: " + sbMetrics.f1);
    if (sbResults.falseNegatives.length > 0) {
      console.log("    False Negatives (missed secrets):");
      for (const fn of sbResults.falseNegatives) {
        console.log("      " + fn.file + " [" + fn.category + "] — " + fn.reason);
      }
    }
    if (sbResults.falsePositives.length > 0) {
      console.log("    False Positives (clean files flagged):");
      for (const fp of sbResults.falsePositives) {
        console.log("      " + fp.file + " — " + fp.reason);
      }
    }
    console.log("");

    if (glMetrics) {
      console.log("  Gitleaks:");
      console.log("    TP: " + glMetrics.truePositives + "  FN: " + glMetrics.falseNegatives + "  FP: " + glMetrics.falsePositives);
      console.log("    Precision: " + glMetrics.precision + "  Recall: " + glMetrics.recall + "  F1: " + glMetrics.f1);
      if (glResults.falseNegatives.length > 0) {
        console.log("    False Negatives (missed secrets):");
        for (const fn of glResults.falseNegatives) {
          console.log("      " + fn.file + " [" + fn.category + "] — " + fn.reason);
        }
      }
      if (glResults.falsePositives.length > 0) {
        console.log("    False Positives (clean files flagged):");
        for (const fp of glResults.falsePositives) {
          console.log("      " + fp.file + " — " + fp.reason);
        }
      }
      console.log("");

      // Comparison table
      console.log("  ────────────────────────────────────────────────────────");
      console.log("  Tool          Precision  Recall  F1     TP  FN  FP");
      console.log("  ────────────────────────────────────────────────────────");
      console.log(
        "  SimpleBeacon  " +
          sbMetrics.precision.toString().padEnd(10) +
          " " +
          sbMetrics.recall.toString().padEnd(7) +
          " " +
          sbMetrics.f1.toString().padEnd(6) +
          " " +
          sbMetrics.truePositives.toString().padEnd(3) +
          " " +
          sbMetrics.falseNegatives.toString().padEnd(3) +
          " " +
          sbMetrics.falsePositives,
      );
      console.log(
        "  Gitleaks      " +
          glMetrics.precision.toString().padEnd(10) +
          " " +
          glMetrics.recall.toString().padEnd(7) +
          " " +
          glMetrics.f1.toString().padEnd(6) +
          " " +
          glMetrics.truePositives.toString().padEnd(3) +
          " " +
          glMetrics.falseNegatives.toString().padEnd(3) +
          " " +
          glMetrics.falsePositives,
      );
      console.log("  ────────────────────────────────────────────────────────");
      console.log("");
    }
  }

  // ── Write report ──────────────────────────────────────────────────────
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  if (!jsonOnly) {
    console.log("  Report written to: " + REPORT_PATH);
    console.log("");
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
