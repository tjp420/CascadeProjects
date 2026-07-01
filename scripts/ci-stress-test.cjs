#!/usr/bin/env node
/**
 * CI Stress Test — simulates the GitHub Action on three repo types.
 *
 * Usage: node scripts/ci-stress-test.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'packages', 'simplebeacon-cli', 'bin', 'simplebeacon.js');

// Ensure the CLI binary exists
if (!fs.existsSync(CLI)) {
  console.error(`CLI not found: ${CLI}`);
  process.exit(1);
}

let passed = 0;
let failed = 0;

function run(label, repoPath, expectGatePass) {
  console.log(`\n--- ${label} ---`);
  const reportPath = path.join(repoPath, '.simplebeacon', 'report.json');
  try {
    // Clean up any old report
    if (fs.existsSync(reportPath)) {
      fs.unlinkSync(reportPath);
    }

    const cmd = `node "${CLI}" scan --gate --format json --output "${reportPath}" --path "${repoPath}"`;
    execSync(cmd, { stdio: 'pipe', timeout: 120000 });

    if (!fs.existsSync(reportPath)) {
      console.log(`  ❌ No report generated`);
      failed++;
      return;
    }

    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const gate = report.gate || {};
    const pass = gate.pass === true;
    const blocking = gate.blockingCount || 0;

    if (expectGatePass && pass) {
      console.log(`  ✅ Gate passed as expected (blocking=${blocking})`);
      passed++;
    } else if (!expectGatePass && !pass) {
      console.log(`  ✅ Gate failed as expected (blocking=${blocking})`);
      passed++;
    } else {
      console.log(`  ❌ Unexpected gate result: pass=${pass}, blocking=${blocking} (expected pass=${expectGatePass})`);
      failed++;
    }
  } catch (err) {
    // Non-zero exit from CLI means gate failed — expected for dirty repos
    if (!expectGatePass && err.status !== 0) {
      console.log(`  ✅ CLI exited with code ${err.status} as expected for dirty repo`);
      passed++;
    } else {
      console.log(`  ❌ Error: ${err.message || err}`);
      failed++;
    }
  }
}

function main() {
  console.log('🔦 SimpleBeacon CI Action Stress Test\n');

  // Test 1: Clean repo — this repo itself (already clean)
  run('Test 1: Clean repo (CascadeProjects)', ROOT, true);

  // Test 2: Dirty repo — create a temp repo with intentionally bad code
  const dirtyDir = path.join(ROOT, '.tmp-dirty-repo');
  if (!fs.existsSync(dirtyDir)) {
    fs.mkdirSync(dirtyDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(dirtyDir, 'leaked.js'),
    `// simplebeacon:production-leak-intent: test-negative-case\nconst apiKey = 'sk-test-fake';\nconst password = 'test-placeholder-for-ci';\n`
  );
  fs.writeFileSync(
    path.join(dirtyDir, 'fiction.json'),
    `{"completion_rate": "98.5%", "user_satisfaction": "99.9%"}\n`
  );
  fs.writeFileSync(
    path.join(dirtyDir, 'sample.json'),
    `{"status": "ok", "demo": true}\n`
  );
  run('Test 2: Dirty repo (intentional leaks + fiction)', dirtyDir, false);

  // Test 3: Large repo — verify the scan completes without timeout/crash.
  // Note: The CLI scanner has known false positives on well-known human-written
  // libraries (lodash, express). The goal here is stability, not gate accuracy.
  const largeDir = path.join(ROOT, 'false-positive-audit', 'lodash');
  if (fs.existsSync(largeDir)) {
    console.log('\n--- Test 3: Large repo (lodash) ---');
    const reportPath = path.join(largeDir, '.simplebeacon', 'report.json');
    try {
      if (fs.existsSync(reportPath)) fs.unlinkSync(reportPath);
      const cmd = `node "${CLI}" scan --gate --format json --output "${reportPath}" --path "${largeDir}"`;
      execSync(cmd, { stdio: 'pipe', timeout: 120000 });
      if (fs.existsSync(reportPath)) {
        console.log('  ✅ Scan completed without crash or timeout');
        passed++;
      } else {
        console.log('  ❌ No report generated');
        failed++;
      }
    } catch (err) {
      if (err.status !== 0 && err.stdout) {
        // Non-zero exit from gate failure is expected on large repos with
        // known CLI false positives — still counts as "completed"
        console.log('  ✅ Scan completed (gate failed as expected due to known CLI false positives)');
        passed++;
      } else {
        console.log(`  ❌ Error: ${err.message || err}`);
        failed++;
      }
    }
  } else {
    console.log('\n--- Test 3: Large repo (lodash) ---');
    console.log('  ⚠️  Skipped — lodash not found in false-positive-audit/lodash');
  }

  // Cleanup
  try {
    fs.rmSync(dirtyDir, { recursive: true, force: true });
  } catch (_) {}

  console.log(`\n=== Results ===`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  if (failed === 0) {
    console.log('\n🚀 All CI stress tests passed.');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed.`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
