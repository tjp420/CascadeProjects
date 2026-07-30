/**
 * SimpleBeacon Poisoned Pipeline Benchmark — Test Assertion Script
 *
 * Verifies detection of 4 intentional flaws in simplebeacon-benchmark/:
 *   1. Hidden Stripe token (sk_live_...) in deeply nested utility file
 *   2. Crashing placeholder TODO comments with LLM preamble
 *   3. Markdown code fences (```tsx) pasted from chat interface
 *   4. EU AI Act high-risk pattern (creditworthiness + emotion detection, no logging)
 *
 * Runs both:
 *   - Production scanner: direct API (runScan) — bypasses CLI tier limits
 *   - Standalone fix script: scripts/simplebeacon-fix-standalone.cjs
 *
 * Usage: node scripts/test-poisoned-pipeline.cjs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BENCHMARK_DIR = path.join(PROJECT_ROOT, 'simplebeacon-benchmark');
const CLI_ROOT = path.join(PROJECT_ROOT, 'packages', 'simplebeacon-cli');

const EXPECTED_FLOWS = [
  {
    id: 'FLAW-1-STRIPE-TOKEN',
    file: 'src/utils/payment/providers/stripe/gate.ts',
    description: 'Hidden Stripe live key (sk_live_...) in source code',
    productionScannerExpected: true,
    standaloneFixExpected: true,
    detectionType: 'hardcoded-payment-key',
  },
  {
    id: 'FLAW-2-TODO-SLOP',
    file: 'src/controllers/apiController.ts',
    description: 'TODO placeholder comments with ChatGPT references',
    productionScannerExpected: true,
    standaloneFixExpected: true,
    detectionType: 'ai-placeholder-todo',
  },
  {
    id: 'FLAW-3-MARKDOWN-FENCE',
    file: 'src/components/DashboardWidget.tsx',
    description: 'Markdown code fences (```tsx) pasted from chat',
    productionScannerExpected: true,
    standaloneFixExpected: true,
    detectionType: 'markdown-fence-leak',
  },
  {
    id: 'FLAW-4-EU-AI-ACT',
    file: 'src/controllers/riskController.ts',
    description: 'Creditworthiness + emotion detection with no human oversight or logging',
    productionScannerExpected: true,
    standaloneFixExpected: false,
    detectionType: 'EU AI Act — High-Risk Indicator',
  },
];

function fileContains(filePath, substring) {
  try {
    return fs.readFileSync(filePath, 'utf8').includes(substring);
  } catch (e) {
    return false;
  }
}

// Verify benchmark directory exists with all 4 flawed files
function verifyBenchmarkStructure() {
  const results = { pass: true, checks: [] };
  const requiredFiles = EXPECTED_FLOWS.map(f => f.file);

  for (const relPath of requiredFiles) {
    const fullPath = path.join(BENCHMARK_DIR, relPath);
    const exists = fs.existsSync(fullPath);
    results.checks.push({ file: relPath, exists, pass: exists });
    if (!exists) results.pass = false;
  }

  const contentChecks = [
    { file: 'src/utils/payment/providers/stripe/gate.ts', substring: 'sk_live_', label: 'Stripe live key present' },
    { file: 'src/controllers/apiController.ts', substring: 'TODO: Implement the rest', label: 'TODO placeholder present' },
    { file: 'src/components/DashboardWidget.tsx', substring: '```tsx', label: 'Markdown fence (tsx) present' },
    { file: 'src/controllers/riskController.ts', substring: 'creditworthiness', label: 'Creditworthiness pattern present' },
    { file: 'src/controllers/riskController.ts', substring: 'inferEmployeeMood', label: 'Emotion detection pattern present' },
  ];

  for (const check of contentChecks) {
    const fullPath = path.join(BENCHMARK_DIR, check.file);
    const found = fileContains(fullPath, check.substring);
    results.checks.push({ label: check.label, found, pass: found });
    if (!found) results.pass = false;
  }

  return results;
}

// Run production scanner via direct API (bypasses CLI tier limits)
function runProductionScanner() {
  const results = { pass: true, checks: [], detectedFlaws: [] };

  let report;
  try {
    const { runScan } = require(path.join(CLI_ROOT, 'src', 'scan.js'));
    const scanResult = execSync(
      `node -e "const { runScan } = require('${CLI_ROOT.replace(/\\/g, '/')}/src/scan.js'); runScan('${BENCHMARK_DIR.replace(/\\/g, '/')}', { fullDirectoryScan: true, gate: true, quiet: true }).then(r => { console.log(JSON.stringify(r)); });"`,
      { cwd: BENCHMARK_DIR, timeout: 60000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    report = JSON.parse(scanResult);
  } catch (e) {
    results.checks.push({ label: 'Production scanner ran successfully', pass: false, error: e.message });
    results.pass = false;
    return results;
  }

  results.checks.push({ label: 'Production scanner ran successfully', pass: !!report });
  if (!report) { results.pass = false; return results; }

  const rawIssues = report.rawIssues || [];
  results.checks.push({ label: `Scanner found ${rawIssues.length} raw issues`, pass: rawIssues.length > 0 });

  // Check each flaw
  for (const flaw of EXPECTED_FLOWS) {
    const matching = rawIssues.filter(issue => {
      const issueType = String(issue.type || '');
      const issueFile = String(issue.filePath || issue.file || '');
      return issueType.includes(flaw.detectionType) || issueFile.includes(path.basename(flaw.file));
    });

    // More specific check: look for the detection type in issue types
    const typeMatch = rawIssues.some(issue => {
      const issueType = String(issue.type || '');
      return issueType.includes(flaw.detectionType);
    });

    results.detectedFlaws.push({
      flaw: flaw.id,
      detected: typeMatch,
      expected: flaw.productionScannerExpected,
      issueCount: matching.length,
    });
    results.checks.push({
      label: `${flaw.id}: ${flaw.detectionType} detected`,
      pass: typeMatch === flaw.productionScannerExpected,
    });
    if (typeMatch !== flaw.productionScannerExpected) results.pass = false;
  }

  return results;
}

// Run standalone fix script and check results
function runStandaloneFix() {
  const results = { pass: true, checks: [], detectedFlaws: [] };

  const scriptPath = path.join(PROJECT_ROOT, 'scripts', 'simplebeacon-fix-standalone.cjs');
  const cmd = `node "${scriptPath}" "${BENCHMARK_DIR}" 2>&1`;
  let output = '';
  try {
    output = execSync(cmd, { cwd: PROJECT_ROOT, timeout: 30000, encoding: 'utf8' });
  } catch (e) {
    output = e.stdout || e.message;
  }

  results.checks.push({ label: 'Standalone fix script ran', pass: output.length > 0 });

  const stripeDetected = output.includes('STRIPE_KEY') && output.includes('Quarantined');
  results.detectedFlaws.push({ flaw: 'FLAW-1-STRIPE-TOKEN', detected: stripeDetected });
  results.checks.push({ label: 'Stripe key quarantined', pass: stripeDetected });

  const slopDetected = output.includes('placeholder comment') || output.includes('Slop Comments Removed: 3');
  results.detectedFlaws.push({ flaw: 'FLAW-2-TODO-SLOP', detected: slopDetected });
  results.checks.push({ label: 'TODO slop comments removed', pass: slopDetected });

  const fenceDetected = output.includes('markdown code fences') && output.includes('Stripped');
  results.detectedFlaws.push({ flaw: 'FLAW-3-MARKDOWN-FENCE', detected: fenceDetected });
  results.checks.push({ label: 'Markdown fences stripped', pass: fenceDetected });

  results.detectedFlaws.push({ flaw: 'FLAW-4-EU-AI-ACT', detected: false, expected: false, note: 'Standalone script has no EU AI Act patterns' });
  results.checks.push({ label: 'EU AI Act (not in standalone scope)', pass: true });

  return results;
}

// Main
console.log('\n\x1b[1m\x1b[36m=== SimpleBeacon Poisoned Pipeline Benchmark (Post-Fix) ===\x1b[0m\n');
console.log(`Benchmark directory: ${BENCHMARK_DIR}\n`);

// Step 1: Verify structure
console.log('\x1b[1m--- Step 1: Verify Benchmark Structure ---\x1b[0m');
const structResults = verifyBenchmarkStructure();
structResults.checks.forEach(c => {
  console.log(`  ${c.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${c.label || c.file}: ${c.found || c.exists || 'checked'}`);
});
console.log(`  Overall: ${structResults.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}`);

// Step 2: Production scanner
console.log('\n\x1b[1m--- Step 2: Production Scanner (runScan direct API) ---\x1b[0m');
const prodResults = runProductionScanner();
prodResults.checks.forEach(c => {
  console.log(`  ${c.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${c.label}`);
});
console.log('\n  Flaw detection:');
prodResults.detectedFlaws.forEach(f => {
  const status = f.detected ? '\x1b[32mDETECTED\x1b[0m' : '\x1b[31mMISSED\x1b[0m';
  const expected = f.expected === false ? ' (expected: not detected)' : '';
  console.log(`    ${f.flaw}: ${status}${expected}`);
});

// Step 3: Standalone fix script
console.log('\n\x1b[1m--- Step 3: Standalone Fix Script (simplebeacon-fix-standalone.cjs) ---\x1b[0m');
const fixResults = runStandaloneFix();
fixResults.checks.forEach(c => {
  console.log(`  ${c.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'} ${c.label}`);
});
console.log('\n  Flaw detection:');
fixResults.detectedFlaws.forEach(f => {
  const status = f.detected ? '\x1b[32mDETECTED\x1b[0m' : '\x1b[31mMISSED\x1b[0m';
  const note = f.note ? ` (${f.note})` : '';
  console.log(`    ${f.flaw}: ${status}${note}`);
});

// Summary
console.log('\n\x1b[1m=== Summary ===\x1b[0m');
console.log('\n  | Flaw | Production Scanner | Standalone Fix |');
console.log('  |------|-------------------|----------------|');
EXPECTED_FLOWS.forEach(f => {
  const prodFlaw = prodResults.detectedFlaws.find(d => d.flaw === f.id);
  const fixFlaw = fixResults.detectedFlaws.find(d => d.flaw === f.id);
  const prodStatus = prodFlaw ? (prodFlaw.detected ? 'YES' : 'NO') : '?';
  const fixStatus = fixFlaw ? (fixFlaw.detected ? 'YES' : 'NO') : '?';
  console.log(`  | ${f.id} | ${prodStatus.padEnd(17)} | ${fixStatus.padEnd(14)} |`);
});

const allPass = structResults.pass && prodResults.pass && fixResults.pass;
console.log(`\n  Structure: ${structResults.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}`);
console.log(`  Production Scanner: ${prodResults.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}`);
console.log(`  Standalone Fix: ${fixResults.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}`);
console.log(`  Overall: ${allPass ? '\x1b[32mALL PASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}\n`);

process.exit(allPass ? 0 : 1);
