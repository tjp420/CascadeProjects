"use strict";

/**
 * Track 77: PQ Biometric Verification Gating tests.
 */
const {
  PqcBiometricVerificationGatingHub,
} = require("../pqc-biometric-verification-gating-hub.cjs");
const {
  ZkBiometricClaimValidator,
} = require("../zk-biometric-claim-validator.cjs");
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
  minBiometricAuthorityQuorum: 3,
  maxTemplateExpirationSeconds: 15552000,
  maxLivenessMetricDepth: 16,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireBiometricAuthorityInitializerAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderBiometricClaims: true,
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
    blindedTemplateHashCommitment: "pedersen-template-001",
    blindedLivenessMetricCommitment: "pedersen-liveness-001",
    blindedSubjectHashCommitment: "pedersen-subject-001",
    templateExpirationSeconds: 7776000,
    livenessMetricDepth: 8,
    pqcSignatureScheme: "ML-DSA-65",
    biometricAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    blindedLivenessMetricCommitment: "pedersen-liveness-001",
    blindedClaimValueCommitment: "pedersen-claimval-001",
    zkBiometricRangeProofHash: "zk-biometric-proof-001",
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: "committee-hash-001",
    attestationAuthority: "mock-authority",
    partialSignature: "partial-sig-001",
    templateExpirationSeconds: 7776000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    clearingCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    committeeSignatures: ["sig-a", "sig-b", "sig-c"],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcBiometricVerificationGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkBiometricClaimValidator({
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
  const claim = ctx.validator.verifyBiometricClaim(
    baseClaimRequest(ctx.pool.poolId),
  );
  return { ...ctx, claim };
}

describe("Track 77 PQ biometric verification gating", () => {
  test("PqcBiometricVerificationGatingHub initializes a pool and emits BIOMETRIC_GATING_POOL_INITIALIZED", () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe("open");
    expect(pool.poolId).toBeDefined();
    expect(
      events.some((e) => e.event === "BIOMETRIC_GATING_POOL_INITIALIZED"),
    ).toBe(true);
  });

  test("ZkBiometricClaimValidator verifies a biometric claim and emits ZK_BIOMETRIC_CLAIM_VERIFIED", () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyBiometricClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === "ZK_BIOMETRIC_CLAIM_VERIFIED")).toBe(
      true,
    );
  });

  test("PqcBiometricVerificationGatingHub completes accreditation after claim and emits LIVENESS_ATTESTATION_ACCREDITATION_COMPLETED", () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(
      baseCompleteRequest(pool.poolId),
    );
    expect(completion.completionId).toBeDefined();
    expect(
      events.some(
        (e) => e.event === "LIVENESS_ATTESTATION_ACCREDITATION_COMPLETED",
      ),
    ).toBe(true);
  });

  test("PqcBiometricVerificationGatingHub rejects template expiration exceeding maximum", () => {
    const hub = new PqcBiometricVerificationGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.templateExpirationSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcBiometricVerificationGatingHub rejects liveness metric depth exceeding maximum", () => {
    const hub = new PqcBiometricVerificationGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.livenessMetricDepth = 32;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcBiometricVerificationGatingHub rejects un-attested biometric authority initializer", () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcBiometricVerificationGatingHub({
      policy: POLICY,
      attestationClient,
    });
    const request = baseInitRequest();
    request.biometricAuthorityInitializerAttestation = { authority: "bad" };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("ZkBiometricClaimValidator rejects un-attested clearing committee", () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const validator = new ZkBiometricClaimValidator({
      policy: POLICY,
      hub,
      attestationClient,
    });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.clearingCommitteeAttestation = { authority: "bad" };
    expect(() => validator.verifyBiometricClaim(clReq)).toThrow(
      HsmAdapterError,
    );
  });

  test("PqcBiometricVerificationGatingHub rejects unpermitted PQC signature scheme", () => {
    const hub = new PqcBiometricVerificationGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = "RSA-2048";
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcBiometricVerificationGatingHub rejects duplicate pool initialization", () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = "pool-dup";
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcBiometricVerificationGatingHub rejects accreditation completion before biometric claim verification", () => {
    const { hub, pool } = setupAndInitPool();
    expect(() =>
      hub.completeAccreditation(baseCompleteRequest(pool.poolId)),
    ).toThrow(HsmAdapterError);
  });

  test("PqcBiometricVerificationGatingHub rejects accreditation completion with insufficient quorum", () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ["sig-a"];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test("ZkBiometricClaimValidator bans peers broadcasting malformed claims", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkBiometricRangeProofHash = null;
    clReq.peerId = "peer-bad";
    expect(() => validator.verifyBiometricClaim(clReq)).toThrow(
      HsmAdapterError,
    );
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkBiometricClaimValidator bans peers broadcasting out-of-bounds template expirations", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.templateExpirationSeconds = 99999999;
    clReq.peerId = "peer-bad";
    expect(() => validator.verifyBiometricClaim(clReq)).toThrow(
      HsmAdapterError,
    );
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkBiometricClaimValidator bans peers broadcasting duplicate claims", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = "peer-bad";
    validator.verifyBiometricClaim(clReq);
    expect(() => validator.verifyBiometricClaim(clReq)).toThrow(
      HsmAdapterError,
    );
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq biometric gating configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqBiometricGating", {
        biometricAuthorityQuorum: 3,
        templateExpirationSeconds: 7776000,
        livenessMetricDepth: 8,
        pqcSignatureScheme: "ML-DSA-65",
        biometricAuthorityInitializerAttestation: true,
        clearingCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderBiometricClaims: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "pqBiometricGating", {
        biometricAuthorityQuorum: 1,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBiometricGating", {
        templateExpirationSeconds: 99999999,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBiometricGating", { livenessMetricDepth: 32 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBiometricGating", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBiometricGating", {
        biometricAuthorityInitializerAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBiometricGating", {
        clearingCommitteeAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBiometricGating", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBiometricGating", {
        banMalformedOrOutOfOrderBiometricClaims: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBiometricGating", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
