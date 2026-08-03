'use strict';

/**
 * Track 115 high-throughput cross-enclave mesh saturation simulation.
 *
 * Orchestrates three progressive load stages against the mesh reconciliation
 * gating hub and reports latency, throughput, and 10-second window behavior.
 *
 * Usage: node __tests__/mesh-saturation-simulation.cjs
 */

const { fork } = require('child_process');
const { performance } = require('perf_hooks');
const os = require('os');
const path = require('path');
const { PqcMultiEnclaveConfidentialMeshStateReconciliationGatingHub } = require('../pqc-multi-enclave-confidential-mesh-state-reconciliation-gating-hub.cjs');
const { ZkMeshReconciliationClaimValidator } = require('../zk-mesh-reconciliation-claim-validator.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

const WORKER_PATH = path.join(__dirname, 'mesh-load-worker.cjs');
const DEFAULT_POLICY = {
  minMeshQuorum: 50,
  maxEpochFinalityWindowSeconds: 10,
  maxReconciliationChainDepth: 100,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  allowedAttestationAuthorities: ['mock-authority'],
  requireMeshReconciliationAuthorityInitializerAttestation: false,
  requireMeshEthicsOversightCommitteeAttestation: false,
};

function now() {
  return performance.now();
}

function reportStage(name, metrics) {
  console.log(`\n=== ${name} ===`);
  console.log(`  elapsedMs:       ${metrics.elapsedMs.toFixed(2)}`);
  console.log(`  operations:      ${metrics.operations}`);
  console.log(`  throughput:      ${metrics.throughput.toFixed(2)} ops/sec`);
  console.log(`  peakRssMB:       ${(metrics.peakRssMB).toFixed(2)}`);
  console.log(`  validated:       ${metrics.validated}`);
  console.log(`  dropped:         ${metrics.dropped}`);
  console.log(`  averageMs:       ${metrics.averageMs.toFixed(4)}`);
}

async function runWorker(workerId, batchSize, delayMs, timestampOffsetMs, reconcileValid) {
  return new Promise((resolve, reject) => {
    const child = fork(WORKER_PATH, [], { silent: true });
    child.on('message', (msg) => {
      if (msg.type === 'batch_complete') {
        resolve({
          workerId: msg.workerId,
          durationMs: msg.durationMs,
          validated: msg.validated,
          dropped: msg.dropped,
          batchSize: msg.batchSize,
        });
      }
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker ${workerId} exited with code ${code}`));
      }
    });
    child.send({ type: 'run_batch', workerId, batchSize, delayMs, timestampOffsetMs, reconcileValid });
  });
}

async function stage1Baseline() {
  hsmMetrics.reset();
  const hub = new PqcMultiEnclaveConfidentialMeshStateReconciliationGatingHub({ policy: DEFAULT_POLICY });
  const start = now();
  const initialRss = process.memoryUsage.rss();
  let peakRss = initialRss;

  for (let i = 0; i < 1000; i += 1) {
    const pool = hub.initializePool({
      blindedConfidentialStateReconciliationDigestCommitment: `state-${i}`,
      blindedEpochFinalityCommitment: `finality-${i}`,
      pqcSignatureScheme: 'ML-DSA-87',
    });
    hub.reconcileMeshState({ poolId: pool.poolId, proofValid: true });

    const rss = process.memoryUsage.rss();
    if (rss > peakRss) peakRss = rss;
  }

  const elapsed = now() - start;
  const metrics = hsmMetrics.getMetrics();
  return {
    elapsedMs: elapsed,
    operations: 1000,
    throughput: 1000 / (elapsed / 1000),
    peakRssMB: (peakRss - initialRss) / 1024 / 1024,
    validated: metrics.hsm_zk_mesh_state_reconciled_total || 0,
    dropped: metrics.hsm_meshgate_challenge_issued_total || 0,
    averageMs: elapsed / 1000,
  };
}

async function stage2BurstSaturation() {
  const concurrency = os.cpus().length;
  const totalOps = 5000;
  const perWorker = Math.ceil(totalOps / concurrency);
  const start = now();
  const initialRss = process.memoryUsage.rss();
  let peakRss = initialRss;

  const workers = [];
  for (let i = 0; i < concurrency; i += 1) {
    workers.push(runWorker(i, perWorker, 0, 0, true));
  }

  const results = await Promise.all(workers);

  const finalRss = process.memoryUsage.rss();
  if (finalRss > peakRss) peakRss = finalRss;

  const elapsed = now() - start;
  const total = results.reduce((acc, r) => ({
    operations: acc.operations + r.batchSize,
    validated: acc.validated + r.validated,
    dropped: acc.dropped + r.dropped,
  }), { operations: 0, validated: 0, dropped: 0 });

  return {
    elapsedMs: elapsed,
    operations: total.operations,
    throughput: total.operations / (elapsed / 1000),
    peakRssMB: (peakRss - initialRss) / 1024 / 1024,
    validated: total.validated,
    dropped: total.dropped,
    averageMs: elapsed / total.operations,
  };
}

async function stage3BoundaryDrift() {
  const concurrency = os.cpus().length;
  const totalPerOffset = 100;
  const offsets = [5000, 9500, 10001];
  const start = now();

  const allResults = [];
  for (const offset of offsets) {
    const workers = [];
    for (let i = 0; i < concurrency; i += 1) {
      workers.push(runWorker(i, totalPerOffset, 0, offset, true));
    }
    const results = await Promise.all(workers);
    const total = results.reduce((acc, r) => ({
      operations: acc.operations + r.batchSize,
      validated: acc.validated + r.validated,
      dropped: acc.dropped + r.dropped,
    }), { operations: 0, validated: 0, dropped: 0 });
    allResults.push({ offset, ...total });
  }

  const elapsed = now() - start;
  const totalOps = allResults.reduce((sum, r) => sum + r.operations, 0);

  return {
    elapsedMs: elapsed,
    operations: totalOps,
    throughput: totalOps / (elapsed / 1000),
    peakRssMB: 0,
    validated: allResults.reduce((sum, r) => sum + r.validated, 0),
    dropped: allResults.reduce((sum, r) => sum + r.dropped, 0),
    averageMs: elapsed / totalOps,
    breakdown: allResults,
  };
}

async function main() {
  console.log('Track 115 Cross-Enclave Mesh Saturation Simulation');
  console.log(`Workers: ${os.cpus().length}`);

  const s1 = await stage1Baseline();
  reportStage('Stage 1: Baseline Linear Load (1,000 ops)', s1);

  const s2 = await stage2BurstSaturation();
  reportStage('Stage 2: Concurrent Burst Saturation (5,000 ops)', s2);

  const s3 = await stage3BoundaryDrift();
  reportStage('Stage 3: Boundary Drift & Window Exhaustion', s3);

  console.log('\n=== Boundary Drift Breakdown ===');
  for (const row of s3.breakdown) {
    console.log(`  offset ${row.offset}ms: validated=${row.validated} dropped=${row.dropped}`);
    if (row.offset <= 10000) {
      if (row.dropped !== 0) {
        throw new Error(`Expected 0 drops for offset ${row.offset}ms, got ${row.dropped}`);
      }
    } else {
      if (row.dropped !== row.operations) {
        throw new Error(`Expected all drops for offset ${row.offset}ms, got ${row.dropped}/${row.operations}`);
      }
    }
  }

  const l2 = s3.breakdown.find((r) => r.offset === 9500);
  const l3 = s3.breakdown.find((r) => r.offset === 10001);
  if (!l2 || l2.validated !== l2.operations) {
    throw new Error('SIM-L2-03: expected 9500ms claims to validate cleanly');
  }
  if (!l3 || l3.dropped !== l3.operations) {
    throw new Error('SIM-L3-03: expected 10001ms claims to be dropped at the boundary');
  }

  console.log('\nSimulation complete.');
}

main().catch((err) => {
  console.error('Simulation failed:', err);
  process.exit(1);
});
