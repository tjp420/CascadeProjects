#!/usr/bin/env node
/**
 * Single pre-deploy verifier for production go/no-go decisions.
 * Runs Stripe, production deploy, and trust/compliance prechecks.
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const steps = [
  {
    id: 'stripe',
    title: 'Stripe verification',
    commandString: 'npm run verify:stripe'
  },
  {
    id: 'production',
    title: 'Production deploy verification',
    commandString: 'npm run verify:production-deploy'
  },
  {
    id: 'trust',
    title: 'Trust/compliance precheck',
    commandString: 'npm run security:scan'
  }
];

function runStep(step) {
  const started = Date.now();
  try {
    const stdout = execSync(step.commandString, {
      cwd: ROOT,
      env: process.env,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return {
      ...step,
      ok: true,
      statusCode: 0,
      elapsedMs: Date.now() - started,
      stdout: String(stdout || '').trim(),
      stderr: '',
      spawnError: ''
    };
  } catch (error) {
    return {
      ...step,
      ok: false,
      statusCode: Number.isInteger(error.status) ? error.status : 1,
      elapsedMs: Date.now() - started,
      stdout: String(error.stdout || '').trim(),
      stderr: String(error.stderr || '').trim(),
      spawnError: error.message ? String(error.message) : ''
    };
  }
}

function printResult(result) {
  const tag = result.ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${result.title} (${result.elapsedMs}ms)`);
  if (result.stdout) {
    const lines = result.stdout.split(/\r?\n/).slice(-10);
    for (const line of lines) {
      console.log(`  ${line}`);
    }
  }
  if (result.stderr) {
    const lines = result.stderr.split(/\r?\n/).slice(-5);
    for (const line of lines) {
      console.log(`  [stderr] ${line}`);
    }
  }
  if (result.spawnError) {
    console.log(`  [spawn] ${result.spawnError}`);
  }
}

function printSummary(results) {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log('\n=== Pre-deploy verification summary ===');
  for (const result of results) {
    console.log(`- ${result.id}: ${result.ok ? 'PASS' : 'FAIL'} (exit=${result.statusCode})`);
  }
  const verdict = failed === 0 ? 'GO' : 'NO-GO';
  console.log(`\nDecision: ${verdict}`);
  if (failed > 0) {
    console.log('Action: fix failing step(s), then re-run `npm run verify:predeploy`.');
  }
}

function main() {
  console.log('Running pre-deploy verification sequence...');
  const results = steps.map(runStep);
  for (const result of results) {
    printResult(result);
  }
  printSummary(results);
  if (results.some((r) => !r.ok)) {
    process.exit(1);
  }
}

main();
