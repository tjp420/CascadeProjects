#!/usr/bin/env node
/**
 * SimpleBeacon Beta Verification Script
 *
 * One-command install + verification for external beta testers.
 * Tests the 4 detection engines against a self-contained poisoned pipeline.
 *
 * Usage:
 *   npx simplebeacon-beta-verify
 *   node beta-verify.cjs
 *
 * What it does:
 *   1. Verifies Node.js >= 18 is available
 *   2. Creates a temporary poisoned-pipeline directory with 4 known flaws
 *   3. Runs the SimpleBeacon scanner against it
 *   4. Asserts all 4 flaws are detected
 *   5. Reports pass/fail and cleans up
 *
 * No network access required. No code upload. All verification is local.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const BANNER = `
\x1b[1m\x1b[36m========================================\x1b[0m
\x1b[1m  SimpleBeacon Beta Verification Script\x1b[0m
\x1b[1m  Local Detection Engine Test Suite\x1b[0m
\x1b[1m\x1b[36m========================================\x1b[0m
`;

const FLAWS = [
  {
    id: 'FLAW-1',
    name: 'Stripe sk_live_ key in source code',
    file: 'src/utils/stripe-gate.ts',
    content: [
      '// Stripe payment gateway',
      'const STRIPE_SECRET_KEY = "sk_live_51NzABC1234567890abcdefghIJ";',
      '',
      'export async function createPaymentIntent(amount: number) {',
      '  return fetch("https://api.stripe.com/v1/payment_intents", {',
      '    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },',
      '  });',
      '}',
    ].join('\n'),
    detectionType: 'hardcoded-payment-key',
    expected: true,
  },
  {
    id: 'FLAW-2',
    name: 'AI-generated TODO placeholder with ChatGPT reference',
    file: 'src/controllers/apiController.ts',
    content: [
      '// API Controller',
      '// TODO: Implement the rest of your business logic here. ChatGPT told me this endpoint handles pagination.',
      '',
      'export async function fetchPaginatedData(endpoint: string) {',
      '  return fetch(endpoint);',
      '}',
    ].join('\n'),
    detectionType: 'ai-placeholder-todo',
    expected: true,
  },
  {
    id: 'FLAW-3',
    name: 'Markdown code fences (tsx) pasted from chat',
    file: 'src/components/Widget.tsx',
    content: [
      '```tsx',
      'import React from "react";',
      'export const Widget: React.FC = () => {',
      '  return <div>Hello</div>;',
      '};',
      '```',
    ].join('\n'),
    detectionType: 'markdown-fence-leak',
    expected: true,
  },
  {
    id: 'FLAW-4',
    name: 'EU AI Act high-risk pattern (creditworthiness + emotion detection)',
    file: 'src/controllers/riskController.ts',
    content: [
      '// Risk assessment controller',
      '// Uses LLM to predict creditworthiness and infer employee mood',
      'import { OpenAI } from "openai";',
      'const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });',
      '',
      'export async function assessCreditworthiness(data: any) {',
      '  const r = await client.chat.completions.create({',
      '    model: "gpt-4",',
      '    messages: [{ role: "system", content: "Evaluate creditworthiness." }],',
      '  });',
      '  return r.choices[0].message.content;',
      '}',
      '',
      'export async function inferEmployeeMood(responses: string) {',
      '  const r = await client.chat.completions.create({',
      '    model: "gpt-4",',
      '    messages: [{ role: "system", content: "Analyze employee emotional state." }],',
      '  });',
      '  return r.choices[0].message.content;',
      '}',
    ].join('\n'),
    detectionType: 'EU AI Act',
    expected: true,
  },
];

function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  if (major < 18) {
    console.error(`\x1b[31m[FAIL]\x1b[0m Node.js ${version} detected. SimpleBeacon requires Node.js >= 18.`);
    console.error('       Download from https://nodejs.org/');
    process.exit(1);
  }
  console.log(`\x1b[32m[PASS]\x1b[0m Node.js ${version} detected`);
}

function createPoisonedPipeline(tempDir) {
  console.log('\n\x1b[1m--- Step 1: Create poisoned pipeline test repo ---\x1b[0m');
  for (const flaw of FLAWS) {
    const fullPath = path.join(tempDir, flaw.file);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, flaw.content + '\n');
    console.log(`  Created ${flaw.file} (${flaw.name})`);
  }
  console.log(`\n  Test repo: ${tempDir}`);
}

function resolveScannerPath() {
  // Try local package first, then npx
  const localPath = path.join(__dirname, '..', 'packages', 'simplebeacon-cli', 'src', 'scan.js');
  if (fs.existsSync(localPath)) {
    return { type: 'local', scanPath: localPath };
  }
  // Try node_modules
  const nmPath = path.join(__dirname, 'node_modules', 'simplebeacon', 'src', 'scan.js');
  if (fs.existsSync(nmPath)) {
    return { type: 'local', scanPath: nmPath };
  }
  return { type: 'npx', scanPath: null };
}

function runScanner(tempDir) {
  console.log('\n\x1b[1m--- Step 2: Run SimpleBeacon scanner ---\x1b[0m');
  const { type, scanPath } = resolveScannerPath();

  let report;
  if (type === 'local') {
    console.log(`  Using local scanner: ${scanPath}`);
    const { runScan } = require(scanPath);
    report = runScan(tempDir, { fullDirectoryScan: true, gate: true, quiet: true });
    if (report && report.then) {
      // runScan may be async
      const start = process.hrtime.bigint();
      report = execSync(
        `node -e "const { runScan } = require('${scanPath.replace(/\\/g, '/')}'); runScan('${tempDir.replace(/\\/g, '/')}', { fullDirectoryScan: true, gate: true, quiet: true }).then(r => console.log(JSON.stringify(r)));"`,
        { timeout: 60000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );
      report = JSON.parse(report);
    }
  } else {
    console.log('  Using npx simplebeacon...');
    const output = execSync(
      `npx simplebeacon scan --full --gate --format json`,
      { cwd: tempDir, timeout: 60000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    report = JSON.parse(output);
  }

  if (!report) {
    console.error('  \x1b[31m[FAIL]\x1b[0m Scanner did not return a report');
    process.exit(1);
  }

  const rawIssues = report.rawIssues || [];
  const elapsedMs = report.totalScanDurationMs || 0;
  console.log(`  Scanned ${report.totalFiles} files in ${elapsedMs}ms`);
  console.log(`  Found ${rawIssues.length} raw issues`);
  return report;
}

function verifyDetection(report) {
  console.log('\n\x1b[1m--- Step 3: Verify all 4 flaws detected ---\x1b[0m');
  const rawIssues = report.rawIssues || [];
  let allPass = true;

  for (const flaw of FLAWS) {
    const detected = rawIssues.some(issue => {
      const issueType = String(issue.type || '');
      return issueType.includes(flaw.detectionType);
    });

    const pass = detected === flaw.expected;
    const status = pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    const detectedLabel = detected ? 'DETECTED' : 'MISSED';
    console.log(`  [${status}] ${flaw.id}: ${flaw.name} — ${detectedLabel}`);
    if (!pass) allPass = false;
  }

  return allPass;
}

function cleanup(tempDir) {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`\n  Cleaned up ${tempDir}`);
  } catch (e) {
    console.log(`\n  \x1b[33mWarning:\x1b[0m Could not clean up ${tempDir} — remove manually`);
  }
}

// Main
console.log(BANNER);

checkNodeVersion();

const tempDir = path.join(os.tmpdir(), `simplebeacon-beta-verify-${Date.now()}`);
createPoisonedPipeline(tempDir);

const report = runScanner(tempDir);

const allPass = verifyDetection(report);

cleanup(tempDir);

console.log('\n\x1b[1m=== Result ===\x1b[0m');
if (allPass) {
  console.log('  \x1b[32mALL 4 FLAWS DETECTED — Detection engine verified.\x1b[0m');
  console.log('\n  The SimpleBeacon scanner successfully identified:');
  console.log('    - Hardcoded payment provider keys in source code');
  console.log('    - AI-generated placeholder TODO comments');
  console.log('    - Markdown code fences from chat interfaces');
  console.log('    - EU AI Act high-risk compliance violations');
  console.log('\n  Ready for production use. Run `npx simplebeacon scan --gate` in your project.');
  process.exit(0);
} else {
  console.log('  \x1b[31mSOME FLAWS WERE NOT DETECTED — Review failures above.\x1b[0m');
  process.exit(1);
}
