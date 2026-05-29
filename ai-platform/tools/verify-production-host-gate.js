#!/usr/bin/env node
/**
 * Full production host gate sequence — W1 minimum path to GO.
 * Runs verify:stripe → verify:production-deploy → verify:predeploy → verify:launch-readiness → verify:track2
 */
const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const steps = [
  { id: 'host-readiness', title: 'Host env readiness', command: 'npm run verify:production-host-readiness' },
  { id: 'stripe', title: 'Stripe verification', command: 'npm run verify:stripe' },
  { id: 'production-deploy', title: 'Production deploy verification', command: 'npm run verify:production-deploy' },
  { id: 'predeploy', title: 'Predeploy sequence', command: 'npm run verify:predeploy' },
  { id: 'launch-readiness', title: 'Launch readiness', command: 'npm run verify:launch-readiness' },
  { id: 'track2', title: 'Track 2 readiness', command: 'npm run verify:track2' }
];

function runStep(step) {
  const started = Date.now();
  try {
    const stdout = execSync(step.command, {
      cwd: ROOT,
      env: process.env,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return { ...step, ok: true, exitCode: 0, elapsedMs: Date.now() - started, stdout: String(stdout || '').trim() };
  } catch (error) {
    return {
      ...step,
      ok: false,
      exitCode: Number.isInteger(error.status) ? error.status : 1,
      elapsedMs: Date.now() - started,
      stdout: String(error.stdout || '').trim(),
      stderr: String(error.stderr || '').trim()
    };
  }
}

console.log('=== Production host gate sequence ===\n');
const results = steps.map(runStep);

for (const result of results) {
  const tag = result.ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${result.title} (${result.elapsedMs}ms)`);
  if (result.stdout) {
    for (const line of result.stdout.split(/\r?\n/).slice(-5)) {
      console.log(`  ${line}`);
    }
  }
}

const passed = results.filter((r) => r.ok).length;
const failed = results.length - passed;
console.log('\n=== Summary ===');
for (const result of results) {
  console.log(`- ${result.id}: ${result.ok ? 'PASS' : 'FAIL'}`);
}
const decision = failed === 0 ? 'GO' : 'NO-GO';
console.log(`\nDecision: ${decision}`);
if (failed > 0) {
  console.log('Fix blocking items in docs/host-production-env-setup.md and docs/stripe-webhook-setup.md');
  process.exit(1);
}
