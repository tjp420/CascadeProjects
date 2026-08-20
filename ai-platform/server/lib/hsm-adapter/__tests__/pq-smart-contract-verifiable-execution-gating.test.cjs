"use strict";

const {
  PqcSmartContractVerifiableExecutionGatingHub,
} = require("../pqc-smart-contract-verifiable-execution-gating-hub.cjs");
const {
  ZkExecutionClaimValidator,
} = require("../zk-execution-claim-validator.cjs");
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
  minExecutionQuorum: 10,
  maxExecutionWindowSeconds: 172800,
  maxExecutionChainDepth: 30,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireExecutionAuthorityInitializerAttestation: true,
  requireExecutionEthicsOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderExecutionClaims: true,
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
    blindedExecutionStateCommitment: "pedersen-exec-state-001",
    blindedComputationTraceCommitment: "pedersen-comp-trace-001",
    blindedExecutionAuthorityIdentityCommitment: "pedersen-exec-auth-001",
    executionWindowSeconds: 86400,
    executionChainDepth: 22,
    pqcSignatureScheme: "ML-DSA-65",
    executionAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    blindedExecutionStateCommitment: "pedersen-exec-state-001",
    blindedComputationTraceCommitment: "pedersen-comp-trace-001",
    blindedExecutionAuthorityIdentityCommitment: "pedersen-exec-auth-001",
    zkExecutionRangeProofHash: "zk-exec-proof-001",
    verifiableComputationProofHash: "vc-proof-hash-001",
    executionEthicsOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    executionEthicsOversightCommitteeAttestation: mockAttestation(),
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
    ],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcSmartContractVerifiableExecutionGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkExecutionClaimValidator({
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
  const claim = ctx.validator.verifyExecutionClaim(
    baseClaimRequest(ctx.pool.poolId),
  );
  return { ...ctx, claim };
}

describe("Track 104 PQ smart-contract verifiable execution gating", () => {
  test("initializes a pool and emits EXECUTION_POOL_INITIALIZED", () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe("open");
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === "EXECUTION_POOL_INITIALIZED")).toBe(
      true,
    );
  });

  test("verifies an execution claim and emits ZK_EXECUTION_CLAIM_VERIFIED", () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyExecutionClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(claim.verifiableComputationProofHash).toBe("vc-proof-hash-001");
    expect(events.some((e) => e.event === "ZK_EXECUTION_CLAIM_VERIFIED")).toBe(
      true,
    );
  });

  test("completes accreditation after claim and emits EXECUTION_ACCREDITATION_COMPLETED", () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(
      baseCompleteRequest(pool.poolId),
    );
    expect(completion.completionId).toBeDefined();
    expect(
      events.some((e) => e.event === "EXECUTION_ACCREDITATION_COMPLETED"),
    ).toBe(true);
  });

  test("rejects execution window exceeding maximum", () => {
    const hub = new PqcSmartContractVerifiableExecutionGatingHub({
      policy: POLICY,
    });
    const req = baseInitRequest();
    req.executionWindowSeconds = 999999;
    expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test("rejects execution chain depth exceeding maximum", () => {
    const hub = new PqcSmartContractVerifiableExecutionGatingHub({
      policy: POLICY,
    });
    const req = baseInitRequest();
    req.executionChainDepth = 34;
    expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test("rejects un-attested execution authority initializer", () => {
    const ac = new MockAttestationClient();
    const hub = new PqcSmartContractVerifiableExecutionGatingHub({
      policy: POLICY,
      attestationClient: ac,
    });
    const req = baseInitRequest();
    req.executionAuthorityInitializerAttestation = { authority: "bad" };
    expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test("rejects un-attested execution ethics oversight committee", () => {
    const { hub, pool } = setupAndInitPool();
    const ac = new MockAttestationClient();
    const v = new ZkExecutionClaimValidator({
      policy: POLICY,
      hub,
      attestationClient: ac,
    });
    const cr = baseClaimRequest(pool.poolId);
    cr.executionEthicsOversightCommitteeAttestation = { authority: "bad" };
    expect(() => v.verifyExecutionClaim(cr)).toThrow(HsmAdapterError);
  });

  test("rejects unpermitted PQC signature scheme", () => {
    const hub = new PqcSmartContractVerifiableExecutionGatingHub({
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

  test("rejects accreditation before execution claim verification", () => {
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

  test("bans peers broadcasting malformed claims (missing zkExecutionRangeProofHash)", () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId);
    cr.zkExecutionRangeProofHash = null;
    cr.peerId = "peer-bad";
    expect(() => validator.verifyExecutionClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("bans peers broadcasting missing verifiableComputationProofHash", () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId);
    cr.verifiableComputationProofHash = null;
    cr.peerId = "peer-bad";
    expect(() => validator.verifyExecutionClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("bans peers broadcasting duplicate claims", () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId);
    cr.peerId = "peer-bad";
    validator.verifyExecutionClaim(cr);
    expect(() => validator.verifyExecutionClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq smart-contract verifiable execution gating configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqSmartContractVerifiableExecutionGating", {
        executionQuorum: 10,
        executionWindowSeconds: 86400,
        executionChainDepth: 22,
        pqcSignatureScheme: "ML-DSA-65",
        executionAuthorityInitializerAttestation: true,
        executionEthicsOversightCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderExecutionClaims: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();
    expect(() =>
      engine.validate("t1", "pqSmartContractVerifiableExecutionGating", {
        executionQuorum: 2,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSmartContractVerifiableExecutionGating", {
        executionWindowSeconds: 999999,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSmartContractVerifiableExecutionGating", {
        executionChainDepth: 34,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSmartContractVerifiableExecutionGating", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSmartContractVerifiableExecutionGating", {
        executionAuthorityInitializerAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSmartContractVerifiableExecutionGating", {
        executionEthicsOversightCommitteeAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSmartContractVerifiableExecutionGating", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSmartContractVerifiableExecutionGating", {
        banMalformedOrOutOfOrderExecutionClaims: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqSmartContractVerifiableExecutionGating", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
