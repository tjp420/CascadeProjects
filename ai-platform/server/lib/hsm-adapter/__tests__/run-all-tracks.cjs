'use strict';

/**
 * Master test suite wrapper for Tracks 26–42.
 *
 * Usage:
 *   cd ai-platform && node server/lib/hsm-adapter/__tests__/run-all-tracks.cjs
 *   cd ai-platform && node server/lib/hsm-adapter/__tests__/run-all-tracks.cjs --all
 */

const { execSync } = require('child_process');

// Curated, blocking CI gate: tracks that are implemented and passing.
const IMPLEMENTED_TRACKS = [
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
];

// Future/informational tracks: run only with --all.
const FUTURE_TRACKS = [
  'dynamic-resharding',
  'disaster-recovery',
  'confidential-issuance',
  'cross-tenant-audit',
  'homomorphic-computation',
  'hardware-root-rotation',
  'pqc-asset-bridge',
  'homomorphic-db-lookup',
  'zk-cross-chain-settlement',
  'pqc-identity-hub',
  'zk-access-token-attestation',
  'homomorphic-key-sharding',
  'mpc-gated-decryption',
  'encrypted-deduplication',
  'encrypted-search-routing',
  'pq-identity-accumulator',
  'pqc-vesting-locks',
  'pqc-cross-chain-governance',
  'pqc-homomorphic-identity-bridge',
  'pq-identity-revocation',
  'pq-time-locked-matrix',
  'pq-blind-option-pools',
  'pq-prediction-markets',
  'pq-fractional-custody',
  'pq-lending-pools',
  'pq-insurance-underwriting',
  'pq-supply-chain-escrow',
  'pq-real-estate-tokenization',
  'pq-carbon-tokenization',
  'pq-identity-gating',
  'pq-health-data-gating',
  'pq-education-credential-gating',
  'pq-patent-verification-gating',
  'pq-energy-certificate-gating',
  'pq-supply-chain-provenance-gating',
  'pq-biometric-verification-gating',
  'pq-financial-derivatives-gating',
  'pq-clinical-trial-verification-gating',
  'pq-vrf-audit-sortition-gating',
  'pq-cross-border-logistics-gating',
  'pq-ai-model-training-gating',
  'pq-scientific-reproducibility-gating',
  'pq-dao-treasury-management-gating',
  'pq-telecom-routing-gating',
  'pq-health-insurance-claim-auditing-gating',
  'pq-space-asset-telemetry-gating',
  'pq-water-rights-allocation-gating',
  'pq-nuclear-safeguards-monitoring-gating',
  'pq-wildlife-conservation-tracking-gating',
  'pq-smart-grid-micro-transaction-gating',
  'pq-global-health-epidemiological-surveillance-gating',
  'pq-cultural-heritage-provenance-gating',
  'pq-ocean-fisheries-allocation-gating',
  'pq-deep-sea-mineral-rights-gating',
  'pq-polar-research-data-gating',
  'pq-stratospheric-aerosol-monitoring-gating',
  'confidential-federated-learning',
  'he-mesh-topology',
  'secure-inner-product-search',
  'zk-range-proof-solvency',
  'threshold-decryption-circuit',
  'vss-pss-engine',
  'oram-engine',
  'zk-snark-verifier-engine',
  'multi-key-fhe-relinearization-engine',
  'vdf-time-lock-engine',
  'mixnet-blind-transaction-engine',
  'recursive-proof-aggregation-engine',
];

const runAll = process.argv.includes('--all');
const SUITES = runAll ? [...IMPLEMENTED_TRACKS, ...FUTURE_TRACKS] : IMPLEMENTED_TRACKS;

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

if (!runAll) {
  console.log(`\nRun with --all to execute the ${FUTURE_TRACKS.length} future/informational suites.`);
}

process.exit(failed > 0 ? 1 : 0);
