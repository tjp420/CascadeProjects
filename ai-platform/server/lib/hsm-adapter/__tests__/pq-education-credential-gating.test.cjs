"use strict";

/**
 * Track 73: PQ Education Credential Gating tests.
 */
const {
  PqcEducationCredentialGatingHub,
} = require("../pqc-education-credential-gating-hub.cjs");
const {
  ZkAcademicCredentialValidator,
} = require("../zk-academic-credential-validator.cjs");
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
  minAccreditationQuorum: 3,
  maxTranscriptExpirationSeconds: 31536000,
  maxAcademicCredentialDepth: 24,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireInstitutionInitializerAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderCredentialClaims: true,
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
    blindedTranscriptCommitment: "pedersen-transcript-001",
    blindedAccreditationMetricCommitment: "pedersen-accred-001",
    blindedInstitutionHashCommitment: "pedersen-insthash-001",
    transcriptExpirationSeconds: 15552000,
    credentialDepth: 12,
    pqcSignatureScheme: "ML-DSA-65",
    institutionInitializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    blindedAccreditationMetricCommitment: "pedersen-accred-001",
    blindedClaimValueCommitment: "pedersen-claimval-001",
    zkAcademicRangeProofHash: "zk-academic-proof-001",
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: "committee-hash-001",
    attestationAuthority: "mock-authority",
    partialSignature: "partial-sig-001",
    transcriptExpirationSeconds: 15552000,
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
  const hub = new PqcEducationCredentialGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkAcademicCredentialValidator({
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
  const claim = ctx.validator.verifyAcademicClaim(
    baseClaimRequest(ctx.pool.poolId),
  );
  return { ...ctx, claim };
}

describe("Track 73 PQ education credential gating", () => {
  test("PqcEducationCredentialGatingHub initializes a pool and emits EDUCATION_GATING_POOL_INITIALIZED", () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe("open");
    expect(pool.poolId).toBeDefined();
    expect(
      events.some((e) => e.event === "EDUCATION_GATING_POOL_INITIALIZED"),
    ).toBe(true);
  });

  test("ZkAcademicCredentialValidator verifies an academic claim and emits ZK_ACADEMIC_CLAIM_VERIFIED", () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyAcademicClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === "ZK_ACADEMIC_CLAIM_VERIFIED")).toBe(
      true,
    );
  });

  test("PqcEducationCredentialGatingHub completes accreditation after claim and emits CREDENTIAL_ACCREDITATION_COMPLETED", () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(
      baseCompleteRequest(pool.poolId),
    );
    expect(completion.completionId).toBeDefined();
    expect(
      events.some((e) => e.event === "CREDENTIAL_ACCREDITATION_COMPLETED"),
    ).toBe(true);
  });

  test("PqcEducationCredentialGatingHub rejects transcript expiration exceeding maximum", () => {
    const hub = new PqcEducationCredentialGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.transcriptExpirationSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcEducationCredentialGatingHub rejects credential depth exceeding maximum", () => {
    const hub = new PqcEducationCredentialGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.credentialDepth = 48;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcEducationCredentialGatingHub rejects un-attested institution initializer", () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcEducationCredentialGatingHub({
      policy: POLICY,
      attestationClient,
    });
    const request = baseInitRequest();
    request.institutionInitializerAttestation = { authority: "bad" };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("ZkAcademicCredentialValidator rejects un-attested clearing committee", () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const validator = new ZkAcademicCredentialValidator({
      policy: POLICY,
      hub,
      attestationClient,
    });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.clearingCommitteeAttestation = { authority: "bad" };
    expect(() => validator.verifyAcademicClaim(clReq)).toThrow(HsmAdapterError);
  });

  test("PqcEducationCredentialGatingHub rejects unpermitted PQC signature scheme", () => {
    const hub = new PqcEducationCredentialGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = "RSA-2048";
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcEducationCredentialGatingHub rejects duplicate pool initialization", () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = "pool-dup";
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcEducationCredentialGatingHub rejects accreditation completion before academic claim verification", () => {
    const { hub, pool } = setupAndInitPool();
    expect(() =>
      hub.completeAccreditation(baseCompleteRequest(pool.poolId)),
    ).toThrow(HsmAdapterError);
  });

  test("PqcEducationCredentialGatingHub rejects accreditation completion with insufficient quorum", () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ["sig-a"];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test("ZkAcademicCredentialValidator bans peers broadcasting malformed claims", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkAcademicRangeProofHash = null;
    clReq.peerId = "peer-bad";
    expect(() => validator.verifyAcademicClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkAcademicCredentialValidator bans peers broadcasting out-of-bounds transcript expirations", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.transcriptExpirationSeconds = 99999999;
    clReq.peerId = "peer-bad";
    expect(() => validator.verifyAcademicClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkAcademicCredentialValidator bans peers broadcasting duplicate claims", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = "peer-bad";
    validator.verifyAcademicClaim(clReq);
    expect(() => validator.verifyAcademicClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq education gating configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqEducationGating", {
        accreditationQuorum: 3,
        transcriptExpirationSeconds: 15552000,
        academicCredentialDepth: 12,
        pqcSignatureScheme: "ML-DSA-65",
        institutionInitializerAttestation: true,
        clearingCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderCredentialClaims: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "pqEducationGating", { accreditationQuorum: 1 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqEducationGating", {
        transcriptExpirationSeconds: 99999999,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqEducationGating", {
        academicCredentialDepth: 48,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqEducationGating", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqEducationGating", {
        institutionInitializerAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqEducationGating", {
        clearingCommitteeAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqEducationGating", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqEducationGating", {
        banMalformedOrOutOfOrderCredentialClaims: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqEducationGating", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
