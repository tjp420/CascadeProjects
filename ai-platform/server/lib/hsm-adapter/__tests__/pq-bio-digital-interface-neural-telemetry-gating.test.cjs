'use strict';

/**
 * Tests for Track 112: PQC Bio-Digital Interface Neural-Telemetry Gating Hub.
 */

const { PqcBioDigitalInterfaceNeuralTelemetryGatingHub } = require('../pqc-bio-digital-interface-neural-telemetry-gating-hub.cjs');
const { ZkNeuralClaimValidator } = require('../zk-neural-claim-validator.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

const DEFAULT_POLICY = {
  minNeuralQuorum: 24,
  maxNeuralTelemetryWindowSeconds: 2,
  maxSynapseChainDepth: 64,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  allowedAttestationAuthorities: ['mock-authority'],
  requireNeuroTelemetryAuthorityInitializerAttestation: false,
  requireBioEthicsOversightCommitteeAttestation: false,
};

function makeHub() {
  return new PqcBioDigitalInterfaceNeuralTelemetryGatingHub({ policy: DEFAULT_POLICY });
}

function makeValidator() {
  return new ZkNeuralClaimValidator({ policy: DEFAULT_POLICY });
}

function expectErrorCode(fn, code) {
  try {
    fn();
    return undefined;
  } catch (err) {
    return err.code;
  }
}

describe('Track 112 PQC Bio-Digital Interface Neural-Telemetry Gating Hub', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('initializes a neuro telemetry pool and increments counter', () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedSynapseStateDigestCommitment: 'synapse-commit',
      blindedNeuralTelemetryCommitment: 'telemetry-commit',
      blindedReflexLoopCommitment: 'reflex-commit',
      pqcSignatureScheme: 'ML-DSA-65',
      attestationAuthority: 'mock-authority',
      neuralQuorum: 30,
      neuralTelemetryWindowSeconds: 2,
      synapseChainDepth: 32,
    });
    expect(pool).toMatchObject({
      status: 'open',
      pqcSignatureScheme: 'ML-DSA-65',
    });
    expect(hub.getPool(pool.poolId)).toEqual(pool);
    expect(hsmMetrics.getMetrics().hsm_neurogate_pool_initialized_total).toBe(1);
  });

  test('rejects initialize when neural telemetry window exceeds 2 seconds', () => {
    const hub = makeHub();
    const code = expectErrorCode(() => hub.initializePool({
      blindedSynapseStateDigestCommitment: 'synapse-commit',
      blindedNeuralTelemetryCommitment: 'telemetry-commit',
      neuralTelemetryWindowSeconds: 3,
      pqcSignatureScheme: 'ML-DSA-65',
    }), 'NEUROGATE_INFERENCE_WINDOW_EXCEEDED');
    expect(code).toBe('NEUROGATE_INFERENCE_WINDOW_EXCEEDED');
  });

  test('rejects initialize with disallowed PQC scheme', () => {
    const hub = makeHub();
    const code = expectErrorCode(() => hub.initializePool({
      blindedSynapseStateDigestCommitment: 'synapse-commit',
      blindedNeuralTelemetryCommitment: 'telemetry-commit',
      pqcSignatureScheme: 'falcon-512',
    }), 'NEUROGATE_PQC_SCHEME_BLOCKED');
    expect(code).toBe('NEUROGATE_PQC_SCHEME_BLOCKED');
  });

  test('verifies neural telemetry and increments counter', () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedSynapseStateDigestCommitment: 'synapse-commit',
      blindedNeuralTelemetryCommitment: 'telemetry-commit',
      pqcSignatureScheme: 'ML-DSA-65',
    });
    const verified = hub.verifyNeuralTelemetry({ poolId: pool.poolId, proofValid: true });
    expect(verified.neuralTelemetryVerified).toBe(true);
    expect(hsmMetrics.getMetrics().hsm_zk_neural_telemetry_verified_total).toBe(1);
  });

  test('completes synapse accreditation with sufficient quorum', () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedSynapseStateDigestCommitment: 'synapse-commit',
      blindedNeuralTelemetryCommitment: 'telemetry-commit',
      pqcSignatureScheme: 'ML-DSA-65',
    });
    hub.verifyNeuralTelemetry({ poolId: pool.poolId, proofValid: true });
    const result = hub.completeSynapseAccreditation({
      poolId: pool.poolId,
      neuralSignatures: new Array(24).fill('sig'),
    });
    expect(result.status).toBe('accredited');
    expect(hsmMetrics.getMetrics().hsm_synapse_accreditation_completed_total).toBe(1);
  });

  test('rejects synapse accreditation with insufficient quorum', () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedSynapseStateDigestCommitment: 'synapse-commit',
      blindedNeuralTelemetryCommitment: 'telemetry-commit',
      pqcSignatureScheme: 'ML-DSA-65',
    });
    hub.verifyNeuralTelemetry({ poolId: pool.poolId, proofValid: true });
    const code = expectErrorCode(() => hub.completeSynapseAccreditation({
      poolId: pool.poolId,
      neuralSignatures: new Array(7).fill('sig'),
    }), 'NEUROGATE_QUORUM_INSUFFICIENT');
    expect(code).toBe('NEUROGATE_QUORUM_INSUFFICIENT');
  });
});

describe('Track 112 ZkNeuralClaimValidator', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('validates a fresh claim within 2-second window', () => {
    const validator = makeValidator();
    const result = validator.validateClaim({
      poolId: 'neuro-1',
      neuralSynapseStateDigest: 'digest-1',
      timestampMs: Date.now() - 500,
      proofValid: true,
    });
    expect(result.valid).toBe(true);
    expect(hsmMetrics.getMetrics().hsm_zk_neural_telemetry_verified_total).toBe(1);
  });

  test('drops a claim 2001ms old with INFERENCE_WINDOW_OUT_OF_BOUNDS', () => {
    const validator = makeValidator();
    const code = expectErrorCode(() => validator.validateClaim({
      poolId: 'neuro-1',
      neuralSynapseStateDigest: 'digest-1',
      timestampMs: Date.now() - 2001,
      proofValid: true,
    }), 'NEUROCLAIM_INFERENCE_WINDOW_OUT_OF_BOUNDS');
    expect(code).toBe('NEUROCLAIM_INFERENCE_WINDOW_OUT_OF_BOUNDS');
  });

  test('rejects a claim with excessive synapse chain depth', () => {
    const validator = makeValidator();
    const code = expectErrorCode(() => validator.validateClaim({
      poolId: 'neuro-1',
      neuralSynapseStateDigest: 'digest-1',
      timestampMs: Date.now(),
      synapseChainDepth: 100,
      proofValid: true,
    }), 'NEUROCLAIM_SYNAPSE_CHAIN_DEPTH_EXCEEDED');
    expect(code).toBe('NEUROCLAIM_SYNAPSE_CHAIN_DEPTH_EXCEEDED');
  });

  test('rejects a claim with disallowed PQC signature scheme', () => {
    const validator = makeValidator();
    const code = expectErrorCode(() => validator.validateClaim({
      poolId: 'neuro-1',
      neuralSynapseStateDigest: 'digest-1',
      timestampMs: Date.now(),
      pqcSignatureScheme: 'falcon-512',
      proofValid: true,
    }), 'NEUROCLAIM_PQC_SCHEME_BLOCKED');
    expect(code).toBe('NEUROCLAIM_PQC_SCHEME_BLOCKED');
  });
});
