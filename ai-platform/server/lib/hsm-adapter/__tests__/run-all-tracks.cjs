'use strict';

/**
 * Master test suite wrapper for Tracks 26–42.
 *
 * Runs the full suite of track-level Jest tests and prints
 * a consolidated summary.
 *
 * Usage:
 *   cd ai-platform && npx jest --testPathPattern="__tests__/run-all-tracks"
 *   or
 *   node ai-platform/server/lib/hsm-adapter/__tests__/run-all-tracks.cjs
 */

const { execSync } = require('child_process');

const SUITES = [
  'dkg-zk-snark',
  'post-quantum-threshold',
  'confidential-computing',
  'zk-rollup-accumulator',
  'pqc-identity-ratchet',
  'governance-derivation',
  'shard-sync',
  'cluster-recovery',
  'cluster-shard-migration',
  'cluster-key-reconciliation',
  'zk-proof-of-assets',
  'multiparty-rekeying',
  'encrypted-p2p-routing',
  'threshold-account-recovery',
  'distributed-consensus',
  'hardware-enclave',
  'dynamic-resharding',
  'disaster-recovery',
  'confidential-issuance',
  'cross-tenant-audit',
];

function runSuite(pattern) {
  try {
    const output = execSync(`npx jest ${pattern} --silent`, {
      cwd: __dirname + '/../../..',
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return { pattern, status: 'PASS', output };
  } catch (err) {
    return { pattern, status: 'FAIL', output: err.stdout || err.message };
  }
}

const results = SUITES.map((pattern) => runSuite(pattern));

let passed = 0;
let failed = 0;
for (const r of results) {
  if (r.status === 'PASS') passed += 1;
  else failed += 1;
  console.log(`${r.status}: ${r.pattern}`);
}

console.log(`\nTotal: ${SUITES.length} | Passed: ${passed} | Failed: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
