'use strict';

/**
 * Track 115 high-throughput mesh reconciliation simulation worker.
 *
 * Process-isolated worker loaded by child_process.fork. Receives a batch of
 * jobs over IPC, executes them against the ZK mesh validator, and returns the
 * aggregated telemetry.
 *
 * IPC Boundary Hardening:
 * - Validates all incoming messages against a strict schema allowlist
 * - Enforces max payload size (1 MB)
 * - Rejects unknown message types and malformed payloads
 * - Schema violations trigger HIGH severity SIEM alert via process.send
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

const MAX_IPC_PAYLOAD_BYTES = 1 << 20; // 1 MB

const ALLOWED_MESSAGE_TYPES = new Set(['run_batch']);

const RUN_BATCH_SCHEMA = {
  required: {
    type: 'string',
    workerId: 'number',
    batchSize: 'number',
  },
  optional: {
    delayMs: 'number',
    timestampOffsetMs: 'number',
    reconcileValid: 'boolean',
  },
};

/**
 * Validate an incoming IPC message against the strict schema.
 * @param {object} msg - parsed IPC message
 * @returns {{ valid: boolean, error: string|null }}
 */
function _validateIpcMessage(msg) {
  if (!msg || typeof msg !== 'object') {
    return { valid: false, error: 'invalid message object' };
  }
  if (typeof msg.type !== 'string' || !ALLOWED_MESSAGE_TYPES.has(msg.type)) {
    return { valid: false, error: 'unknown message type: ' + msg.type };
  }
  if (msg.type === 'run_batch') {
    // Check required fields
    for (const [field, expectedType] of Object.entries(RUN_BATCH_SCHEMA.required)) {
      if (!(field in msg)) {
        return { valid: false, error: 'missing field: ' + field };
      }
      if (typeof msg[field] !== expectedType) {
        return { valid: false, error: 'field ' + field + ' must be ' + expectedType + ', got ' + typeof msg[field] };
      }
    }
    // Check optional fields if present
    for (const [field, expectedType] of Object.entries(RUN_BATCH_SCHEMA.optional)) {
      if (field in msg && typeof msg[field] !== expectedType) {
        return { valid: false, error: 'field ' + field + ' must be ' + expectedType + ', got ' + typeof msg[field] };
      }
    }
    // Strict allowlist — reject unknown fields
    const allowed = new Set([...Object.keys(RUN_BATCH_SCHEMA.required), ...Object.keys(RUN_BATCH_SCHEMA.optional)]);
    for (const field of Object.keys(msg)) {
      if (!allowed.has(field)) {
        return { valid: false, error: 'unknown field: ' + field };
      }
    }
    // Validate batchSize is positive and reasonable
    if (msg.batchSize < 0 || msg.batchSize > 100000) {
      return { valid: false, error: 'batchSize out of range (0-100000)' };
    }
    // Validate delayMs if present
    if ('delayMs' in msg && msg.delayMs < 0) {
      return { valid: false, error: 'delayMs must be non-negative' };
    }
  }
  return { valid: true, error: null };
}

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
        poolId: 'mesh-worker-' + workerId + '-claim-' + i,
        confidentialStateReconciliationDigest: 'state-digest-' + i,
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
  // Size check — reject oversized payloads
  try {
    const serialized = JSON.stringify(msg);
    if (serialized.length > MAX_IPC_PAYLOAD_BYTES) {
      process.send({
        type: 'ipc_error',
        error: 'payload exceeds 1 MB limit',
        siemSeverity: 'high',
        siemCategory: 'ipc_payload_oversized',
      });
      return;
    }
  } catch (e) {
    process.send({
      type: 'ipc_error',
      error: 'payload serialization failed',
      siemSeverity: 'high',
      siemCategory: 'ipc_payload_invalid',
    });
    return;
  }

  // Schema validation
  const result = _validateIpcMessage(msg);
  if (!result.valid) {
    process.send({
      type: 'ipc_error',
      error: result.error,
      siemSeverity: 'high',
      siemCategory: 'ipc_schema_violation',
    });
    return;
  }

  if (msg.type === 'run_batch') {
    runBatch(msg);
  }
});

// Export for testing
module.exports = { _validateIpcMessage, MAX_IPC_PAYLOAD_BYTES, ALLOWED_MESSAGE_TYPES };
