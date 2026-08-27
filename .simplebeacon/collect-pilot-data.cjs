#!/usr/bin/env node
/**
 * Pilot Data Collection Script
 *
 * Runs SimpleBeacon on the current repo with production exclusions,
 * then categorizes findings as true positives vs false positives
 * by checking if they're in generated/bundled/test files.
 */
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const PROJECT_ROOT = "C:/Users/user/CascadeProjects";
const REPORT_PATH = path.join(PROJECT_ROOT, ".simplebeacon/pilot-report.json");

console.log("=== SimpleBeacon Pilot Data Collection ===\n");

// Run the scan
console.log("Running gate scan...");
try {
  execSync(
    `npx simplebeacon scan --gate --offline --format json --output "${REPORT_PATH}"`,
    { cwd: PROJECT_ROOT, stdio: "pipe", timeout: 300000 }
  );
} catch (e) {
  console.log("Scan completed (may have warnings)");
}

// Read the report
const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
const gate = report.gate || {};
const allIssues = gate.warningIssues || [];

console.log(`\nGate: ${gate.pass ? "PASS" : "FAIL"}`);
console.log(`Blocking: ${gate.blockingCount || 0}`);
console.log(`Warnings: ${gate.warningCount || 0}`);
console.log(`Total issues to categorize: ${allIssues.length}\n`);

// Categorize findings
const categories = {
  // True positives — real issues in human-edited source code
  truePositive: [],
  // False positives — in generated/bundled/minified files
  generatedNoise: [],
  // False positives — in scanner rule definitions (contain patterns by design)
  scannerRules: [],
  // False positives — in test fixtures
  testFixtures: [],
  // False positives — in temp/build scripts
  tempScripts: [],
};

const generatedPatterns = [
  /dashboard-web\/.*\/(js|js-es2018|assets|pages-publish)\//,
  /dashboard-web\/.*\.js$/,
  /dashboard-web\/.*\.tsx$/,
  /_merged_js/,
  /_test_js/,
  /_test_welcome/,
  /__tmp_wrapper/,
  /temp-script\./,
  /debug-welcome/,
  /d3\.v7\.min\.js/,
  /dashboard-wrapper\.js/,
  /simplebeacon-codemap\.js/,
  /scan-worker/,
  /\.min\./,
];

const scannerRulePatterns = [
  /packages\/simplebeacon-cli\/src\/rules\//,
  /packages\/simplebeacon-cli\/src\/lib\/remediation-templates/,
  /packages\/simplebeacon-cli\/README\.md/,
];

const testPatterns = [
  /\.test\./,
  /\.spec\./,
  /\/__tests__\//,
  /\/tests\//,
  /\/test\//,
  /e2e\//,
];

const tempPatterns = [
  /fix_auth/,
  /check-bridge/,
  /check-syntax/,
  /deep-check/,
  /extract-and-check/,
  /patch-api-base/,
  /patch-html/,
  /build-deb/,
  /build-inline/,
  /extract-worker/,
];

for (const issue of allIssues) {
  const file = issue.filePath || "";
  const entry = {
    file,
    line: issue.line,
    severity: issue.severity,
    type: issue.type,
    description: (issue.description || "").substring(0, 100),
  };

  if (generatedPatterns.some((p) => p.test(file))) {
    categories.generatedNoise.push(entry);
  } else if (scannerRulePatterns.some((p) => p.test(file))) {
    categories.scannerRules.push(entry);
  } else if (testPatterns.some((p) => p.test(file))) {
    categories.testFixtures.push(entry);
  } else if (tempPatterns.some((p) => p.test(file))) {
    categories.tempScripts.push(entry);
  } else {
    categories.truePositive.push(entry);
  }
}

// Print summary
console.log("=== Categorization Summary ===\n");
console.log(`True Positives (human-edited source):     ${categories.truePositive.length}`);
console.log(`Generated Noise (bundled/minified):       ${categories.generatedNoise.length}`);
console.log(`Scanner Rules (patterns by design):       ${categories.scannerRules.length}`);
console.log(`Test Fixtures:                            ${categories.testFixtures.length}`);
console.log(`Temp Scripts:                             ${categories.tempScripts.length}`);

const total = allIssues.length;
const fp = categories.generatedNoise.length + categories.scannerRules.length + categories.testFixtures.length + categories.tempScripts.length;
const tp = categories.truePositive.length;
const precision = total > 0 ? ((tp / total) * 100).toFixed(1) : "N/A";
const fpRate = total > 0 ? ((fp / total) * 100).toFixed(1) : "N/A";

console.log(`\n=== Precision Metrics ===`);
console.log(`Total findings:    ${total}`);
console.log(`True positives:    ${tp}`);
console.log(`False positives:   ${fp}`);
console.log(`Precision:         ${precision}%`);
console.log(`False positive rate: ${fpRate}%`);

// Print true positives for manual review
if (categories.truePositive.length > 0) {
  console.log(`\n=== True Positives (manual review needed) ===\n`);
  for (const tp of categories.truePositive) {
    console.log(`  [${tp.severity}] ${tp.file}:${tp.line} — ${tp.type}`);
    console.log(`    ${tp.description}`);
  }
}

// Write full report
const pilotReport = {
  scanDate: new Date().toISOString(),
  scanTarget: PROJECT_ROOT,
  gate: { pass: gate.pass, blocking: gate.blockingCount, warnings: gate.warningCount },
  total: total,
  truePositives: tp,
  falsePositives: fp,
  precision: precision + "%",
  falsePositiveRate: fpRate + "%",
  categories: {
    truePositive: categories.truePositive,
    generatedNoise: categories.generatedNoise,
    scannerRules: categories.scannerRules,
    testFixtures: categories.testFixtures,
    tempScripts: categories.tempScripts,
  },
};

const reportOutPath = path.join(PROJECT_ROOT, ".simplebeacon/pilot-data.json");
fs.writeFileSync(reportOutPath, JSON.stringify(pilotReport, null, 2));
console.log(`\nFull report: ${reportOutPath}`);
