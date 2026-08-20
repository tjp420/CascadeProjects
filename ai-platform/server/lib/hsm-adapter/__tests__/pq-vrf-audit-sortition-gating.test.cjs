"use strict";

/**
 * Track 80: PQ VRF Audit Sortition Gating tests.
 */
const {
  PqcVrfAuditSortitionGatingHub,
} = require("../pqc-vrf-audit-sortition-gating-hub.cjs");
const {
  ZkSortitionClaimValidator,
} = require("../zk-sortition-claim-validator.cjs");
const {
  EnclaveAttestationClient,
} = require("../enclave-attestation-client.cjs");
const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

class MockAttestationClient {
  verify(attestation) {
    if (!attestation || typeof attestation !== "object")
      return { verified: false };
    if (!attestation.authority || attestation.authority !== "mock-authority")
      return { verified: false };
    return { verified: true };
  }
}

const POLICY = {
  minSortitionQuorum: 3,
  maxSortitionEpochSeconds: 2592000,
  maxEntropyDepth: 16,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireSortitionAuthorityInitializerAttestation: true,
  requireAuditCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderSortitionClaims: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  return {
    version: 1,
    enclaveType: "mock",
    measurement: "MOCK_MEASUREMENT_00000000000000000000000000000000",
    mrenclave: "MOCK_MRENCLAVE_00000000000000000000000000000000",
    timestamp: Math.floor(Date.now() / 1000),
    attestationAgeSeconds: 0,
    authority: "mock-authority",
    signature: "mock-signature-placeholder",
  };
}

function baseInitRequest() {
  return {
    sourceTenantId: "tenant-a",
    targetChainId: "chain-b",
    blindedStakeHashCommitment: "pedersen-stake-001",
    blindedSortitionSeedCommitment: "pedersen-seed-001",
    blindedEntropyHashCommitment: "pedersen-entropy-001",
    sortitionEpochSeconds: 1296000,
    entropyDepth: 8,
    pqcSignatureScheme: "ML-DSA-65",
    sortitionAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    blindedSortitionSeedCommitment: "pedersen-seed-001",
    blindedClaimValueCommitment: "pedersen-claimval-001",
    zkSortitionRangeProofHash: "zk-sortition-proof-001",
    auditCommitteeAttestation: mockAttestation(),
    auditCommitteeAttestationHash: "committee-hash-001",
    attestationAuthority: "mock-authority",
    partialSignature: "partial-sig-001",
    sortitionEpochSeconds: 1296000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    auditCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    committeeSignatures: ["sig-a", "sig-b", "sig-c"],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcVrfAuditSortitionGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkSortitionClaimValidator({
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
  const claim = ctx.validator.verifySortitionClaim(
    baseClaimRequest(ctx.pool.poolId),
  );
  return { ...ctx, claim };
}

describe("Track 80 PQ VRF audit sortition gating", () => {
  test("PqcVrfAuditSortitionGatingHub initializes a pool and emits SORTITION_GATING_POOL_INITIALIZED", () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe("open");
    expect(pool.poolId).toBeDefined();
    expect(
      events.some((e) => e.event === "SORTITION_GATING_POOL_INITIALIZED"),
    ).toBe(true);
  });

  test("ZkSortitionClaimValidator verifies a sortition claim and emits ZK_SORTITION_CLAIM_VERIFIED", () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifySortitionClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === "ZK_SORTITION_CLAIM_VERIFIED")).toBe(
      true,
    );
  });

  test("PqcVrfAuditSortitionGatingHub completes accreditation after claim and emits VALIDATOR_ACCREDITATION_COMPLETED", () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(
      baseCompleteRequest(pool.poolId),
    );
    expect(completion.completionId).toBeDefined();
    expect(
      events.some((e) => e.event === "VALIDATOR_ACCREDITATION_COMPLETED"),
    ).toBe(true);
  });

  test("PqcVrfAuditSortitionGatingHub rejects sortition epoch exceeding maximum", () => {
    const hub = new PqcVrfAuditSortitionGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.sortitionEpochSeconds = 9999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcVrfAuditSortitionGatingHub rejects entropy depth exceeding maximum", () => {
    const hub = new PqcVrfAuditSortitionGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.entropyDepth = 32;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcVrfAuditSortitionGatingHub rejects un-attested sortition authority initializer", () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcVrfAuditSortitionGatingHub({
      policy: POLICY,
      attestationClient,
    });
    const request = baseInitRequest();
    request.sortitionAuthorityInitializerAttestation = { authority: "bad" };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("ZkSortitionClaimValidator rejects un-attested audit committee", () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const validator = new ZkSortitionClaimValidator({
      policy: POLICY,
      hub,
      attestationClient,
    });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.auditCommitteeAttestation = { authority: "bad" };
    expect(() => validator.verifySortitionClaim(clReq)).toThrow(
      HsmAdapterError,
    );
  });

  test("PqcVrfAuditSortitionGatingHub rejects unpermitted PQC signature scheme", () => {
    const hub = new PqcVrfAuditSortitionGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = "RSA-2048";
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcVrfAuditSortitionGatingHub rejects duplicate pool initialization", () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = "pool-dup";
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcVrfAuditSortitionGatingHub rejects accreditation completion before sortition claim verification", () => {
    const { hub, pool } = setupAndInitPool();
    expect(() =>
      hub.completeAccreditation(baseCompleteRequest(pool.poolId)),
    ).toThrow(HsmAdapterError);
  });

  test("PqcVrfAuditSortitionGatingHub rejects accreditation completion with insufficient quorum", () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ["sig-a"];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test("ZkSortitionClaimValidator bans peers broadcasting malformed claims", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkSortitionRangeProofHash = null;
    clReq.peerId = "peer-bad";
    expect(() => validator.verifySortitionClaim(clReq)).toThrow(
      HsmAdapterError,
    );
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkSortitionClaimValidator bans peers broadcasting out-of-bounds sortition epochs", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.sortitionEpochSeconds = 9999999;
    clReq.peerId = "peer-bad";
    expect(() => validator.verifySortitionClaim(clReq)).toThrow(
      HsmAdapterError,
    );
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkSortitionClaimValidator bans peers broadcasting duplicate claims", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = "peer-bad";
    validator.verifySortitionClaim(clReq);
    expect(() => validator.verifySortitionClaim(clReq)).toThrow(
      HsmAdapterError,
    );
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq sortition gating configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqSortitionGating", {
        sortitionQuorum: 3,
        sortitionEpochSeconds: 1296000,
        entropyDepth: 8,
        pqcSignatureScheme: "ML-DSA-65",
        sortitionAuthorityInitializerAttestation: true,
        auditCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderSortitionClaims: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "pqSortitionGating", { sortitionQuorum: 1 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSortitionGating", {
        sortitionEpochSeconds: 9999999,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSortitionGating", { entropyDepth: 32 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSortitionGating", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSortitionGating", {
        sortitionAuthorityInitializerAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSortitionGating", {
        auditCommitteeAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSortitionGating", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSortitionGating", {
        banMalformedOrOutOfOrderSortitionClaims: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSortitionGating", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
