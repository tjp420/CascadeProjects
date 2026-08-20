"use strict";

const {
  PqcSpaceBasedLaserCommunicationMeshGatingHub,
} = require("../pqc-space-based-laser-communication-mesh-gating-hub.cjs");
const {
  ZkLaserMeshClaimValidator,
} = require("../zk-laser-mesh-claim-validator.cjs");
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
  minLaserMeshQuorum: 16,
  maxHandoffWindowSeconds: 300,
  maxLaserMeshChainDepth: 40,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireLaserMeshAuthorityInitializerAttestation: true,
  requireLaserEthicsOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderLaserMeshClaims: true,
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
    sourceSatelliteId: "sat-001",
    targetSatelliteId: "sat-002",
    blindedLaserLinkDigestCommitment: "pedersen-laser-link-001",
    blindedTimedReleaseKeyCommitment: "pedersen-trk-001",
    blindedOrbitalHandoffIdentityCommitment: "pedersen-orbital-handoff-001",
    handoffWindowSeconds: 300,
    laserMeshChainDepth: 22,
    pqcSignatureScheme: "ML-DSA-65",
    laserMeshAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    blindedLaserLinkDigestCommitment: "pedersen-laser-link-001",
    blindedTimedReleaseKeyCommitment: "pedersen-trk-001",
    blindedOrbitalHandoffIdentityCommitment: "pedersen-orbital-handoff-001",
    zkLaserMeshRangeProofHash: "zk-laser-mesh-proof-001",
    timedReleaseKeyDigest: "trk-digest-001",
    laserEthicsOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    laserEthicsOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    committeeSignatures: [
      "sig-a",
      "sig-b",
      "sig-c",
      "sig-d",
      "sig-e",
      "sig-f",
      "sig-g",
      "sig-h",
      "sig-i",
      "sig-j",
      "sig-k",
      "sig-l",
      "sig-m",
      "sig-n",
      "sig-o",
      "sig-p",
    ],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcSpaceBasedLaserCommunicationMeshGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkLaserMeshClaimValidator({
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
  const claim = ctx.validator.verifyLaserMeshClaim(
    baseClaimRequest(ctx.pool.poolId),
  );
  return { ...ctx, claim };
}

describe("Track 108 PQ space-based laser communication mesh gating", () => {
  test("initializes a pool and emits LASER_MESH_POOL_INITIALIZED", () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe("open");
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === "LASER_MESH_POOL_INITIALIZED")).toBe(
      true,
    );
  });

  test("verifies a laser mesh claim and emits ZK_LASER_MESH_CLAIM_VERIFIED", () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyLaserMeshClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(claim.timedReleaseKeyDigest).toBe("trk-digest-001");
    expect(events.some((e) => e.event === "ZK_LASER_MESH_CLAIM_VERIFIED")).toBe(
      true,
    );
  });

  test("completes accreditation after claim and emits HANDOFF_ACCREDITATION_COMPLETED", () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(
      baseCompleteRequest(pool.poolId),
    );
    expect(completion.completionId).toBeDefined();
    expect(
      events.some((e) => e.event === "HANDOFF_ACCREDITATION_COMPLETED"),
    ).toBe(true);
  });

  test("rejects handoff window exceeding maximum", () => {
    const hub = new PqcSpaceBasedLaserCommunicationMeshGatingHub({
      policy: POLICY,
    });
    const req = baseInitRequest();
    req.handoffWindowSeconds = 999999;
    expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test("rejects laser mesh chain depth exceeding maximum", () => {
    const hub = new PqcSpaceBasedLaserCommunicationMeshGatingHub({
      policy: POLICY,
    });
    const req = baseInitRequest();
    req.laserMeshChainDepth = 42;
    expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test("rejects un-attested laser mesh authority initializer", () => {
    const ac = new MockAttestationClient();
    const hub = new PqcSpaceBasedLaserCommunicationMeshGatingHub({
      policy: POLICY,
      attestationClient: ac,
    });
    const req = baseInitRequest();
    req.laserMeshAuthorityInitializerAttestation = { authority: "bad" };
    expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test("rejects un-attested laser ethics oversight committee", () => {
    const { hub, pool } = setupAndInitPool();
    const ac = new MockAttestationClient();
    const v = new ZkLaserMeshClaimValidator({
      policy: POLICY,
      hub,
      attestationClient: ac,
    });
    const cr = baseClaimRequest(pool.poolId);
    cr.laserEthicsOversightCommitteeAttestation = { authority: "bad" };
    expect(() => v.verifyLaserMeshClaim(cr)).toThrow(HsmAdapterError);
  });

  test("rejects unpermitted PQC signature scheme", () => {
    const hub = new PqcSpaceBasedLaserCommunicationMeshGatingHub({
      policy: POLICY,
    });
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

  test("rejects accreditation before laser mesh claim verification", () => {
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

  test("bans peers broadcasting malformed claims (missing zkLaserMeshRangeProofHash)", () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId);
    cr.zkLaserMeshRangeProofHash = null;
    cr.peerId = "peer-bad";
    expect(() => validator.verifyLaserMeshClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("bans peers broadcasting missing timedReleaseKeyDigest", () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId);
    cr.timedReleaseKeyDigest = null;
    cr.peerId = "peer-bad";
    expect(() => validator.verifyLaserMeshClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("bans peers broadcasting duplicate claims", () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId);
    cr.peerId = "peer-bad";
    validator.verifyLaserMeshClaim(cr);
    expect(() => validator.verifyLaserMeshClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq space-based laser communication mesh gating configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqSpaceBasedLaserCommunicationMeshGating", {
        laserMeshQuorum: 16,
        handoffWindowSeconds: 300,
        laserMeshChainDepth: 22,
        pqcSignatureScheme: "ML-DSA-65",
        laserMeshAuthorityInitializerAttestation: true,
        laserEthicsOversightCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderLaserMeshClaims: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();
    expect(() =>
      engine.validate("t1", "pqSpaceBasedLaserCommunicationMeshGating", {
        laserMeshQuorum: 2,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSpaceBasedLaserCommunicationMeshGating", {
        handoffWindowSeconds: 999999,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSpaceBasedLaserCommunicationMeshGating", {
        laserMeshChainDepth: 42,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSpaceBasedLaserCommunicationMeshGating", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSpaceBasedLaserCommunicationMeshGating", {
        laserMeshAuthorityInitializerAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSpaceBasedLaserCommunicationMeshGating", {
        laserEthicsOversightCommitteeAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSpaceBasedLaserCommunicationMeshGating", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSpaceBasedLaserCommunicationMeshGating", {
        banMalformedOrOutOfOrderLaserMeshClaims: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSpaceBasedLaserCommunicationMeshGating", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
