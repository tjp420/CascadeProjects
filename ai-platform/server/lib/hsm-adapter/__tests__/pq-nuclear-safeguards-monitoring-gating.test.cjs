"use strict";

/**
 * Track 89: PQ Nuclear Safeguards Monitoring Gating tests.
 */
const {
  PqcNuclearSafeguardsMonitoringGatingHub,
} = require("../pqc-nuclear-safeguards-monitoring-gating-hub.cjs");
const {
  ZkSafeguardsClaimValidator,
} = require("../zk-safeguards-claim-validator.cjs");
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
  minSafeguardsQuorum: 6,
  maxInspectionWindowSeconds: 7776000,
  maxTelemetryChainDepth: 12,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireSafeguardsAuthorityInitializerAttestation: true,
  requireNuclearOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderSafeguardsClaims: true,
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
    blindedReactorTelemetryCommitment: "pedersen-reactor-001",
    blindedInspectionReportCommitment: "pedersen-inspection-001",
    blindedFacilityIdentityCommitment: "pedersen-facility-001",
    inspectionWindowSeconds: 3888000,
    telemetryChainDepth: 6,
    pqcSignatureScheme: "ML-DSA-65",
    safeguardsAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    blindedInspectionReportCommitment: "pedersen-inspection-001",
    blindedClaimValueCommitment: "pedersen-claimval-001",
    zkSafeguardsRangeProofHash: "zk-safeguards-proof-001",
    nuclearOversightCommitteeAttestation: mockAttestation(),
    nuclearOversightCommitteeAttestationHash: "committee-hash-001",
    attestationAuthority: "mock-authority",
    thresholdRingSignature: "threshold-ring-sig-001",
    inspectionWindowSeconds: 3888000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    nuclearOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    committeeSignatures: ["sig-a", "sig-b", "sig-c", "sig-d", "sig-e", "sig-f"],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcNuclearSafeguardsMonitoringGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkSafeguardsClaimValidator({
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
  const claim = ctx.validator.verifySafeguardsClaim(
    baseClaimRequest(ctx.pool.poolId),
  );
  return { ...ctx, claim };
}

describe("Track 89 PQ nuclear safeguards monitoring gating", () => {
  test("PqcNuclearSafeguardsMonitoringGatingHub initializes a pool and emits NUCLEAR_GATING_POOL_INITIALIZED", () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe("open");
    expect(pool.poolId).toBeDefined();
    expect(
      events.some((e) => e.event === "NUCLEAR_GATING_POOL_INITIALIZED"),
    ).toBe(true);
  });

  test("ZkSafeguardsClaimValidator verifies a safeguards claim and emits ZK_SAFEGUARDS_CLAIM_VERIFIED", () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifySafeguardsClaim(
      baseClaimRequest(pool.poolId),
    );
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === "ZK_SAFEGUARDS_CLAIM_VERIFIED")).toBe(
      true,
    );
  });

  test("PqcNuclearSafeguardsMonitoringGatingHub completes accreditation after claim and emits NUCLEAR_ACCREDITATION_COMPLETED", () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(
      baseCompleteRequest(pool.poolId),
    );
    expect(completion.completionId).toBeDefined();
    expect(
      events.some((e) => e.event === "NUCLEAR_ACCREDITATION_COMPLETED"),
    ).toBe(true);
  });

  test("PqcNuclearSafeguardsMonitoringGatingHub rejects inspection window exceeding maximum", () => {
    const hub = new PqcNuclearSafeguardsMonitoringGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.inspectionWindowSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcNuclearSafeguardsMonitoringGatingHub rejects telemetry chain depth exceeding maximum", () => {
    const hub = new PqcNuclearSafeguardsMonitoringGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.telemetryChainDepth = 24;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcNuclearSafeguardsMonitoringGatingHub rejects un-attested safeguards authority initializer", () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcNuclearSafeguardsMonitoringGatingHub({
      policy: POLICY,
      attestationClient,
    });
    const request = baseInitRequest();
    request.safeguardsAuthorityInitializerAttestation = { authority: "bad" };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("ZkSafeguardsClaimValidator rejects un-attested nuclear oversight committee", () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const validator = new ZkSafeguardsClaimValidator({
      policy: POLICY,
      hub,
      attestationClient,
    });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.nuclearOversightCommitteeAttestation = { authority: "bad" };
    expect(() => validator.verifySafeguardsClaim(clReq)).toThrow(
      HsmAdapterError,
    );
  });

  test("PqcNuclearSafeguardsMonitoringGatingHub rejects unpermitted PQC signature scheme", () => {
    const hub = new PqcNuclearSafeguardsMonitoringGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = "RSA-2048";
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcNuclearSafeguardsMonitoringGatingHub rejects duplicate pool initialization", () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = "pool-dup";
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcNuclearSafeguardsMonitoringGatingHub rejects accreditation completion before safeguards claim verification", () => {
    const { hub, pool } = setupAndInitPool();
    expect(() =>
      hub.completeAccreditation(baseCompleteRequest(pool.poolId)),
    ).toThrow(HsmAdapterError);
  });

  test("PqcNuclearSafeguardsMonitoringGatingHub rejects accreditation completion with insufficient quorum", () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ["sig-a", "sig-b", "sig-c"];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test("ZkSafeguardsClaimValidator bans peers broadcasting malformed claims", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkSafeguardsRangeProofHash = null;
    clReq.peerId = "peer-bad";
    expect(() => validator.verifySafeguardsClaim(clReq)).toThrow(
      HsmAdapterError,
    );
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkSafeguardsClaimValidator bans peers broadcasting out-of-bounds inspection windows", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.inspectionWindowSeconds = 99999999;
    clReq.peerId = "peer-bad";
    expect(() => validator.verifySafeguardsClaim(clReq)).toThrow(
      HsmAdapterError,
    );
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkSafeguardsClaimValidator bans peers broadcasting duplicate claims", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = "peer-bad";
    validator.verifySafeguardsClaim(clReq);
    expect(() => validator.verifySafeguardsClaim(clReq)).toThrow(
      HsmAdapterError,
    );
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq nuclear gating configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqNuclearGating", {
        safeguardsQuorum: 6,
        inspectionWindowSeconds: 3888000,
        telemetryChainDepth: 6,
        pqcSignatureScheme: "ML-DSA-65",
        safeguardsAuthorityInitializerAttestation: true,
        nuclearOversightCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderSafeguardsClaims: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "pqNuclearGating", { safeguardsQuorum: 3 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqNuclearGating", {
        inspectionWindowSeconds: 99999999,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqNuclearGating", { telemetryChainDepth: 24 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqNuclearGating", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqNuclearGating", {
        safeguardsAuthorityInitializerAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqNuclearGating", {
        nuclearOversightCommitteeAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqNuclearGating", { attestationAuthority: "bad" }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqNuclearGating", {
        banMalformedOrOutOfOrderSafeguardsClaims: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqNuclearGating", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
