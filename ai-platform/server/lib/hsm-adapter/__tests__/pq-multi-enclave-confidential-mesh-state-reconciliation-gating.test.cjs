'use strict';

/**
 * Tests for Track 115: PQC Multi-Enclave Confidential Mesh State-Reconciliation Gating Hub.
 */

const { PqcMultiEnclaveConfidentialMeshStateReconciliationGatingHub } = require('../pqc-multi-enclave-confidential-mesh-state-reconciliation-gating-hub.cjs');
const { ZkMeshClaimValidator } = require('../zk-mesh-claim-validator.cjs');
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

function makeHub() {
  return new PqcMultiEnclaveConfidentialMeshStateReconciliationGatingHub({ policy: DEFAULT_POLICY });
}

function makeValidator() {
  return new ZkMeshClaimValidator({ policy: DEFAULT_POLICY });
}

function expectErrorCode(fn) {
  try {
    fn();
    return undefined;
  } catch (err) {
    return err.code;
  }
}

describe('Track 115 PQC Multi-Enclave Confidential Mesh State-Reconciliation Gating Hub', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('initializes a mesh state-reconciliation pool and increments counter', () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedConfidentialStateReconciliationDigestCommitment: 'reconciliation-commit',
      blindedEpochFinalityCommitment: 'finality-commit',
      blindedMpcSecretShareCommitment: 'mpc-commit',
      pqcSignatureScheme: 'ML-DSA-87',
      attestationAuthority: 'mock-authority',
      meshQuorum: 55,
      epochFinalityWindowSeconds: 10,
      reconciliationChainDepth: 80,
    });
    expect(pool).toMatchObject({
      status: 'open',
      pqcSignatureScheme: 'ML-DSA-87',
    });
    expect(hub.getPool(pool.poolId)).toEqual(pool);
    expect(hsmMetrics.getMetrics().hsm_meshgate_pool_initialized_total).toBe(1);
  });

  test('rejects initialize when epoch finality window exceeds 10 seconds', () => {
    const hub = makeHub();
    const code = expectErrorCode(() => hub.initializePool({
      blindedConfidentialStateReconciliationDigestCommitment: 'reconciliation-commit',
      blindedEpochFinalityCommitment: 'finality-commit',
      epochFinalityWindowSeconds: 11,
      pqcSignatureScheme: 'ML-DSA-87',
    }));
    expect(code).toBe('MESHGATE_EPOCH_FINALITY_WINDOW_EXCEEDED');
  });

  test('rejects initialize with disallowed PQC scheme', () => {
    const hub = makeHub();
    const code = expectErrorCode(() => hub.initializePool({
      blindedConfidentialStateReconciliationDigestCommitment: 'reconciliation-commit',
      blindedEpochFinalityCommitment: 'finality-commit',
      pqcSignatureScheme: 'falcon-512',
    }));
    expect(code).toBe('MESHGATE_PQC_SCHEME_BLOCKED');
  });

  test('reconciles mesh state and increments counter', () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedConfidentialStateReconciliationDigestCommitment: 'reconciliation-commit',
      blindedEpochFinalityCommitment: 'finality-commit',
      pqcSignatureScheme: 'ML-DSA-87',
    });
    const verified = hub.reconcileMeshState({ poolId: pool.poolId, proofValid: true });
    expect(verified.meshStateReconciled).toBe(true);
    expect(hsmMetrics.getMetrics().hsm_zk_mesh_state_reconciled_total).toBe(1);
  });

  test('completes epoch finality with sufficient quorum', () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedConfidentialStateReconciliationDigestCommitment: 'reconciliation-commit',
      blindedEpochFinalityCommitment: 'finality-commit',
      pqcSignatureScheme: 'ML-DSA-87',
    });
    hub.reconcileMeshState({ poolId: pool.poolId, proofValid: true });
    const result = hub.completeEpochFinality({
      poolId: pool.poolId,
      meshSignatures: new Array(50).fill('sig'),
    });
    expect(result.status).toBe('finalized');
    expect(hsmMetrics.getMetrics().hsm_epoch_finality_completed_total).toBe(1);
  });

  test('rejects epoch finality with insufficient quorum', () => {
    const hub = makeHub();
    const pool = hub.initializePool({
      blindedConfidentialStateReconciliationDigestCommitment: 'reconciliation-commit',
      blindedEpochFinalityCommitment: 'finality-commit',
      pqcSignatureScheme: 'ML-DSA-87',
    });
    hub.reconcileMeshState({ poolId: pool.poolId, proofValid: true });
    const code = expectErrorCode(() => hub.completeEpochFinality({
      poolId: pool.poolId,
      meshSignatures: new Array(12).fill('sig'),
    }));
    expect(code).toBe('MESHGATE_QUORUM_INSUFFICIENT');
  });
});

describe('Track 115 ZkMeshClaimValidator', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('validates a fresh claim within 10-second window', () => {
    const validator = makeValidator();
    const result = validator.validateClaim({
      poolId: 'mesh-1',
      confidentialStateReconciliationDigest: 'digest-1',
      timestampMs: Date.now() - 5000,
      proofValid: true,
    });
    expect(result.valid).toBe(true);
    expect(hsmMetrics.getMetrics().hsm_zk_mesh_state_reconciled_total).toBe(1);
  });

  test('drops an epoch claim 10001ms old with EPOCH_FINALITY_WINDOW_EXCEEDED', () => {
    const validator = makeValidator();
    const code = expectErrorCode(() => validator.validateClaim({
      poolId: 'mesh-1',
      confidentialStateReconciliationDigest: 'digest-1',
      timestampMs: Date.now() - 10001,
      proofValid: true,
    }));
    expect(code).toBe('MESHCLAIM_EPOCH_FINALITY_WINDOW_EXCEEDED');
  });

  test('rejects a claim with excessive reconciliation chain depth', () => {
    const validator = makeValidator();
    const code = expectErrorCode(() => validator.validateClaim({
      poolId: 'mesh-1',
      confidentialStateReconciliationDigest: 'digest-1',
      timestampMs: Date.now(),
      reconciliationChainDepth: 200,
      proofValid: true,
    }));
    expect(code).toBe('MESHCLAIM_RECONCILIATION_CHAIN_DEPTH_EXCEEDED');
  });

  test('rejects a claim with disallowed PQC signature scheme', () => {
    const validator = makeValidator();
    const code = expectErrorCode(() => validator.validateClaim({
      poolId: 'mesh-1',
      confidentialStateReconciliationDigest: 'digest-1',
      timestampMs: Date.now(),
      pqcSignatureScheme: 'falcon-512',
      proofValid: true,
    }));
    expect(code).toBe('MESHCLAIM_PQC_SCHEME_BLOCKED');
  });
});
