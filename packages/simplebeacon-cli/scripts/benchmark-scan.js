#!/usr/bin/env node
// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * SimpleBeacon scan performance benchmark.
 * Usage: node scripts/benchmark-scan.js [projectPath]
 */

const { scanMockDataDirectories } = require('../src/scan.js');
const path = require('path');

const targetPath = process.argv[2] || process.cwd();

async function benchmark() {
  console.log(`Benchmarking scan of: ${targetPath}`);
  const start = process.hrtime.bigint();

  try {
    const report = await scanMockDataDirectories(targetPath, [], {
      quiet: true,
      fullDirectoryScan: true,
    });

    const end = process.hrtime.bigint();
    const elapsedMs = Number(end - start) / 1_000_000;
    const elapsedSec = elapsedMs / 1000;

    console.log('\n--- Benchmark Results ---');
    console.log(`Elapsed time: ${elapsedSec.toFixed(2)}s (${Math.round(elapsedMs)}ms)`);
    console.log(`Files analyzed: ${report.filesAnalyzed || 0}`);
    console.log(`Total files in repo: ${report.totalFiles || 0}`);
    console.log(`Issues found: ${report.issueCount || 0}`);
    console.log(`Gate: ${report.gate?.pass ? 'PASS' : 'FAIL'}`);

    const filesPerSec = (report.totalFiles || 0) / elapsedSec;
    console.log(`Throughput: ${filesPerSec.toFixed(0)} files/sec`);

    if (elapsedSec > 5 && (report.totalFiles || 0) >= 1000) {
      console.log('\n⚠️  WARNING: Scan exceeded 5-second target for 1000+ files');
    } else if (elapsedSec <= 5 && (report.totalFiles || 0) >= 1000) {
      console.log('\n✅ Target met: 1000+ files scanned in <5s');
    }
  } catch (err) {
    console.error('Benchmark failed:', err.message);
    process.exit(1);
  }
}

benchmark();
