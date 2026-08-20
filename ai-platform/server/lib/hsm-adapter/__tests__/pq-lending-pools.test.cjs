"use strict";

/**
 * Track 66: PQ Lending Pools tests.
 */
const {
  PqcLendingCollateralHub,
} = require("../pqc-lending-collateral-hub.cjs");
const {
  ZkSolvencyProofProcessor,
} = require("../zk-solvency-proof-processor.cjs");
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
  minLtvRatio: 50,
  minLiquidationSignatureQuorum: 3,
  maxBorrowValueCap: 1000000000,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireBorrowerAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrSubSolvencyClaims: true,
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
    blindedBorrowValueCommitment: "pedersen-borrow-001",
    blindedCollateralCommitment: "pedersen-collateral-001",
    blindedSafetyMarginCommitment: "pedersen-margin-001",
    ltvRatio: 75,
    borrowValueCap: 1000000,
    pqcSignatureScheme: "ML-DSA-65",
    borrowerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseSolvencyRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    blindedCollateralCommitment: "pedersen-collateral-001",
    blindedBorrowValueCommitment: "pedersen-borrow-001",
    zkSolvencyRangeProofHash: "zk-solvency-proof-001",
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: "committee-hash-001",
    attestationAuthority: "mock-authority",
    partialSignature: "partial-sig-001",
    collateralValue: 400,
    borrowValue: 300,
  };
}

function baseLiquidateRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    clearingCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    committeeSignatures: ["sig-a", "sig-b", "sig-c"],
  };
}

function setupHubAndProcessor() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcLendingCollateralHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const processor = new ZkSolvencyProofProcessor({
    policy: POLICY,
    hub,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  return { events, attestationClient, hub, processor };
}

function setupAndInitPool() {
  const ctx = setupHubAndProcessor();
  const pool = ctx.hub.initializePool(baseInitRequest());
  return { ...ctx, pool };
}

function setupInitAndSolvency() {
  const ctx = setupAndInitPool();
  const proof = ctx.processor.verifySolvencyProof(
    baseSolvencyRequest(ctx.pool.poolId),
  );
  return { ...ctx, proof };
}

describe("Track 66 PQ lending pools", () => {
  test("PqcLendingCollateralHub initializes a pool and emits LENDING_POOL_INITIALIZED", () => {
    const { events, hub } = setupHubAndProcessor();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe("open");
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === "LENDING_POOL_INITIALIZED")).toBe(
      true,
    );
  });

  test("ZkSolvencyProofProcessor verifies solvency and emits ZK_SOLVENCY_PROOF_VERIFIED", () => {
    const { events, processor, pool } = setupAndInitPool();
    const proof = processor.verifySolvencyProof(
      baseSolvencyRequest(pool.poolId),
    );
    expect(proof.proofId).toBeDefined();
    expect(events.some((e) => e.event === "ZK_SOLVENCY_PROOF_VERIFIED")).toBe(
      true,
    );
  });

  test("PqcLendingCollateralHub liquidates a pool after solvency and emits COLLATERAL_POOL_LIQUIDATED", () => {
    const { events, hub, pool } = setupInitAndSolvency();
    const liquidation = hub.liquidatePool(baseLiquidateRequest(pool.poolId));
    expect(liquidation.liquidationId).toBeDefined();
    expect(events.some((e) => e.event === "COLLATERAL_POOL_LIQUIDATED")).toBe(
      true,
    );
  });

  test("PqcLendingCollateralHub rejects LTV ratio below minimum", () => {
    const hub = new PqcLendingCollateralHub({ policy: POLICY });
    const request = baseInitRequest();
    request.ltvRatio = 30;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcLendingCollateralHub rejects borrow value cap exceeding maximum", () => {
    const hub = new PqcLendingCollateralHub({ policy: POLICY });
    const request = baseInitRequest();
    request.borrowValueCap = 2000000000;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcLendingCollateralHub rejects un-attested borrower", () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcLendingCollateralHub({
      policy: POLICY,
      attestationClient,
    });
    const request = baseInitRequest();
    request.borrowerAttestation = { authority: "bad" };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("ZkSolvencyProofProcessor rejects un-attested clearing committee", () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const processor = new ZkSolvencyProofProcessor({
      policy: POLICY,
      hub,
      attestationClient,
    });
    const solvReq = baseSolvencyRequest(pool.poolId);
    solvReq.clearingCommitteeAttestation = { authority: "bad" };
    expect(() => processor.verifySolvencyProof(solvReq)).toThrow(
      HsmAdapterError,
    );
  });

  test("PqcLendingCollateralHub rejects unpermitted PQC signature scheme", () => {
    const hub = new PqcLendingCollateralHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = "RSA-2048";
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcLendingCollateralHub rejects duplicate pool initialization", () => {
    const { hub } = setupHubAndProcessor();
    const request = baseInitRequest();
    request.poolId = "pool-dup";
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcLendingCollateralHub rejects liquidation before solvency verification", () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.liquidatePool(baseLiquidateRequest(pool.poolId))).toThrow(
      HsmAdapterError,
    );
  });

  test("PqcLendingCollateralHub rejects liquidation with insufficient quorum", () => {
    const { hub, pool } = setupInitAndSolvency();
    const liqReq = baseLiquidateRequest(pool.poolId);
    liqReq.committeeSignatures = ["sig-a"];
    expect(() => hub.liquidatePool(liqReq)).toThrow(HsmAdapterError);
  });

  test("ZkSolvencyProofProcessor bans peers broadcasting malformed proofs", () => {
    const { processor, pool } = setupAndInitPool();
    const solvReq = baseSolvencyRequest(pool.poolId);
    solvReq.zkSolvencyRangeProofHash = null;
    solvReq.peerId = "peer-bad";
    expect(() => processor.verifySolvencyProof(solvReq)).toThrow(
      HsmAdapterError,
    );
    expect(processor.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkSolvencyProofProcessor bans peers broadcasting sub-solvency proofs", () => {
    const { processor, pool } = setupAndInitPool();
    const solvReq = baseSolvencyRequest(pool.poolId);
    solvReq.collateralValue = 100;
    solvReq.borrowValue = 200;
    solvReq.peerId = "peer-bad";
    expect(() => processor.verifySolvencyProof(solvReq)).toThrow(
      HsmAdapterError,
    );
    expect(processor.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkSolvencyProofProcessor bans peers broadcasting duplicate proofs", () => {
    const { processor, pool } = setupAndInitPool();
    const solvReq = baseSolvencyRequest(pool.poolId);
    solvReq.peerId = "peer-bad";
    processor.verifySolvencyProof(solvReq);
    expect(() => processor.verifySolvencyProof(solvReq)).toThrow(
      HsmAdapterError,
    );
    expect(processor.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq lending pools configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqLendingPools", {
        ltvRatio: 75,
        liquidationSignatureQuorum: 3,
        borrowValueCap: 1000000,
        pqcSignatureScheme: "ML-DSA-65",
        borrowerAttestation: true,
        clearingCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrSubSolvencyClaims: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "pqLendingPools", { ltvRatio: 30 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLendingPools", {
        liquidationSignatureQuorum: 1,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLendingPools", { borrowValueCap: 2000000000 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLendingPools", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLendingPools", { borrowerAttestation: false }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLendingPools", {
        clearingCommitteeAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLendingPools", { attestationAuthority: "bad" }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLendingPools", {
        banMalformedOrSubSolvencyClaims: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqLendingPools", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
