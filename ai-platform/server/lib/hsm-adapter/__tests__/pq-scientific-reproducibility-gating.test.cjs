"use strict";

/**
 * Track 83: PQ Scientific Reproducibility Gating tests.
 */
const {
  PqcScientificReproducibilityGatingHub,
} = require("../pqc-scientific-reproducibility-gating-hub.cjs");
const {
  ZkReplicationClaimValidator,
} = require("../zk-replication-claim-validator.cjs");
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
  minPeerReviewQuorum: 3,
  maxReplicationWindowSeconds: 15768000,
  maxCitationDepth: 48,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireResearchAuthorityInitializerAttestation: true,
  requireIntegrityCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderReplicationClaims: true,
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
    blindedExperimentHashCommitment: "pedersen-experiment-001",
    blindedReplicationResultCommitment: "pedersen-replication-001",
    blindedReviewerIdentityCommitment: "pedersen-reviewer-001",
    replicationWindowSeconds: 7884000,
    citationDepth: 24,
    pqcSignatureScheme: "ML-DSA-65",
    researchAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    blindedReplicationResultCommitment: "pedersen-replication-001",
    blindedClaimValueCommitment: "pedersen-claimval-001",
    zkReplicationRangeProofHash: "zk-replication-proof-001",
    integrityCommitteeAttestation: mockAttestation(),
    integrityCommitteeAttestationHash: "committee-hash-001",
    attestationAuthority: "mock-authority",
    ringSignature: "ring-sig-001",
    replicationWindowSeconds: 7884000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    integrityCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    committeeSignatures: ["sig-a", "sig-b", "sig-c"],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcScientificReproducibilityGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkReplicationClaimValidator({
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
  const claim = ctx.validator.verifyReplicationClaim(
    baseClaimRequest(ctx.pool.poolId),
  );
  return { ...ctx, claim };
}

describe("Track 83 PQ scientific reproducibility gating", () => {
  test("PqcScientificReproducibilityGatingHub initializes a pool and emits RESEARCH_GATING_POOL_INITIALIZED", () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe("open");
    expect(pool.poolId).toBeDefined();
    expect(
      events.some((e) => e.event === "RESEARCH_GATING_POOL_INITIALIZED"),
    ).toBe(true);
  });

  test("ZkReplicationClaimValidator verifies a replication claim and emits ZK_REPLICATION_CLAIM_VERIFIED", () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyReplicationClaim(
      baseClaimRequest(pool.poolId),
    );
    expect(claim.claimId).toBeDefined();
    expect(
      events.some((e) => e.event === "ZK_REPLICATION_CLAIM_VERIFIED"),
    ).toBe(true);
  });

  test("PqcScientificReproducibilityGatingHub completes accreditation after claim and emits PEER_REVIEW_ACCREDITATION_COMPLETED", () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(
      baseCompleteRequest(pool.poolId),
    );
    expect(completion.completionId).toBeDefined();
    expect(
      events.some((e) => e.event === "PEER_REVIEW_ACCREDITATION_COMPLETED"),
    ).toBe(true);
  });

  test("PqcScientificReproducibilityGatingHub rejects replication window exceeding maximum", () => {
    const hub = new PqcScientificReproducibilityGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.replicationWindowSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcScientificReproducibilityGatingHub rejects citation depth exceeding maximum", () => {
    const hub = new PqcScientificReproducibilityGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.citationDepth = 96;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcScientificReproducibilityGatingHub rejects un-attested research authority initializer", () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcScientificReproducibilityGatingHub({
      policy: POLICY,
      attestationClient,
    });
    const request = baseInitRequest();
    request.researchAuthorityInitializerAttestation = { authority: "bad" };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("ZkReplicationClaimValidator rejects un-attested integrity committee", () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const validator = new ZkReplicationClaimValidator({
      policy: POLICY,
      hub,
      attestationClient,
    });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.integrityCommitteeAttestation = { authority: "bad" };
    expect(() => validator.verifyReplicationClaim(clReq)).toThrow(
      HsmAdapterError,
    );
  });

  test("PqcScientificReproducibilityGatingHub rejects unpermitted PQC signature scheme", () => {
    const hub = new PqcScientificReproducibilityGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = "RSA-2048";
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcScientificReproducibilityGatingHub rejects duplicate pool initialization", () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = "pool-dup";
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcScientificReproducibilityGatingHub rejects accreditation completion before replication claim verification", () => {
    const { hub, pool } = setupAndInitPool();
    expect(() =>
      hub.completeAccreditation(baseCompleteRequest(pool.poolId)),
    ).toThrow(HsmAdapterError);
  });

  test("PqcScientificReproducibilityGatingHub rejects accreditation completion with insufficient quorum", () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ["sig-a"];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test("ZkReplicationClaimValidator bans peers broadcasting malformed claims", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkReplicationRangeProofHash = null;
    clReq.peerId = "peer-bad";
    expect(() => validator.verifyReplicationClaim(clReq)).toThrow(
      HsmAdapterError,
    );
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkReplicationClaimValidator bans peers broadcasting out-of-bounds replication windows", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.replicationWindowSeconds = 99999999;
    clReq.peerId = "peer-bad";
    expect(() => validator.verifyReplicationClaim(clReq)).toThrow(
      HsmAdapterError,
    );
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkReplicationClaimValidator bans peers broadcasting duplicate claims", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = "peer-bad";
    validator.verifyReplicationClaim(clReq);
    expect(() => validator.verifyReplicationClaim(clReq)).toThrow(
      HsmAdapterError,
    );
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq research gating configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqResearchGating", {
        peerReviewQuorum: 3,
        replicationWindowSeconds: 7884000,
        citationDepth: 24,
        pqcSignatureScheme: "ML-DSA-65",
        researchAuthorityInitializerAttestation: true,
        integrityCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderReplicationClaims: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "pqResearchGating", { peerReviewQuorum: 1 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqResearchGating", {
        replicationWindowSeconds: 99999999,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqResearchGating", { citationDepth: 96 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqResearchGating", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqResearchGating", {
        researchAuthorityInitializerAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqResearchGating", {
        integrityCommitteeAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqResearchGating", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqResearchGating", {
        banMalformedOrOutOfOrderReplicationClaims: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqResearchGating", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
