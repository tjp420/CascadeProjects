/**
 * SimpleBeacon Multi-OS Line-Ending Integrity Suite
 * Enforces line-ending preservation during execution passes.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sandbox = path.join(__dirname, 'crlf_sandbox');
if (!fs.existsSync(sandbox)) fs.mkdirSync(sandbox);

// 1. Build Exact Target Testing File Vectors
const unixTarget = path.join(sandbox, 'mock_unix.tsx');
const winTarget = path.join(sandbox, 'mock_windows.tsx');

const sampleCodeDebt = [
  '```typescript',
  '// Here is your updated component:',
  'export const AuthGate = () => {',
  '  const token = "sk_live_51NzABC1234567890abcdefgh";',
  '  // TODO: Implement the rest of your business logic here',
  '  return <div />;',
  '}',
  '```'
];

// Write raw files with forced, immutable line splits
fs.writeFileSync(unixTarget, sampleCodeDebt.join('\n') + '\n', 'utf8');
fs.writeFileSync(winTarget, sampleCodeDebt.join('\r\n') + '\r\n', 'utf8');

console.log('Running Multi-OS CLI Integrity Test Suite...');
try {
  const binaryEntry = path.join(__dirname, '../bin/index.js');

  // 2. Trigger Remediation Mutations Over Targets
  execSync(`node "${binaryEntry}" "${unixTarget}" --write`, { stdio: 'ignore' });
  execSync(`node "${binaryEntry}" "${winTarget}" --write`, { stdio: 'ignore' });

  // 3. Extract Post-Scan Buffers from Storage Disk Arrays
  const outputUnix = fs.readFileSync(unixTarget, 'utf8');
  const outputWin = fs.readFileSync(winTarget, 'utf8');

  // Verify Line Ending Signatures Natively
  const unixMatchesCRLF = outputUnix.includes('\r\n');
  const winMatchesCRLF = outputWin.includes('\r\n');
  const winLeakedLFOnly = /(?<!\r)\n/.test(outputWin);

  console.log('\n--- SCANNING FORMATTING INTEGRITY REPORT ---');
  console.log(`[UNIX FILE] Expected: LF Only   -> Detected CRLF: ${unixMatchesCRLF}`);
  console.log(`[WIN  FILE] Expected: CRLF Only -> Detected CRLF: ${winMatchesCRLF}`);

  let testFailure = false;
  if (unixMatchesCRLF) {
    console.error('FAIL: Unix line endings modified to Windows CRLF.');
    testFailure = true;
  }
  if (!winMatchesCRLF || winLeakedLFOnly) {
    console.error('FAIL: Windows carriage returns stripped to Unix LF.');
    testFailure = true;
  }

  if (testFailure) {
    console.error('\nFormatting suite failed. Line endings were mutated.');
    process.exit(1);
  } else {
    console.log('\nPASS: Line endings preserved across operating systems.');
    process.exit(0);
  }
} catch (error) {
  console.error('Critical Testing Harness Exception:', error.message);
  process.exit(1);
} finally {
  // Graceful cleanup of temporary directory fixtures
  try {
    fs.unlinkSync(unixTarget);
    fs.unlinkSync(winTarget);
    fs.rmdirSync(sandbox);
  } catch (cleanError) {}
}
