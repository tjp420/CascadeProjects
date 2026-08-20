"use strict";

/**
 * Track 81: PQ Cross-Border Logistics Gating tests.
 */
const {
  PqcCrossBorderLogisticsGatingHub,
} = require("../pqc-cross-border-logistics-gating-hub.cjs");
const {
  ZkManifestClaimValidator,
} = require("../zk-manifest-claim-validator.cjs");
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
  minCustomsQuorum: 3,
  maxTransitWindowSeconds: 7776000,
  maxManifestDepth: 32,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireCustomsAuthorityInitializerAttestation: true,
  requireTradeCorridorCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderManifestClaims: true,
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
    blindedManifestHashCommitment: "pedersen-manifest-001",
    blindedTransitLogCommitment: "pedersen-transit-001",
    blindedCarrierTrackingCommitment: "pedersen-carrier-001",
    transitWindowSeconds: 3888000,
    manifestDepth: 16,
    pqcSignatureScheme: "ML-DSA-65",
    customsAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    blindedTransitLogCommitment: "pedersen-transit-001",
    blindedClaimValueCommitment: "pedersen-claimval-001",
    zkManifestRangeProofHash: "zk-manifest-proof-001",
    tradeCorridorCommitteeAttestation: mockAttestation(),
    tradeCorridorCommitteeAttestationHash: "committee-hash-001",
    attestationAuthority: "mock-authority",
    partialSignature: "partial-sig-001",
    transitWindowSeconds: 3888000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    tradeCorridorCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    committeeSignatures: ["sig-a", "sig-b", "sig-c"],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcCrossBorderLogisticsGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkManifestClaimValidator({
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
  const claim = ctx.validator.verifyManifestClaim(
    baseClaimRequest(ctx.pool.poolId),
  );
  return { ...ctx, claim };
}

describe("Track 81 PQ cross-border logistics gating", () => {
  test("PqcCrossBorderLogisticsGatingHub initializes a pool and emits LOGISTICS_GATING_POOL_INITIALIZED", () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe("open");
    expect(pool.poolId).toBeDefined();
    expect(
      events.some((e) => e.event === "LOGISTICS_GATING_POOL_INITIALIZED"),
    ).toBe(true);
  });

  test("ZkManifestClaimValidator verifies a manifest claim and emits ZK_MANIFEST_CLAIM_VERIFIED", () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyManifestClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === "ZK_MANIFEST_CLAIM_VERIFIED")).toBe(
      true,
    );
  });

  test("PqcCrossBorderLogisticsGatingHub completes accreditation after claim and emits CARRIER_ACCREDITATION_COMPLETED", () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(
      baseCompleteRequest(pool.poolId),
    );
    expect(completion.completionId).toBeDefined();
    expect(
      events.some((e) => e.event === "CARRIER_ACCREDITATION_COMPLETED"),
    ).toBe(true);
  });

  test("PqcCrossBorderLogisticsGatingHub rejects transit window exceeding maximum", () => {
    const hub = new PqcCrossBorderLogisticsGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.transitWindowSeconds = 9999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcCrossBorderLogisticsGatingHub rejects manifest depth exceeding maximum", () => {
    const hub = new PqcCrossBorderLogisticsGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.manifestDepth = 64;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcCrossBorderLogisticsGatingHub rejects un-attested customs authority initializer", () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcCrossBorderLogisticsGatingHub({
      policy: POLICY,
      attestationClient,
    });
    const request = baseInitRequest();
    request.customsAuthorityInitializerAttestation = { authority: "bad" };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("ZkManifestClaimValidator rejects un-attested trade corridor committee", () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const validator = new ZkManifestClaimValidator({
      policy: POLICY,
      hub,
      attestationClient,
    });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.tradeCorridorCommitteeAttestation = { authority: "bad" };
    expect(() => validator.verifyManifestClaim(clReq)).toThrow(HsmAdapterError);
  });

  test("PqcCrossBorderLogisticsGatingHub rejects unpermitted PQC signature scheme", () => {
    const hub = new PqcCrossBorderLogisticsGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = "RSA-2048";
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcCrossBorderLogisticsGatingHub rejects duplicate pool initialization", () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = "pool-dup";
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcCrossBorderLogisticsGatingHub rejects accreditation completion before manifest claim verification", () => {
    const { hub, pool } = setupAndInitPool();
    expect(() =>
      hub.completeAccreditation(baseCompleteRequest(pool.poolId)),
    ).toThrow(HsmAdapterError);
  });

  test("PqcCrossBorderLogisticsGatingHub rejects accreditation completion with insufficient quorum", () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ["sig-a"];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test("ZkManifestClaimValidator bans peers broadcasting malformed claims", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkManifestRangeProofHash = null;
    clReq.peerId = "peer-bad";
    expect(() => validator.verifyManifestClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkManifestClaimValidator bans peers broadcasting out-of-bounds transit windows", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.transitWindowSeconds = 9999999;
    clReq.peerId = "peer-bad";
    expect(() => validator.verifyManifestClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkManifestClaimValidator bans peers broadcasting duplicate claims", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = "peer-bad";
    validator.verifyManifestClaim(clReq);
    expect(() => validator.verifyManifestClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq logistics gating configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqLogisticsGating", {
        customsQuorum: 3,
        transitWindowSeconds: 3888000,
        manifestDepth: 16,
        pqcSignatureScheme: "ML-DSA-65",
        customsAuthorityInitializerAttestation: true,
        tradeCorridorCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderManifestClaims: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "pqLogisticsGating", { customsQuorum: 1 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLogisticsGating", {
        transitWindowSeconds: 9999999,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLogisticsGating", { manifestDepth: 64 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLogisticsGating", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLogisticsGating", {
        customsAuthorityInitializerAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLogisticsGating", {
        tradeCorridorCommitteeAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLogisticsGating", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLogisticsGating", {
        banMalformedOrOutOfOrderManifestClaims: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLogisticsGating", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
