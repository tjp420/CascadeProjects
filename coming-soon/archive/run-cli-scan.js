/**
 * run-cli-scan.js
 * Runs SimpleBeacon CLI scan on the entire repo and copies report to the server.
 * Bypasses browser file-count limits entirely.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(PROJECT_ROOT, '.simplebeacon', 'report.json');
const SERVER_REPORT = path.join(__dirname, 'report.json');

function runScan() {
  console.log('Running SimpleBeacon CLI scan on full repository...');
  console.log(`Target: ${PROJECT_ROOT}`);
  console.log('');

  try {
    // Run the CLI scan with full coverage and gate
    const cmd = `npx simplebeacon scan --full --gate --format json --output "${REPORT_PATH}"`;
    console.log(`> ${cmd}`);
    execSync(cmd, { cwd: PROJECT_ROOT, stdio: 'inherit' });
  } catch (err) {
    // CLI may exit with non-zero if gate fails — that's expected
    console.log('');
    console.log('Scan process completed (non-zero exit is normal if gate fails).');
  }

  // Check if report was generated
  if (fs.existsSync(REPORT_PATH)) {
    // Copy to server directory for easy access
    fs.copyFileSync(REPORT_PATH, SERVER_REPORT);
    console.log('');
    console.log(`✅ Report generated: ${REPORT_PATH}`);
    console.log(`✅ Copied to: ${SERVER_REPORT}`);

    // Quick summary
    const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
    console.log('');
    console.log('=== SCAN SUMMARY ===');
    console.log(`Gate: ${report.gate?.status || 'unknown'}`);
    console.log(`Quality Score: ${report.qualityScore || 'N/A'}`);
    console.log(`Total Files: ${report.totalFiles || 'N/A'}`);
    console.log(`Issue Count: ${report.issueCount || 'N/A'}`);
    console.log(`Blocking: ${report.gate?.blockingCount || 0}`);
    console.log('');
    console.log('Next steps:');
    console.log('1. Open the dashboard: node server.cjs');
    console.log('2. Visit http://localhost:3001/upload.html');
    console.log('3. Paste your token and click "Generate Certificate"');
  } else {
    console.error('❌ Report not found. Check CLI output above for errors.');
    process.exit(1);
  }
}

runScan();
