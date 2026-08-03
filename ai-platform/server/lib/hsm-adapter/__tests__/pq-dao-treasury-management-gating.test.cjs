'use strict';

/**
 * Track 84: PQ DAO Treasury Management Gating tests.
 */
const { PqcDaoTreasuryManagementGatingHub } = require('../pqc-dao-treasury-management-gating-hub.cjs');
const { ZkProposalClaimValidator } = require('../zk-proposal-claim-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

class MockAttestationClient {
  verify(attestation) {
    if (!attestation || typeof attestation !== 'object') return { verified: false };
    if (!attestation.authority || attestation.authority !== 'mock-authority') return { verified: false };
    return { verified: true };
  }
}

const POLICY = {
  minProposalQuorum: 3,
  maxProposalWindowSeconds: 2592000,
  maxAllocationDepth: 16,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireGovernanceAuthorityInitializerAttestation: true,
  requireTreasuryOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderProposalClaims: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  return {
    version: 1,
    enclaveType: 'mock',
    measurement: 'MOCK_MEASUREMENT_00000000000000000000000000000000',
    mrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
    timestamp: Math.floor(Date.now() / 1000),
    attestationAgeSeconds: 0,
    authority: 'mock-authority',
    signature: 'mock-signature-placeholder',
  };
}

function baseInitRequest() {
  return {
    sourceTenantId: 'tenant-a',
    targetChainId: 'chain-b',
    blindedTreasuryAllocationCommitment: 'pedersen-treasury-001',
    blindedProposalExecutionCommitment: 'pedersen-proposal-001',
    blindedVoterIdentityCommitment: 'pedersen-voter-001',
    proposalWindowSeconds: 1296000,
    allocationDepth: 8,
    pqcSignatureScheme: 'ML-DSA-65',
    governanceAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedProposalExecutionCommitment: 'pedersen-proposal-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkProposalRangeProofHash: 'zk-proposal-proof-001',
    treasuryOversightCommitteeAttestation: mockAttestation(),
    treasuryOversightCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    aggregateSignature: 'aggregate-sig-001',
    proposalWindowSeconds: 1296000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    treasuryOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
    committeeSignatures: ['sig-a', 'sig-b', 'sig-c'],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcDaoTreasuryManagementGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkProposalClaimValidator({
    policy: POLICY,
    hub,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  return { events, attestationClient, hub, validator };
}

function setupAndInitPool() {
  const ctx = setupHubAndValidator();
  const pool = ctx.hub.initializePool(baseInitRequest());
  return { ...ctx, pool };
}

function setupInitAndClaim() {
  const ctx = setupAndInitPool();
  const claim = ctx.validator.verifyProposalClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 84 PQ DAO treasury management gating', () => {
  test('PqcDaoTreasuryManagementGatingHub initializes a pool and emits TREASURY_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'TREASURY_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkProposalClaimValidator verifies a proposal claim and emits ZK_PROPOSAL_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyProposalClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_PROPOSAL_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcDaoTreasuryManagementGatingHub completes accreditation after claim and emits VOTER_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'VOTER_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('PqcDaoTreasuryManagementGatingHub rejects proposal window exceeding maximum', () => {
    const hub = new PqcDaoTreasuryManagementGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.proposalWindowSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcDaoTreasuryManagementGatingHub rejects allocation depth exceeding maximum', () => {
    const hub = new PqcDaoTreasuryManagementGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.allocationDepth = 32;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcDaoTreasuryManagementGatingHub rejects un-attested governance authority initializer', () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcDaoTreasuryManagementGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.governanceAuthorityInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkProposalClaimValidator rejects un-attested treasury oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const validator = new ZkProposalClaimValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.treasuryOversightCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyProposalClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcDaoTreasuryManagementGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcDaoTreasuryManagementGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcDaoTreasuryManagementGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcDaoTreasuryManagementGatingHub rejects accreditation completion before proposal claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcDaoTreasuryManagementGatingHub rejects accreditation completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a'];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkProposalClaimValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkProposalRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyProposalClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkProposalClaimValidator bans peers broadcasting out-of-bounds proposal windows', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.proposalWindowSeconds = 99999999;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyProposalClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkProposalClaimValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyProposalClaim(clReq);
    expect(() => validator.verifyProposalClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq treasury gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqTreasuryGating', {
      proposalQuorum: 3,
      proposalWindowSeconds: 1296000,
      allocationDepth: 8,
      pqcSignatureScheme: 'ML-DSA-65',
      governanceAuthorityInitializerAttestation: true,
      treasuryOversightCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderProposalClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqTreasuryGating', { proposalQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTreasuryGating', { proposalWindowSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTreasuryGating', { allocationDepth: 32 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTreasuryGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTreasuryGating', { governanceAuthorityInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTreasuryGating', { treasuryOversightCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTreasuryGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTreasuryGating', { banMalformedOrOutOfOrderProposalClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTreasuryGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
