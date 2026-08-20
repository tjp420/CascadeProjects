"use strict";

/**
 * Track 63: PQ Blind Option Pools tests.
 */
const { PqcBlindOptionPoolHub } = require("../pqc-blind-option-pool-hub.cjs");
const {
  ZkMarginAdequacyProcessor,
} = require("../zk-margin-adequacy-processor.cjs");
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
  minCollateralRatio: 150,
  minExecutionSignatureQuorum: 3,
  maxContractLifetimeSeconds: 2592000,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireInitializerAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrSubCollateralProofs: true,
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
  const now = Math.floor(Date.now() / 1000);
  return {
    sourceTenantId: "tenant-a",
    targetChainId: "chain-b",
    blindedValueCommitment: "pedersen-value-001",
    blindedStrikeCommitment: "pedersen-strike-001",
    blindedCollateralCommitment: "pedersen-collateral-001",
    collateralRatio: 200,
    expirationTimestamp: now + 86400,
    pqcSignatureScheme: "ML-DSA-65",
    initializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseMarginProofRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    blindedCollateralCommitment: "pedersen-collateral-001",
    blindedStrikeCommitment: "pedersen-strike-001",
    zkRangeProofHash: "zk-range-proof-001",
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: "committee-hash-001",
    attestationAuthority: "mock-authority",
    partialSignature: "partial-sig-001",
    collateralValue: 300,
    strikeValue: 100,
  };
}

function baseExecRequest(poolId) {
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
  const hub = new PqcBlindOptionPoolHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const processor = new ZkMarginAdequacyProcessor({
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

function setupInitAndMargin() {
  const ctx = setupAndInitPool();
  const proof = ctx.processor.verifyMarginAdequacy(
    baseMarginProofRequest(ctx.pool.poolId),
  );
  return { ...ctx, proof };
}

describe("Track 63 PQ blind option pools", () => {
  test("PqcBlindOptionPoolHub initializes a pool and emits BLIND_OPTION_POOL_INITIALIZED", () => {
    const { events, hub } = setupHubAndProcessor();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe("open");
    expect(pool.poolId).toBeDefined();
    expect(
      events.some((e) => e.event === "BLIND_OPTION_POOL_INITIALIZED"),
    ).toBe(true);
  });

  test("ZkMarginAdequacyProcessor verifies margin adequacy and emits ZK_MARGIN_ADEQUACY_VERIFIED", () => {
    const { events, processor, pool } = setupAndInitPool();
    const proof = processor.verifyMarginAdequacy(
      baseMarginProofRequest(pool.poolId),
    );
    expect(proof.proofId).toBeDefined();
    expect(events.some((e) => e.event === "ZK_MARGIN_ADEQUACY_VERIFIED")).toBe(
      true,
    );
  });

  test("PqcBlindOptionPoolHub executes a cleared contract and emits BLIND_OPTION_CONTRACT_EXECUTED", () => {
    const { events, hub, pool } = setupInitAndMargin();
    const exec = hub.executeContract(baseExecRequest(pool.poolId));
    expect(exec.execId).toBeDefined();
    expect(
      events.some((e) => e.event === "BLIND_OPTION_CONTRACT_EXECUTED"),
    ).toBe(true);
  });

  test("PqcBlindOptionPoolHub rejects collateral ratio below minimum", () => {
    const hub = new PqcBlindOptionPoolHub({ policy: POLICY });
    const request = baseInitRequest();
    request.collateralRatio = 100;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcBlindOptionPoolHub rejects contract lifetime exceeding maximum", () => {
    const hub = new PqcBlindOptionPoolHub({ policy: POLICY });
    const request = baseInitRequest();
    request.expirationTimestamp = Math.floor(Date.now() / 1000) + 31536000;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcBlindOptionPoolHub rejects un-attested initializer", () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcBlindOptionPoolHub({
      policy: POLICY,
      attestationClient,
    });
    const request = baseInitRequest();
    request.initializerAttestation = { authority: "bad" };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("ZkMarginAdequacyProcessor rejects un-attested clearing committee", () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const processor = new ZkMarginAdequacyProcessor({
      policy: POLICY,
      hub,
      attestationClient,
    });
    const proofReq = baseMarginProofRequest(pool.poolId);
    proofReq.clearingCommitteeAttestation = { authority: "bad" };
    expect(() => processor.verifyMarginAdequacy(proofReq)).toThrow(
      HsmAdapterError,
    );
  });

  test("PqcBlindOptionPoolHub rejects unpermitted PQC signature scheme", () => {
    const hub = new PqcBlindOptionPoolHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = "RSA-2048";
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcBlindOptionPoolHub rejects duplicate pool initialization", () => {
    const { hub } = setupHubAndProcessor();
    const request = baseInitRequest();
    request.poolId = "pool-dup";
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test("PqcBlindOptionPoolHub rejects execution before margin verification", () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.executeContract(baseExecRequest(pool.poolId))).toThrow(
      HsmAdapterError,
    );
  });

  test("PqcBlindOptionPoolHub rejects execution with insufficient quorum", () => {
    const { hub, pool } = setupInitAndMargin();
    const execReq = baseExecRequest(pool.poolId);
    execReq.committeeSignatures = ["sig-a"];
    expect(() => hub.executeContract(execReq)).toThrow(HsmAdapterError);
  });

  test("ZkMarginAdequacyProcessor bans peers broadcasting malformed proofs", () => {
    const { processor, pool } = setupAndInitPool();
    const proofReq = baseMarginProofRequest(pool.poolId);
    proofReq.zkRangeProofHash = null;
    proofReq.peerId = "peer-bad";
    expect(() => processor.verifyMarginAdequacy(proofReq)).toThrow(
      HsmAdapterError,
    );
    expect(processor.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkMarginAdequacyProcessor bans peers broadcasting sub-collateral proofs", () => {
    const { processor, pool } = setupAndInitPool();
    const proofReq = baseMarginProofRequest(pool.poolId);
    proofReq.collateralValue = 50;
    proofReq.strikeValue = 100;
    proofReq.peerId = "peer-bad";
    expect(() => processor.verifyMarginAdequacy(proofReq)).toThrow(
      HsmAdapterError,
    );
    expect(processor.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkMarginAdequacyProcessor bans peers broadcasting duplicate proofs", () => {
    const { processor, pool } = setupAndInitPool();
    const proofReq = baseMarginProofRequest(pool.poolId);
    proofReq.peerId = "peer-bad";
    processor.verifyMarginAdequacy(proofReq);
    const dupReq = baseMarginProofRequest(pool.poolId);
    dupReq.peerId = "peer-bad";
    expect(() => processor.verifyMarginAdequacy(dupReq)).toThrow(
      HsmAdapterError,
    );
    expect(processor.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq blind option pools configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqBlindOptionPools", {
        collateralRatio: 200,
        executionSignatureQuorum: 3,
        contractLifetimeSeconds: 86400,
        pqcSignatureScheme: "ML-DSA-65",
        initializerAttestation: true,
        clearingCommitteeAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrSubCollateralProofs: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "pqBlindOptionPools", { collateralRatio: 100 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBlindOptionPools", {
        executionSignatureQuorum: 1,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBlindOptionPools", {
        contractLifetimeSeconds: 31536000,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBlindOptionPools", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBlindOptionPools", {
        initializerAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBlindOptionPools", {
        clearingCommitteeAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBlindOptionPools", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBlindOptionPools", {
        banMalformedOrSubCollateralProofs: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqBlindOptionPools", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
