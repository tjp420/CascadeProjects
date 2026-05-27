#!/usr/bin/env node
/**
 * Launch readiness framework runner for go/no-go.
 * Executes critical-path checks sequentially and writes a machine-readable summary.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, '.simplebeacon');
const OUT_PATH = path.join(OUT_DIR, 'launch-readiness-summary.json');

const checks = [
  { id: 'predeploy', title: 'Predeploy sequence', command: 'npm run verify:predeploy' },
  { id: 'compliance', title: 'Compliance gate', command: 'npm run compliance:check' },
  { id: 'trust-env', title: 'Trust environment validation', command: 'npm run trust:validate-env' },
  { id: 'trust-publish', title: 'Trust publish', command: 'npm run trust:publish' },
  { id: 'trust-trend', title: 'Trust trend', command: 'npm run trust:trend' }
];

function runCheck(check) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  try {
    const stdout = execSync(check.command, {
      cwd: ROOT,
      env: process.env,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return {
      id: check.id,
      title: check.title,
      command: check.command,
      startedAt,
      elapsedMs: Date.now() - started,
      ok: true,
      exitCode: 0,
      stdoutTail: String(stdout || '').trim().split(/\r?\n/).slice(-12),
      stderrTail: []
    };
  } catch (error) {
    return {
      id: check.id,
      title: check.title,
      command: check.command,
      startedAt,
      elapsedMs: Date.now() - started,
      ok: false,
      exitCode: Number.isInteger(error.status) ? error.status : 1,
      stdoutTail: String(error.stdout || '').trim().split(/\r?\n/).slice(-12),
      stderrTail: String(error.stderr || '').trim().split(/\r?\n/).slice(-8)
    };
  }
}

function printCheck(result) {
  const tag = result.ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${result.title} (${result.elapsedMs}ms)`);
}

function main() {
  console.log('Running launch readiness framework...');
  const results = checks.map(runCheck);
  results.forEach(printCheck);

  const failed = results.filter((r) => !r.ok);
  const summary = {
    type: 'simplebeacon-launch-readiness-summary',
    generatedAt: new Date().toISOString(),
    passed: results.length - failed.length,
    failed: failed.length,
    total: results.length,
    decision: failed.length === 0 ? 'GO' : 'NO-GO',
    checks: results
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log('\n=== Launch readiness summary ===');
  for (const result of results) {
    console.log(`- ${result.id}: ${result.ok ? 'PASS' : 'FAIL'} (exit=${result.exitCode})`);
  }
  console.log(`Decision: ${summary.decision}`);
  console.log(`Artifact: ${OUT_PATH}`);

  if (summary.decision !== 'GO') {
    process.exit(1);
  }
}

main();
