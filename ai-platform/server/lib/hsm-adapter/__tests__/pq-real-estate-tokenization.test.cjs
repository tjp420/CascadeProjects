"use strict";

/**
 * Track 69: PQ Real Estate Tokenization tests.
 */
const {
  PqcRealEstateTokenizationHub,
} = require("../pqc-real-estate-tokenization-hub.cjs");
const {
  ZkTitleDeedMilestoneValidator,
} = require("../zk-title-deed-milestone-validator.cjs");
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
  minCoSignerQuorum: 3,
  maxLegalDisputeSeconds: 2592000,
  maxAssetValuationCap: 1000000000,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireAssetInitializerAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderTitleDeedAssertions: true,
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
    blindedRealEstateValueCommitment: "pedersen-revalue-001",
    blindedEncumbranceBalanceCommitment: "pedersen-encumbrance-001",
    blindedFractionalShareCommitment: "pedersen-fractional-001",
    legalDisputeSeconds: 1296000,
    assetValuationCap: 1000000,
    pqcSignatureScheme: "ML-DSA-65",
    assetInitializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseClearanceRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    blindedEncumbranceBalanceCommitment: "pedersen-encumbrance-001",
    blindedClearanceValueCommitment: "pedersen-clearance-001",
    zkEncumbranceRangeProofHash: "zk-encumbrance-proof-001",
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: "committee-hash-001",
    attestationAuthority: "mock-authority",
    partialSignature: "partial-sig-001",
    disputeSeconds: 1000000,
  };
}

function baseTransferRequest(poolId) {
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
  const hub = new PqcRealEstateTokenizationHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkTitleDeedMilestoneValidator({
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

function setupInitAndClearance() {
  const ctx = setupAndInitPool();
  const clearance = ctx.validator.verifyEncumbranceClearance(
    baseClearanceRequest(ctx.pool.poolId),
  );
  return { ...ctx, clearance };
}

describe("Track 69 PQ real estate tokenization", () => {
  test("PqcRealEstateTokenizationHub initializes a pool and emits REAL_ESTATE_POOL_INITIALIZED", () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe("open");
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === "REAL_ESTATE_POOL_INITIALIZED")).toBe(
      true,
    );
  });

  test("ZkTitleDeedMilestoneValidator verifies encumbrance clearance and emits ZK_ENCUMBRANCE_CLEARANCE_VERIFIED", () => {
    const { events, validator, pool } = setupAndInitPool();
    const clearance = validator.verifyEncumbranceClearance(
      baseClearanceRequest(pool.poolId),
    );
    expect(clearance.clearanceId).toBeDefined();
    expect(
      events.some((e) => e.event === "ZK_ENCUMBRANCE_CLEARANCE_VERIFIED"),
    ).toBe(true);
  });

  test("PqcRealEstateTokenizationHub finalizes a transfer after clearance and emits TITLE_DEED_TRANSFER_FINALIZED", () => {
    const { events, hub, pool } = setupInitAndClearance();
    const transfer = hub.finalizeTitleDeedTransfer(
      baseTransferRequest(pool.poolId),
    );
    expect(transfer.transferId).toBeDefined();
    expect(
      events.some((e) => e.event === "TITLE_DEED_TRANSFER_FINALIZED"),
    ).toBe(true);
  });

  test("PqcRealEstateTokenizationHub rejects legal dispute seconds exceeding maximum", () => {
    const hub = new PqcRealEstateTokenizationHub({ policy: POLICY });
    const request = baseInitRequest();
    request.legalDisputeSeconds = 5000000;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcRealEstateTokenizationHub rejects asset valuation cap exceeding maximum", () => {
    const hub = new PqcRealEstateTokenizationHub({ policy: POLICY });
    const request = baseInitRequest();
    request.assetValuationCap = 2000000000;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcRealEstateTokenizationHub rejects un-attested asset initializer", () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcRealEstateTokenizationHub({
      policy: POLICY,
      attestationClient,
    });
    const request = baseInitRequest();
    request.assetInitializerAttestation = { authority: "bad" };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("ZkTitleDeedMilestoneValidator rejects un-attested clearing committee", () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const validator = new ZkTitleDeedMilestoneValidator({
      policy: POLICY,
      hub,
      attestationClient,
    });
    const clReq = baseClearanceRequest(pool.poolId);
    clReq.clearingCommitteeAttestation = { authority: "bad" };
    expect(() => validator.verifyEncumbranceClearance(clReq)).toThrow(
      HsmAdapterError,
    );
  });

  test("PqcRealEstateTokenizationHub rejects unpermitted PQC signature scheme", () => {
    const hub = new PqcRealEstateTokenizationHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = "RSA-2048";
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcRealEstateTokenizationHub rejects duplicate pool initialization", () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = "pool-dup";
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcRealEstateTokenizationHub rejects transfer before encumbrance clearance verification", () => {
    const { hub, pool } = setupAndInitPool();
    expect(() =>
      hub.finalizeTitleDeedTransfer(baseTransferRequest(pool.poolId)),
    ).toThrow(HsmAdapterError);
  });

  test("PqcRealEstateTokenizationHub rejects transfer with insufficient quorum", () => {
    const { hub, pool } = setupInitAndClearance();
    const trReq = baseTransferRequest(pool.poolId);
    trReq.committeeSignatures = ["sig-a"];
    expect(() => hub.finalizeTitleDeedTransfer(trReq)).toThrow(HsmAdapterError);
  });

  test("ZkTitleDeedMilestoneValidator bans peers broadcasting malformed clearances", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClearanceRequest(pool.poolId);
    clReq.zkEncumbranceRangeProofHash = null;
    clReq.peerId = "peer-bad";
    expect(() => validator.verifyEncumbranceClearance(clReq)).toThrow(
      HsmAdapterError,
    );
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkTitleDeedMilestoneValidator bans peers broadcasting out-of-bounds dispute windows", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClearanceRequest(pool.poolId);
    clReq.disputeSeconds = 9999999;
    clReq.peerId = "peer-bad";
    expect(() => validator.verifyEncumbranceClearance(clReq)).toThrow(
      HsmAdapterError,
    );
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkTitleDeedMilestoneValidator bans peers broadcasting duplicate clearances", () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClearanceRequest(pool.poolId);
    clReq.peerId = "peer-bad";
    validator.verifyEncumbranceClearance(clReq);
    expect(() => validator.verifyEncumbranceClearance(clReq)).toThrow(
      HsmAdapterError,
    );
    expect(validator.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq real estate tokenization configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqRealEstateTokenization", {
        coSignerQuorum: 3,
        legalDisputeSeconds: 1296000,
        assetValuationCap: 1000000,
        pqcSignatureScheme: "ML-DSA-65",
        assetInitializerAttestation: true,
        clearingCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderTitleDeedAssertions: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "pqRealEstateTokenization", { coSignerQuorum: 1 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqRealEstateTokenization", {
        legalDisputeSeconds: 5000000,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqRealEstateTokenization", {
        assetValuationCap: 2000000000,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqRealEstateTokenization", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqRealEstateTokenization", {
        assetInitializerAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqRealEstateTokenization", {
        clearingCommitteeAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqRealEstateTokenization", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqRealEstateTokenization", {
        banMalformedOrOutOfOrderTitleDeedAssertions: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqRealEstateTokenization", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
