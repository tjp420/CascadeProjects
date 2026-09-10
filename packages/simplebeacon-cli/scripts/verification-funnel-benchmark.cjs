#!/usr/bin/env node
/**
 * Verification funnel benchmark CLI (v1–v5).
 *
 * Usage:
 *   node scripts/verification-funnel-benchmark.cjs [--v2|--v3|--v4|--v5] [--json] [--allow-fail]
 */

"use strict";

const fs = require("fs");
const path = require("path");

const {
  runVerificationFunnelBenchmark,
  runVerificationFunnelBenchmarkV2,
  runVerificationFunnelBenchmarkV3,
  runVerificationFunnelBenchmarkV4,
  runVerificationFunnelBenchmarkV5,
  formatHumanReport,
  formatHumanReportV2,
  formatHumanReportV3,
  formatHumanReportV4,
  formatHumanReportV5,
} = require("../src/lib/verification-funnel-benchmark");

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const allowFail = args.has("--allow-fail");
const v5 = args.has("--v5");
const v4 = args.has("--v4");
const v3 = args.has("--v3");
const v2 = args.has("--v2");

let report;
let human;
let outName;
if (v5) {
  report = runVerificationFunnelBenchmarkV5();
  human = formatHumanReportV5(report);
  outName = "verification-funnel-v5-report.json";
} else if (v4) {
  report = runVerificationFunnelBenchmarkV4();
  human = formatHumanReportV4(report);
  outName = "verification-funnel-v4-report.json";
} else if (v3) {
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
    `\nFAIL — unsupported Verified / hard-negative / regression / noise rejection (hard gate)\n`,
  );
  process.exit(1);
}

process.exit(0);
