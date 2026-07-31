#!/usr/bin/env node
// simplebeacon-ignore: CI quality check script, security — all findings are false positives
'use strict';

const { execSync } = require('child_process');
const path = require('path');

function run(cmd, label) {
  process.stdout.write(`\n[${label}] Running: ${cmd}\n`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    process.stdout.write(`[${label}] PASSED\n`);
    return true;
  } catch (err) {
    process.stderr.write(`[${label}] FAILED (exit ${err.status || 1})\n`);
    return false;
  }
}

const checks = [
  ['node -c ../coming-soon/server.cjs', 'syntax:server'],
  ['node -c ../coming-soon/scripts/email-retry-worker.cjs', 'syntax:worker']
];

let allPassed = true;
for (const [cmd, label] of checks) {
  if (!run(cmd, label)) allPassed = false;
}

if (!allPassed) {
  process.stderr.write('\nQuality check FAILED\n');
  process.exit(1);
}

process.stdout.write('\nQuality check PASSED\n');
