#!/usr/bin/env node
/**
 * Verification funnel benchmark CLI (v1 frozen / v2 ground-truth expansion).
 *
 * Usage:
 *   node scripts/verification-funnel-benchmark.cjs
 *   node scripts/verification-funnel-benchmark.cjs --v2
 *   node scripts/verification-funnel-benchmark.cjs --v2 --json
 *
 * V2: expands labels only; verifier unchanged. Exit 1 if unsupported Verified > 0.
 * Recall misses are reported but do not fail V2 (they are the experiment).
 */

"use strict";

const fs = require("fs");
const path = require("path");

const {
  runVerificationFunnelBenchmark,
  runVerificationFunnelBenchmarkV2,
  formatHumanReport,
  formatHumanReportV2,
} = require("../src/lib/verification-funnel-benchmark");

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");
const allowFail = args.has("--allow-fail");
const v2 = args.has("--v2");

const report = v2
  ? runVerificationFunnelBenchmarkV2()
  : runVerificationFunnelBenchmark();

const outDir = path.resolve(__dirname, "../../../.simplebeacon/benchmark");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(
  outDir,
  v2 ? "verification-funnel-v2-report.json" : "verification-funnel-report.json",
);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

const human = v2 ? formatHumanReportV2(report) : formatHumanReport(report);
if (asJson) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  process.stdout.write(human + "\n");
  process.stdout.write(`\nWrote ${outPath}\n`);
}

if (!allowFail && !report.pass) {
  process.stderr.write(
    `\nFAIL — unsupported Verified / noise rejection (hard gate)\n`,
  );
  process.exit(1);
}

process.exit(0);
