'use strict';

/**
 * Track 115 high-throughput mesh reconciliation simulation worker.
 *
 * Process-isolated worker loaded by `child_process.fork`. Receives a batch of
 * jobs over IPC, executes them against the ZK mesh validator, and returns the
 * aggregated telemetry.
 */

const { ZkMeshReconciliationClaimValidator } = require('../zk-mesh-reconciliation-claim-validator.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

const DEFAULT_POLICY = {
  minMeshQuorum: 50,
  maxEpochFinalityWindowSeconds: 10,
  maxReconciliationChainDepth: 100,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  allowedAttestationAuthorities: ['mock-authority'],
  requireMeshReconciliationAuthorityInitializerAttestation: false,
  requireMeshEthicsOversightCommitteeAttestation: false,
};

function runBatch(job) {
  const { workerId, batchSize, delayMs, timestampOffsetMs, reconcileValid } = job;
  hsmMetrics.reset();
  const validator = new ZkMeshReconciliationClaimValidator({ policy: DEFAULT_POLICY });
  const start = process.hrtime.bigint();
  let validated = 0;
  let dropped = 0;

  for (let i = 0; i < batchSize; i += 1) {
    const createdAt = Date.now();
    // For offsets above the 10,000ms window, add an extra millisecond of
    // conservatism so that the validator's wall-clock read is guaranteed to
    // observe a stale claim, regardless of `Date.now()` resolution.
    const extraMs = timestampOffsetMs > 10000 ? 2 : 0;
    const timestampMs = createdAt - timestampOffsetMs - extraMs;

    if (delayMs && delayMs > 0) {
      const delayUntil = createdAt + delayMs;
      while (Date.now() < delayUntil) {
        // spin-wait to simulate validation latency
      }
    }

    try {
      validator.validateClaim({
        poolId: `mesh-worker-${workerId}-claim-${i}`,
        confidentialStateReconciliationDigest: `state-digest-${i}`,
        timestampMs,
        proofValid: reconcileValid !== false,
      });
      validated += 1;
    } catch (err) {
      if (err.code !== 'MESHCLAIM_EPOCH_FINALITY_WINDOW_EXCEEDED') {
        throw err;
      }
      dropped += 1;
    }
  }

  const end = process.hrtime.bigint();
  const durationNs = end - start;
  const durationMs = Number(durationNs) / 1e6;

  process.send({
    type: 'batch_complete',
    workerId,
    durationMs,
    validated,
    dropped,
    batchSize,
  });

  process.exit(0);
}

process.on('message', (msg) => {
  if (msg.type === 'run_batch') {
    runBatch(msg);
  }
});
