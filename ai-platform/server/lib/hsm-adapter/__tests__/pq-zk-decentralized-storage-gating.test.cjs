'use strict';

/**
 * Tests for Track 111 ZK decentralized storage attestation gating hub and validator.
 */

const { PqcZkDecentralizedStorageAttestationGatingHub } = require('../pqc-zk-decentralized-storage-gating-hub.cjs');
const { ZkStorageClaimValidator } = require('../zk-storage-claim-validator.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

const DEFAULT_POLICY = {
  minReplicationFactor: 3,
  maxProofOfSpaceTimeWindowSeconds: 300,
  maxStorageAttestationChainDepth: 46,
  maxReplicaDispersalDistance: 12,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireStorageAuthorityInitializerAttestation: true,
  requireStorageEthicsOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderStorageClaims: true,
  requireCanonicalPayloadLayout: true,
};

function buildHub(policy = DEFAULT_POLICY, attestationClient) {
  return new PqcZkDecentralizedStorageAttestationGatingHub({ policy, attestationClient, audit: jest.fn() });
}

function buildValidator(policy = DEFAULT_POLICY) {
  return new ZkStorageClaimValidator({ policy });
}

describe('PqcZkDecentralizedStorageAttestationGatingHub', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('initializePool creates a pool with correct defaults', () => {
    const hub = buildHub();
    const pool = hub.initializePool({
      sourceTenantId: 'tenant-a',
      targetChainId: 'chain-b',
      sourceStorageNodeId: 'node-1',
      targetStorageNodeId: 'node-2',
      blindedStorageSectorDigestCommitment: 'c1',
      blindedProofOfSpaceTimeCommitment: 'c2',
      blindedReplicaDispersalCommitment: 'c3',
      proofOfSpaceTimeWindowSeconds: 120,
      storageAttestationChainDepth: 20,
      replicaDispersalDistance: 5,
      pqcSignatureScheme: 'ML-DSA-65',
      attestationAuthority: 'mock-authority',
      storageAuthorityInitializerAttestation: 'attest-1',
    });
    expect(pool).toMatchObject({
      status: 'open',
      storageProofVerified: false,
      replicaConsensusConfirmed: false,
    });
    expect(pool.poolId).toBeDefined();
    expect(hub.getPoolCount()).toBe(1);
    expect(hsmMetrics.getMetrics().hsm_zkstorage_pool_initialized_total).toBe(1);
  });

  test('verifyStorageProof increments counter on valid proof', () => {
    const hub = buildHub();
    const pool = hub.initializePool({
      sourceTenantId: 'tenant-a',
      targetChainId: 'chain-b',
      sourceStorageNodeId: 'node-1',
      targetStorageNodeId: 'node-2',
      blindedStorageSectorDigestCommitment: 'c1',
      blindedProofOfSpaceTimeCommitment: 'c2',
      blindedReplicaDispersalCommitment: 'c3',
      proofOfSpaceTimeWindowSeconds: 120,
      storageAttestationChainDepth: 20,
      replicaDispersalDistance: 5,
      pqcSignatureScheme: 'ML-DSA-65',
      attestationAuthority: 'mock-authority',
      storageAuthorityInitializerAttestation: 'attest-1',
    });
    const result = hub.verifyStorageProof({ poolId: pool.poolId, proofValid: true });
    expect(result.storageProofVerified).toBe(true);
    expect(hsmMetrics.getMetrics().hsm_zk_storage_proof_verified_total).toBe(1);
  });

  test('verifyStorageProof with invalid proof issues challenge and throws', () => {
    const hub = buildHub();
    const pool = hub.initializePool({
      sourceTenantId: 'tenant-a',
      targetChainId: 'chain-b',
      sourceStorageNodeId: 'node-1',
      targetStorageNodeId: 'node-2',
      blindedStorageSectorDigestCommitment: 'c1',
      blindedProofOfSpaceTimeCommitment: 'c2',
      blindedReplicaDispersalCommitment: 'c3',
      proofOfSpaceTimeWindowSeconds: 120,
      storageAttestationChainDepth: 20,
      replicaDispersalDistance: 5,
      pqcSignatureScheme: 'ML-DSA-65',
      attestationAuthority: 'mock-authority',
      storageAuthorityInitializerAttestation: 'attest-1',
    });
    expect(() => hub.verifyStorageProof({ poolId: pool.poolId, proofValid: false })).toThrow('storage proof');
    expect(hsmMetrics.getMetrics().hsm_zkstorage_challenge_issued_total).toBe(1);
  });

  test('confirmReplicaConsensus requires proof first', () => {
    const hub = buildHub();
    const pool = hub.initializePool({
      sourceTenantId: 'tenant-a',
      targetChainId: 'chain-b',
      sourceStorageNodeId: 'node-1',
      targetStorageNodeId: 'node-2',
      blindedStorageSectorDigestCommitment: 'c1',
      blindedProofOfSpaceTimeCommitment: 'c2',
      blindedReplicaDispersalCommitment: 'c3',
      proofOfSpaceTimeWindowSeconds: 120,
      storageAttestationChainDepth: 20,
      replicaDispersalDistance: 5,
      pqcSignatureScheme: 'ML-DSA-65',
      attestationAuthority: 'mock-authority',
      storageAuthorityInitializerAttestation: 'attest-1',
    });
    expect(() => hub.confirmReplicaConsensus({ poolId: pool.poolId, replicaSignatures: ['s1', 's2', 's3'], storageEthicsOversightCommitteeAttestation: 'attest-2' })).toThrow('storage proof not verified');
  });

  test('confirmReplicaConsensus increments counter when successful', () => {
    const hub = buildHub();
    const pool = hub.initializePool({
      sourceTenantId: 'tenant-a',
      targetChainId: 'chain-b',
      sourceStorageNodeId: 'node-1',
      targetStorageNodeId: 'node-2',
      blindedStorageSectorDigestCommitment: 'c1',
      blindedProofOfSpaceTimeCommitment: 'c2',
      blindedReplicaDispersalCommitment: 'c3',
      proofOfSpaceTimeWindowSeconds: 120,
      storageAttestationChainDepth: 20,
      replicaDispersalDistance: 5,
      pqcSignatureScheme: 'ML-DSA-65',
      attestationAuthority: 'mock-authority',
      storageAuthorityInitializerAttestation: 'attest-1',
    });
    hub.verifyStorageProof({ poolId: pool.poolId, proofValid: true });
    hub.confirmReplicaConsensus({ poolId: pool.poolId, replicaSignatures: ['s1', 's2', 's3'], storageEthicsOversightCommitteeAttestation: 'attest-2' });
    expect(hsmMetrics.getMetrics().hsm_zkstorage_replication_accreditation_completed_total).toBe(1);
  });

  test('completeDispersal increments counter after consensus', () => {
    const hub = buildHub();
    const pool = hub.initializePool({
      sourceTenantId: 'tenant-a',
      targetChainId: 'chain-b',
      sourceStorageNodeId: 'node-1',
      targetStorageNodeId: 'node-2',
      blindedStorageSectorDigestCommitment: 'c1',
      blindedProofOfSpaceTimeCommitment: 'c2',
      blindedReplicaDispersalCommitment: 'c3',
      proofOfSpaceTimeWindowSeconds: 120,
      storageAttestationChainDepth: 20,
      replicaDispersalDistance: 5,
      pqcSignatureScheme: 'ML-DSA-65',
      attestationAuthority: 'mock-authority',
      storageAuthorityInitializerAttestation: 'attest-1',
    });
    hub.verifyStorageProof({ poolId: pool.poolId, proofValid: true });
    hub.confirmReplicaConsensus({ poolId: pool.poolId, replicaSignatures: ['s1', 's2', 's3'], storageEthicsOversightCommitteeAttestation: 'attest-2' });
    hub.completeDispersal({ poolId: pool.poolId });
    expect(hsmMetrics.getMetrics().hsm_zkstorage_dispersal_completed_total).toBe(1);
    expect(hub.getPool(pool.poolId).status).toBe('dispersed');
  });

  test('recordSlash increments slash counter', () => {
    const hub = buildHub();
    const pool = hub.initializePool({
      sourceTenantId: 'tenant-a',
      targetChainId: 'chain-b',
      sourceStorageNodeId: 'node-1',
      targetStorageNodeId: 'node-2',
      blindedStorageSectorDigestCommitment: 'c1',
      blindedProofOfSpaceTimeCommitment: 'c2',
      blindedReplicaDispersalCommitment: 'c3',
      proofOfSpaceTimeWindowSeconds: 120,
      storageAttestationChainDepth: 20,
      replicaDispersalDistance: 5,
      pqcSignatureScheme: 'ML-DSA-65',
      attestationAuthority: 'mock-authority',
      storageAuthorityInitializerAttestation: 'attest-1',
    });
    hub.recordSlash({ poolId: pool.poolId, reason: 'missing_replica' });
    expect(hsmMetrics.getMetrics().hsm_zkstorage_slash_recorded_total).toBe(1);
  });

  test('issueChallenge increments challenge counter', () => {
    const hub = buildHub();
    const pool = hub.initializePool({
      sourceTenantId: 'tenant-a',
      targetChainId: 'chain-b',
      sourceStorageNodeId: 'node-1',
      targetStorageNodeId: 'node-2',
      blindedStorageSectorDigestCommitment: 'c1',
      blindedProofOfSpaceTimeCommitment: 'c2',
      blindedReplicaDispersalCommitment: 'c3',
      proofOfSpaceTimeWindowSeconds: 120,
      storageAttestationChainDepth: 20,
      replicaDispersalDistance: 5,
      pqcSignatureScheme: 'ML-DSA-65',
      attestationAuthority: 'mock-authority',
      storageAuthorityInitializerAttestation: 'attest-1',
    });
    hub.issueChallenge({ poolId: pool.poolId, challengeType: 'retrieval_audit' });
    expect(hsmMetrics.getMetrics().hsm_zkstorage_challenge_issued_total).toBe(1);
  });
});

describe('ZkStorageClaimValidator', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('validateClaim accepts a valid claim', () => {
    const validator = buildValidator();
    const result = validator.validateClaim({
      poolId: 'pool-1',
      proofOfSpaceTimeCommitment: 'c1',
      storageSectorDigestCommitment: 'c2',
      replicaDispersalCommitment: 'c3',
      proofOfSpaceTimeWindowSeconds: 120,
      storageAttestationChainDepth: 20,
      replicaDispersalDistance: 5,
      pqcSignatureScheme: 'ML-DSA-65',
      attestationAuthority: 'mock-authority',
      proofValid: true,
    });
    expect(result.valid).toBe(true);
    expect(hsmMetrics.getMetrics().hsm_zk_storage_proof_verified_total).toBe(1);
  });

  test('validateClaim rejects proof-of-space-time window too large', () => {
    const validator = buildValidator();
    expect(() => validator.validateClaim({
      poolId: 'pool-1',
      proofOfSpaceTimeCommitment: 'c1',
      storageSectorDigestCommitment: 'c2',
      replicaDispersalCommitment: 'c3',
      proofOfSpaceTimeWindowSeconds: 9999,
      storageAttestationChainDepth: 20,
      replicaDispersalDistance: 5,
      pqcSignatureScheme: 'ML-DSA-65',
      attestationAuthority: 'mock-authority',
      proofValid: true,
    })).toThrow('proof-of-space-time window seconds');
    expect(hsmMetrics.getMetrics().hsm_zkstorage_challenge_issued_total).toBe(1);
  });

  test('validateClaim rejects disallowed signature scheme', () => {
    const validator = buildValidator();
    expect(() => validator.validateClaim({
      poolId: 'pool-1',
      proofOfSpaceTimeCommitment: 'c1',
      storageSectorDigestCommitment: 'c2',
      replicaDispersalCommitment: 'c3',
      proofOfSpaceTimeWindowSeconds: 120,
      storageAttestationChainDepth: 20,
      replicaDispersalDistance: 5,
      pqcSignatureScheme: 'falcon-512',
      attestationAuthority: 'mock-authority',
      proofValid: true,
    })).toThrow('PQC signature scheme');
    expect(hsmMetrics.getMetrics().hsm_zkstorage_challenge_issued_total).toBe(1);
  });
});
