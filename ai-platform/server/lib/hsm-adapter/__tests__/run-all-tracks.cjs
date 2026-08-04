'use strict';

/**
 * Master test suite wrapper for Tracks 26–112.
 *
 * Runs the full suite of track-level Jest tests and prints
 * a consolidated summary.
 *
 * Usage:
 *   cd ai-platform && npx jest --testPathPattern="__tests__/run-all-tracks"
 *   or
 *   node ai-platform/server/lib/hsm-adapter/__tests__/run-all-tracks.cjs
 *   or (parallel mode)
 *   node ai-platform/server/lib/hsm-adapter/__tests__/run-all-tracks.cjs --parallel
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
  'pq-orbital-debris-tracking-gating',
  'pq-genomic-privacy-compliance-gating',
  'pq-quantum-sensor-calibration-gating',
  'pq-neural-network-inference-integrity-gating',
  'pq-autonomous-vehicle-fleet-coordination-gating',
  'pq-supply-chain-resilience-integrity-gating',
  'pq-smart-contract-verifiable-execution-gating',
  'pq-decentralized-identity-proof-gating',
  'pq-cross-shard-asset-teleportation-gating',
  'pq-decentralized-energy-grid-balancing-gating',
  'pq-space-based-laser-communication-mesh-gating',
  'pq-quantum-key-distribution-link-switch-gating',
  'pq-holographic-storage-content-addressable-gating',
  'pq-zk-decentralized-storage-attestation-gating',
  'pq-bio-digital-interface-neural-telemetry-gating',
  'pq-autonomous-drone-swarm-mesh-routing-gating',
  'pq-swarm-robotics-kinetic-assembly-gating',
  'pq-multi-enclave-confidential-mesh-state-reconciliation-gating',
  'cluster-keyring-primitive-authorization',
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
  'lookup-gating',
  'tenant-boundary-saturation',
  'track32-multi-tenant-fuzz',
  'track113-endpoint-integration',
  'shard-reconciler',
  'track32-primitive-groundwork',
  'track32-core-gating',
  'hsm-vault-ring-gating-routes',
  'track33-primitive-groundwork',
  'track33-core-gating',
  'track33-multi-tenant-fuzz',
  'hsm-vault-accumulator-gating-routes',
  'track114-primitive-groundwork',
  'track114-core-gating',
  'track114-multi-tenant-fuzz',
  'hsm-vault-lattice-vss-routes',
  'track115-primitive-groundwork',
  'track115-core-gating',
  'track115-multi-tenant-fuzz',
  'hsm-vault-lattice-vfhss-routes',
  'track115-prometheus-alerts',
  'track116-primitive-groundwork',
  'track116-core-integration',
  'track116-multi-tenant-fuzz',
  'hsm-vault-cluster-isolation-routes',
  'track116-prometheus-alerts',
  'track117-primitive-groundwork',
  'track117-core-integration',
];

function resolveBaseTestFile(pattern) {
  const files = fs.readdirSync(__dirname)
    .filter((f) =>
      f.endsWith('.test.cjs') &&
      !f.includes('-extensions') &&
      !f.includes('-stress') &&
      f.replace(/\.test\.cjs$/, '').includes(pattern)
    )
    .sort((a, b) => a.length - b.length);
  return files[0] ? `server/lib/hsm-adapter/__tests__/${files[0]}` : pattern;
}

function runSuite(pattern) {
  const target = resolveBaseTestFile(pattern);
  try {
    const output = execSync(`npx jest ${target} --silent --coverage=false`, {
      cwd: __dirname + '/../../..',
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    return { pattern, status: 'PASS', output };
  } catch (err) {
    return { pattern, status: 'FAIL', output: err.stdout || err.message };
  }
}

const useParallel = process.argv.includes('--parallel');

if (useParallel) {
  const { runSuitesParallel } = require('./parallel-track-runner.cjs');
  runSuitesParallel(SUITES, { progress: true }).then(({ results, totalMs, passed, failed, throughput }) => {
    for (const r of results) {
      console.log(`${r.status}: ${r.pattern} (${r.durationMs}ms)`);
    }
    const seconds = (totalMs / 1000).toFixed(1);
    const tps = throughput.toFixed(1);
    console.log(`\nTotal: ${SUITES.length} | Passed: ${passed} | Failed: ${failed} | Time: ${seconds}s | Throughput: ${tps} suites/s`);
    process.exit(failed > 0 ? 1 : 0);
  });
} else {
  const results = SUITES.map((pattern) => runSuite(pattern));

  let passed = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === 'PASS') {
      passed += 1;
      console.log(`${r.status}: ${r.pattern}`);
    } else {
      failed += 1;
      console.log(`${r.status}: ${r.pattern}`);
      if (r.output) {
        console.log(`  --- error output ---`);
        const lines = String(r.output).split('\n').slice(0, 30);
        for (const line of lines) console.log(`  ${line}`);
        console.log(`  --- end error output ---`);
      }
    }
  }

  console.log(`\nTotal: ${SUITES.length} | Passed: ${passed} | Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}
