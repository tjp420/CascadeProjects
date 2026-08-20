"use strict";

const {
  PqcOrbitalDebrisTrackingGatingHub,
} = require("../pqc-orbital-debris-tracking-gating-hub.cjs");
const { ZkDebrisClaimValidator } = require("../zk-debris-claim-validator.cjs");
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
  minOrbitalQuorum: 5,
  maxCollisionWindowSeconds: 15768000,
  maxTrackingChainDepth: 18,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireSpaceSurveillanceAuthorityInitializerAttestation: true,
  requireOrbitalDebrisOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderDebrisClaims: true,
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
    blindedDebrisTrajectoryCommitment: "pedersen-debris-trajectory-001",
    blindedCollisionProbabilityCommitment: "pedersen-collision-prob-001",
    blindedSurveillanceAuthorityIdentityCommitment:
      "pedersen-surveillance-auth-001",
    collisionWindowSeconds: 7776000,
    trackingChainDepth: 10,
    pqcSignatureScheme: "ML-DSA-65",
    spaceSurveillanceAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    blindedDebrisTrajectoryCommitment: "pedersen-debris-trajectory-001",
    blindedCollisionProbabilityCommitment: "pedersen-collision-prob-001",
    blindedSurveillanceAuthorityIdentityCommitment:
      "pedersen-surveillance-auth-001",
    zkDebrisRangeProofHash: "zk-debris-proof-001",
    homomorphicHashCommitment: "homomorphic-hash-commit-001",
    orbitalDebrisOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    orbitalDebrisOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    committeeSignatures: ["sig-a", "sig-b", "sig-c", "sig-d", "sig-e"],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcOrbitalDebrisTrackingGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkDebrisClaimValidator({
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
  const claim = ctx.validator.verifyDebrisClaim(
    baseClaimRequest(ctx.pool.poolId),
  );
  return { ...ctx, claim };
}

describe("Track 98 PQ orbital debris tracking gating", () => {
  test("initializes a pool and emits ORBITAL_DEBRIS_POOL_INITIALIZED", () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe("open");
    expect(pool.poolId).toBeDefined();
    expect(
      events.some((e) => e.event === "ORBITAL_DEBRIS_POOL_INITIALIZED"),
    ).toBe(true);
  });

  test("verifies a debris claim and emits ZK_DEBRIS_CLAIM_VERIFIED", () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyDebrisClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(claim.homomorphicHashCommitment).toBe("homomorphic-hash-commit-001");
    expect(events.some((e) => e.event === "ZK_DEBRIS_CLAIM_VERIFIED")).toBe(
      true,
    );
  });

  test("completes accreditation after claim and emits COLLISION_ACCREDITATION_COMPLETED", () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(
      baseCompleteRequest(pool.poolId),
    );
    expect(completion.completionId).toBeDefined();
    expect(
      events.some((e) => e.event === "COLLISION_ACCREDITATION_COMPLETED"),
    ).toBe(true);
  });

  test("rejects collision window exceeding maximum", () => {
    const hub = new PqcOrbitalDebrisTrackingGatingHub({ policy: POLICY });
    const req = baseInitRequest();
    req.collisionWindowSeconds = 99999999;
    expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test("rejects tracking chain depth exceeding maximum", () => {
    const hub = new PqcOrbitalDebrisTrackingGatingHub({ policy: POLICY });
    const req = baseInitRequest();
    req.trackingChainDepth = 30;
    expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test("rejects un-attested space surveillance authority initializer", () => {
    const ac = new MockAttestationClient();
    const hub = new PqcOrbitalDebrisTrackingGatingHub({
      policy: POLICY,
      attestationClient: ac,
    });
    const req = baseInitRequest();
    req.spaceSurveillanceAuthorityInitializerAttestation = { authority: "bad" };
    expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test("rejects un-attested orbital debris oversight committee", () => {
    const { hub, pool } = setupAndInitPool();
    const ac = new MockAttestationClient();
    const v = new ZkDebrisClaimValidator({
      policy: POLICY,
      hub,
      attestationClient: ac,
    });
    const cr = baseClaimRequest(pool.poolId);
    cr.orbitalDebrisOversightCommitteeAttestation = { authority: "bad" };
    expect(() => v.verifyDebrisClaim(cr)).toThrow(HsmAdapterError);
  });

  test("rejects unpermitted PQC signature scheme", () => {
    const hub = new PqcOrbitalDebrisTrackingGatingHub({ policy: POLICY });
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

  test("rejects accreditation before debris claim verification", () => {
    const { hub, pool } = setupAndInitPool();
    expect(() =>
      hub.completeAccreditation(baseCompleteRequest(pool.poolId)),
    ).toThrow(HsmAdapterError);
  });

  test("rejects accreditation with insufficient quorum", () => {
    const { hub, pool } = setupInitAndClaim();
    const cr = baseCompleteRequest(pool.poolId);
    cr.committeeSignatures = ["sig-a", "sig-b"];
    expect(() => hub.completeAccreditation(cr)).toThrow(HsmAdapterError);
  });

  test("bans peers broadcasting malformed claims (missing zkDebrisRangeProofHash)", () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId);
    cr.zkDebrisRangeProofHash = null;
    cr.peerId = "peer-bad";
    expect(() => validator.verifyDebrisClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("bans peers broadcasting missing homomorphicHashCommitment", () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId);
    cr.homomorphicHashCommitment = null;
    cr.peerId = "peer-bad";
    expect(() => validator.verifyDebrisClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("bans peers broadcasting duplicate claims", () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId);
    cr.peerId = "peer-bad";
    validator.verifyDebrisClaim(cr);
    expect(() => validator.verifyDebrisClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq orbital debris tracking gating configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqOrbitalDebrisTrackingGating", {
        orbitalQuorum: 5,
        collisionWindowSeconds: 7776000,
        trackingChainDepth: 10,
        pqcSignatureScheme: "ML-DSA-65",
        spaceSurveillanceAuthorityInitializerAttestation: true,
        orbitalDebrisOversightCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderDebrisClaims: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();
    expect(() =>
      engine.validate("t1", "pqOrbitalDebrisTrackingGating", {
        orbitalQuorum: 2,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqOrbitalDebrisTrackingGating", {
        collisionWindowSeconds: 99999999,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqOrbitalDebrisTrackingGating", {
        trackingChainDepth: 30,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqOrbitalDebrisTrackingGating", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqOrbitalDebrisTrackingGating", {
        spaceSurveillanceAuthorityInitializerAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqOrbitalDebrisTrackingGating", {
        orbitalDebrisOversightCommitteeAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqOrbitalDebrisTrackingGating", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqOrbitalDebrisTrackingGating", {
        banMalformedOrOutOfOrderDebrisClaims: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqOrbitalDebrisTrackingGating", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
