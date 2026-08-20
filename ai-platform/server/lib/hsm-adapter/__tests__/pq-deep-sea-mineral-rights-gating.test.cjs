"use strict";

const {
  PqcDeepSeaMineralRightsGatingHub,
} = require("../pqc-deep-sea-mineral-rights-gating-hub.cjs");
const {
  ZkExtractionClaimValidator,
} = require("../zk-extraction-claim-validator.cjs");
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
  minSovereignQuorum: 6,
  maxLeaseWindowSeconds: 31536000,
  maxExtractionChainDepth: 15,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireIsaAuthorityInitializerAttestation: true,
  requireSeabedOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderExtractionClaims: true,
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
    blindedMineralSurveyCommitment: "pedersen-mineralsurvey-001",
    blindedExtractionVolumeCommitment: "pedersen-extractionvolume-001",
    blindedSovereignAuthorityIdentityCommitment: "pedersen-sovereign-001",
    leaseWindowSeconds: 15552000,
    extractionChainDepth: 8,
    pqcSignatureScheme: "ML-DSA-65",
    isaAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    blindedExtractionVolumeCommitment: "pedersen-extractionvolume-001",
    blindedClaimValueCommitment: "pedersen-claimval-001",
    zkExtractionRangeProofHash: "zk-extraction-proof-001",
    seabedOversightCommitteeAttestation: mockAttestation(),
    seabedOversightCommitteeAttestationHash: "committee-hash-001",
    attestationAuthority: "mock-authority",
    abeKeyPolicyDigest: "abe-key-policy-digest-001",
    leaseWindowSeconds: 15552000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    seabedOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    committeeSignatures: ["sig-a", "sig-b", "sig-c", "sig-d", "sig-e", "sig-f"],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcDeepSeaMineralRightsGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkExtractionClaimValidator({
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
  const claim = ctx.validator.verifyExtractionClaim(
    baseClaimRequest(ctx.pool.poolId),
  );
  return { ...ctx, claim };
}

describe("Track 95 PQ deep-sea mineral rights gating", () => {
  test("initializes a pool and emits SEABED_GATING_POOL_INITIALIZED", () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe("open");
    expect(pool.poolId).toBeDefined();
    expect(
      events.some((e) => e.event === "SEABED_GATING_POOL_INITIALIZED"),
    ).toBe(true);
  });

  test("verifies an extraction claim and emits ZK_EXTRACTION_CLAIM_VERIFIED", () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyExtractionClaim(
      baseClaimRequest(pool.poolId),
    );
    expect(claim.claimId).toBeDefined();
    expect(claim.abeKeyPolicyDigest).toBe("abe-key-policy-digest-001");
    expect(events.some((e) => e.event === "ZK_EXTRACTION_CLAIM_VERIFIED")).toBe(
      true,
    );
  });

  test("completes accreditation after claim and emits LEASE_ACCREDITATION_COMPLETED", () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(
      baseCompleteRequest(pool.poolId),
    );
    expect(completion.completionId).toBeDefined();
    expect(
      events.some((e) => e.event === "LEASE_ACCREDITATION_COMPLETED"),
    ).toBe(true);
  });

  test("rejects lease window exceeding maximum", () => {
    const hub = new PqcDeepSeaMineralRightsGatingHub({ policy: POLICY });
    const req = baseInitRequest();
    req.leaseWindowSeconds = 99999999;
    expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test("rejects extraction chain depth exceeding maximum", () => {
    const hub = new PqcDeepSeaMineralRightsGatingHub({ policy: POLICY });
    const req = baseInitRequest();
    req.extractionChainDepth = 30;
    expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test("rejects un-attested ISA authority initializer", () => {
    const ac = new MockAttestationClient();
    const hub = new PqcDeepSeaMineralRightsGatingHub({
      policy: POLICY,
      attestationClient: ac,
    });
    const req = baseInitRequest();
    req.isaAuthorityInitializerAttestation = { authority: "bad" };
    expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test("rejects un-attested seabed oversight committee", () => {
    const { hub, pool } = setupAndInitPool();
    const ac = new MockAttestationClient();
    const v = new ZkExtractionClaimValidator({
      policy: POLICY,
      hub,
      attestationClient: ac,
    });
    const cr = baseClaimRequest(pool.poolId);
    cr.seabedOversightCommitteeAttestation = { authority: "bad" };
    expect(() => v.verifyExtractionClaim(cr)).toThrow(HsmAdapterError);
  });

  test("rejects unpermitted PQC signature scheme", () => {
    const hub = new PqcDeepSeaMineralRightsGatingHub({ policy: POLICY });
    const req = baseInitRequest();
    req.pqcSignatureScheme = "RSA-2048";
    expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test("rejects duplicate pool initialization", () => {
    const { hub } = setupHubAndValidator();
    const req = baseInitRequest();
    req.poolId = "pool-dup";
    hub.initializePool(req);
    expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test("rejects accreditation before extraction claim verification", () => {
    const { hub, pool } = setupAndInitPool();
    expect(() =>
      hub.completeAccreditation(baseCompleteRequest(pool.poolId)),
    ).toThrow(HsmAdapterError);
  });

  test("rejects accreditation with insufficient quorum", () => {
    const { hub, pool } = setupInitAndClaim();
    const cr = baseCompleteRequest(pool.poolId);
    cr.committeeSignatures = ["sig-a", "sig-b", "sig-c"];
    expect(() => hub.completeAccreditation(cr)).toThrow(HsmAdapterError);
  });

  test("bans peers broadcasting malformed claims", () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId);
    cr.zkExtractionRangeProofHash = null;
    cr.peerId = "peer-bad";
    expect(() => validator.verifyExtractionClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("bans peers broadcasting missing ABE key policy digest", () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId);
    cr.abeKeyPolicyDigest = null;
    cr.peerId = "peer-bad";
    expect(() => validator.verifyExtractionClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("bans peers broadcasting duplicate claims", () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId);
    cr.peerId = "peer-bad";
    validator.verifyExtractionClaim(cr);
    expect(() => validator.verifyExtractionClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq seabed gating configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqSeabedGating", {
        sovereignQuorum: 6,
        leaseWindowSeconds: 15552000,
        extractionChainDepth: 8,
        pqcSignatureScheme: "ML-DSA-65",
        isaAuthorityInitializerAttestation: true,
        seabedOversightCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderExtractionClaims: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();
    expect(() =>
      engine.validate("t1", "pqSeabedGating", { sovereignQuorum: 2 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSeabedGating", { leaseWindowSeconds: 99999999 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSeabedGating", { extractionChainDepth: 30 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSeabedGating", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSeabedGating", {
        isaAuthorityInitializerAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSeabedGating", {
        seabedOversightCommitteeAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSeabedGating", { attestationAuthority: "bad" }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSeabedGating", {
        banMalformedOrOutOfOrderExtractionClaims: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSeabedGating", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
