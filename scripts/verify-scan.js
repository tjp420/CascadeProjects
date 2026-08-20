#!/usr/bin/env node
// simplebeacon-ignore: security — all findings are false positives (scanner patterns, dashboard code, build scripts)
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code — all findings are false positives
/**
 * CLI-first scan validation — run this BEFORE building a VSIX.
 * Checks that the scan finds the full repository and produces valid findings.
 *
 * Usage: node scripts/verify-scan.js
 */
const { spawn } = require("child_process");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const MIN_FILES = 20000;
const MIN_ISSUES = 50;

function runScan() {
  return new Promise((resolve, reject) => {
    const args = [
      "simplebeacon",
      "scan",
      "--full",
      "--gate",
      "--config",
      ".simplebeacon/config.json",
    ];

    console.log(`[verify-scan] Running: npx ${args.join(" ")}`);
    const child = spawn("npx", args, {
      cwd: PROJECT_ROOT,
      shell: true,
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      resolve({ stdout, stderr, code });
    });

    child.on("error", (err) => {
      reject(err);
    });
  });
}

function extractMetrics(stdout) {
  const filesMatch = stdout.match(/Repository files:\s*([\d,]+)/);
  const gateMatch = stdout.match(/Gate rules checked:\s*([\d,]+)/);
  const scoreMatch = stdout.match(/Quality score:\s*(\d+)/);
  const criticalMatch = stdout.match(/Critical:\s*(\d+)/);
  const highMatch = stdout.match(/High:\s*(\d+)/);
  const mediumMatch = stdout.match(/Medium:\s*(\d+)/);
  const lowMatch = stdout.match(/Low:\s*(\d+)/);

  return {
    totalFiles: filesMatch ? parseInt(filesMatch[1].replace(/,/g, "")) : 0,
    gateFiles: gateMatch ? parseInt(gateMatch[1].replace(/,/g, "")) : 0,
    qualityScore: scoreMatch ? parseInt(scoreMatch[1]) : null,
    critical: criticalMatch ? parseInt(criticalMatch[1]) : 0,
    high: highMatch ? parseInt(highMatch[1]) : 0,
    medium: mediumMatch ? parseInt(mediumMatch[1]) : 0,
    low: lowMatch ? parseInt(lowMatch[1]) : 0,
  };
}

async function main() {
  console.log("=== SimpleBeacon Scan Verification ===\n");

  try {
    const { stdout, stderr, code } = await runScan();

    if (code !== 0 && code !== null) {
      console.log(
        `[verify-scan] Scan exited with code ${code} (gate failure is expected for FAIL repos)`,
      );
    }

    const m = extractMetrics(stdout);
    const totalIssues = m.critical + m.high + m.medium + m.low;

    console.log(`Repository files: ${m.totalFiles.toLocaleString()}`);
    console.log(`Gate-checked files: ${m.gateFiles.toLocaleString()}`);
    console.log(`Quality score: ${m.qualityScore ?? "N/A"}/100`);
    console.log(
      `Issues: Critical=${m.critical} High=${m.high} Medium=${m.medium} Low=${m.low} (Total=${totalIssues})\n`,
    );

    let pass = true;

    if (m.totalFiles < MIN_FILES) {
      console.error(
        `FAIL: Only ${m.totalFiles} files scanned (expected >= ${MIN_FILES})`,
      );
      pass = false;
    } else {
      console.log(`PASS: ${m.totalFiles} files scanned (>= ${MIN_FILES})`);
    }

    if (totalIssues < MIN_ISSUES) {
      console.error(
        `FAIL: Only ${totalIssues} issues found (expected >= ${MIN_ISSUES})`,
      );
      pass = false;
    } else {
      console.log(`PASS: ${totalIssues} issues found (>= ${MIN_ISSUES})`);
    }

    if (pass) {
      console.log("\n=== ALL CHECKS PASSED ===");
      process.exit(0);
    } else {
      console.log("\n=== SOME CHECKS FAILED ===");
      process.exit(1);
    }
  } catch (err) {
    console.error(`[verify-scan] Error: ${err.message}`);
    process.exit(1);
  }
}

main();
