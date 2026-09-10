#!/usr/bin/env node
/**
 * Verification funnel benchmark CLI (v1 frozen / v2 expansion / v3 diversity).
 *
 * Usage:
 *   node scripts/verification-funnel-benchmark.cjs
 *   node scripts/verification-funnel-benchmark.cjs --v2
 *   node scripts/verification-funnel-benchmark.cjs --v3
 *   node scripts/verification-funnel-benchmark.cjs --v3 --json
 *
 * V2/V3: labels/corpus only; verifier unchanged.
 * Exit 1 if unsupported Verified > 0 (or hard-negative promotions on V3).
 * Recall misses are reported but do not fail the experiment.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const {
  runVerificationFunnelBenchmark,
  runVerificationFunnelBenchmarkV2,
  runVerificationFunnelBenchmarkV3,
  formatHumanReport,
  formatHumanReportV2,
  formatHumanReportV3,
} = require("../src/lib/verification-funnel-benchmark");

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const allowFail = args.has("--allow-fail");
const v3 = args.has("--v3");
const v2 = args.has("--v2");

let report;
let human;
let outName;
if (v3) {
  report = runVerificationFunnelBenchmarkV3();
  human = formatHumanReportV3(report);
  outName = "verification-funnel-v3-report.json";
} else if (v2) {
  report = runVerificationFunnelBenchmarkV2();
  human = formatHumanReportV2(report);
  outName = "verification-funnel-v2-report.json";
} else {
  report = runVerificationFunnelBenchmark();
  human = formatHumanReport(report);
  outName = "verification-funnel-report.json";
}

const outDir = path.resolve(__dirname, "../../../.simplebeacon/benchmark");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, outName);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

if (asJson) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  process.stdout.write(human + "\n");
  process.stdout.write(`\nWrote ${outPath}\n`);
}

if (!allowFail && !report.pass) {
  process.stderr.write(
    `\nFAIL — unsupported Verified / hard-negative / noise rejection (hard gate)\n`,
  );
  process.exit(1);
}

process.exit(0);
