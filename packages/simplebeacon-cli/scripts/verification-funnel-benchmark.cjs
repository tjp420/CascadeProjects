#!/usr/bin/env node
/**
 * Verification funnel benchmark v1 CLI.
 *
 * Measures the production gate path — does not invent a second verifier.
 *
 * Usage:
 *   node scripts/verification-funnel-benchmark.cjs
 *   node scripts/verification-funnel-benchmark.cjs --json
 *   set SB_BENCH_K8S_ROOT=C:\path\to\kubernetes
 *
 * Exit 1 unless Recall + Noise rejection + Explainability all PASS.
 * (--allow-fail keeps exit 0 for debugging)
 */

"use strict";

const fs = require("fs");
const path = require("path");

const {
  runVerificationFunnelBenchmark,
  formatHumanReport,
} = require("../src/lib/verification-funnel-benchmark");

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const allowFail = args.has("--allow-fail");

const report = runVerificationFunnelBenchmark();

const outDir = path.resolve(__dirname, "../../../.simplebeacon/benchmark");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "verification-funnel-report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

if (asJson) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  process.stdout.write(formatHumanReport(report) + "\n");
  process.stdout.write(`\nWrote ${outPath}\n`);
}

if (!allowFail && !report.pass) {
  const g = report.groundTruth.result;
  process.stderr.write(
    `\nFAIL — recall=${g.recall} noise=${g.noiseRejection} explainability=${g.explainability}\n`,
  );
  process.exit(1);
}

process.exit(0);
