#!/usr/bin/env node
/**
 * Test wrapper for SimpleBeacon CLI scan.
 * Bypasses developer-tier JSON restrictions by calling the scan API directly.
 */
const path = require('path');
const { runScan, loadSimplebeaconConfig } = require('./../packages/simplebeacon-cli/src/index');

async function main() {
  const targetPath = process.argv[2];
  if (!targetPath) {
    console.error('Usage: node test_scan_wrapper.js <path>');
    process.exit(1);
  }

  // Resolve absolute path
  const scanRoot = path.resolve(targetPath);

  // Load config (or use defaults if none exists)
  let config;
  try {
    config = loadSimplebeaconConfig(scanRoot, null);
  } catch {
    config = {};
  }
  // Ensure all files in the mock repo are scanned
  config.fullDirectoryScan = true;
  config.scanPaths = [scanRoot];
  config.productionPaths = [scanRoot];

  const report = await runScan(scanRoot, { config, fullDirectoryScan: true });

  // Output raw JSON to stdout
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
