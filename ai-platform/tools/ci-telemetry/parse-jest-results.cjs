#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function usage() {
  console.error('Usage: parse-jest-results.cjs <jest-results.json> [output-dir]');
  process.exit(2);
}

if (process.argv.length < 3) usage();

const input = process.argv[2];
const outDir = process.argv[3] || process.cwd();

if (!fs.existsSync(input)) {
  console.error('Input file not found:', input);
  process.exit(2);
}

const data = JSON.parse(fs.readFileSync(input, 'utf8'));

// Metrics we extract:
// - totalTests
// - totalPassed
// - totalFailed
// - totalPending
// - startTime, endTime, runTimeMs
// - per-test-file durations

const summary = {
  totalTests: data.numTotalTests || 0,
  totalPassed: data.numPassedTests || 0,
  totalFailed: data.numFailedTests || 0,
  totalPending: data.numPendingTests || 0,
  startTime: data.startTime || null,
  runTimeMs: null,
  testFileSummaries: [],
};

if (data.startTime && data.success) {
  // jest's `startTime` is epoch ms and test Suites have `endTime`? compute runTime using snapshot
  summary.runTimeMs = data.testResults && data.testResults.length ? data.testResults.reduce((acc, t) => acc + (t.perfStats && t.perfStats.runtime ? t.perfStats.runtime : 0), 0) : null;
}

if (Array.isArray(data.testResults)) {
  for (const tr of data.testResults) {
    summary.testFileSummaries.push({
      filePath: tr.name,
      numPassingTests: tr.numPassingTests || 0,
      numFailingTests: tr.numFailingTests || 0,
      numPendingTests: tr.numPendingTests || 0,
      runTimeMs: tr.perfStats && tr.perfStats.runtime ? tr.perfStats.runtime : null,
    });
  }
}

// Write summary JSON
fs.mkdirSync(outDir, { recursive: true });
const outSummary = path.join(outDir, 'ci-test-summary.json');
fs.writeFileSync(outSummary, JSON.stringify(summary, null, 2));
console.log('Wrote summary to', outSummary);

// Emit Prometheus-style metrics
// Simple mapping: gauge/counter metrics in text exposition
const promLines = [];
function metricHelp(name, help) { promLines.push(`# HELP ${name} ${help}`); }
function metricType(name, type) { promLines.push(`# TYPE ${name} ${type}`); }

metricHelp('ci_tests_total', 'Total number of tests discovered');
metricType('ci_tests_total', 'gauge');
promLines.push(`ci_tests_total ${summary.totalTests}`);

metricHelp('ci_tests_passed_total', 'Total number of passed tests');
metricType('ci_tests_passed_total', 'gauge');
promLines.push(`ci_tests_passed_total ${summary.totalPassed}`);

metricHelp('ci_tests_failed_total', 'Total number of failed tests');
metricType('ci_tests_failed_total', 'gauge');
promLines.push(`ci_tests_failed_total ${summary.totalFailed}`);

metricHelp('ci_tests_pending_total', 'Total number of pending tests');
metricType('ci_tests_pending_total', 'gauge');
promLines.push(`ci_tests_pending_total ${summary.totalPending}`);

metricHelp('ci_tests_run_time_ms', 'Aggregate test run time in milliseconds');
metricType('ci_tests_run_time_ms', 'gauge');
promLines.push(`ci_tests_run_time_ms ${summary.runTimeMs || 0}`);

// per-file duration as labeled gauge
metricHelp('ci_testfile_runtime_ms', 'Per-test-file runtime in ms');
metricType('ci_testfile_runtime_ms', 'gauge');
for (const f of summary.testFileSummaries) {
  const labels = `file="${path.basename(f.filePath).replace(/"/g, '\\"')}"`;
  promLines.push(`ci_testfile_runtime_ms{${labels}} ${f.runTimeMs || 0}`);
}

const outProm = path.join(outDir, 'ci-test-metrics.prom');
fs.writeFileSync(outProm, promLines.join('\n') + '\n');
console.log('Wrote Prometheus metrics to', outProm);

process.exit(0);
