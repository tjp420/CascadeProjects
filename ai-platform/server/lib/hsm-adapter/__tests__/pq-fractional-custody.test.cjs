"use strict";

/**
 * Track 65: PQ Fractional Custody tests.
 */
const {
  PqcFractionalCustodyHub,
} = require("../pqc-fractional-custody-hub.cjs");
const {
  ZkFractionalReleaseVerifier,
} = require("../zk-fractional-release-verifier.cjs");
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
  minCustodianQuorum: 3,
  maxFractionalBits: 64,
  maxAssetCustodyCap: 1000000000,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireClaimantAttestation: true,
  requireCustodianRelayAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderCustodyClaims: true,
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
    blindedBalanceCommitment: "pedersen-balance-001",
    assetDenomination: "base",
    assetCustodyCap: 1000000,
    fractionalBits: 32,
    pqcSignatureScheme: "ML-DSA-65",
    claimantAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseReleaseRequest(vaultId) {
  return {
    vaultId: vaultId || "vault-001",
    blindedFractionCommitment: "pedersen-fraction-001",
    zkPartitionProofHash: "zk-partition-proof-001",
    custodianRelayAttestation: mockAttestation(),
    custodianRelayAttestationHash: "relay-hash-001",
    attestationAuthority: "mock-authority",
    partialSignature: "partial-sig-001",
    fractionValue: 100,
  };
}

function baseLiquidateRequest(vaultId, releasedFractionSum) {
  return {
    vaultId: vaultId || "vault-001",
    releasedFractionSum: releasedFractionSum || 300,
  };
}

function setupHubAndVerifier() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcFractionalCustodyHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const verifier = new ZkFractionalReleaseVerifier({
    policy: POLICY,
    hub,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  return { events, attestationClient, hub, verifier };
}

function setupAndInitVault() {
  const ctx = setupHubAndVerifier();
  const vault = ctx.hub.initializeVault(baseInitRequest());
  return { ...ctx, vault };
}

function setupInitAndReleases(releaseCount = 3, fractionValue = 100) {
  const ctx = setupAndInitVault();
  for (let i = 0; i < releaseCount; i++) {
    const releaseReq = baseReleaseRequest(ctx.vault.vaultId);
    releaseReq.peerId = `peer-${i}`;
    releaseReq.fractionValue = fractionValue;
    ctx.verifier.verifyFractionalRelease(releaseReq);
  }
  return { ...ctx };
}

describe("Track 65 PQ fractional custody", () => {
  test("PqcFractionalCustodyHub initializes a vault and emits FRACTIONAL_VAULT_INITIALIZED", () => {
    const { events, hub } = setupHubAndVerifier();
    const vault = hub.initializeVault(baseInitRequest());
    expect(vault.status).toBe("open");
    expect(vault.vaultId).toBeDefined();
    expect(events.some((e) => e.event === "FRACTIONAL_VAULT_INITIALIZED")).toBe(
      true,
    );
  });

  test("ZkFractionalReleaseVerifier records a release and emits FRACTIONAL_RELEASE_SIGNED", () => {
    const { events, verifier, vault } = setupAndInitVault();
    const releaseReq = baseReleaseRequest(vault.vaultId);
    releaseReq.peerId = "peer-1";
    const release = verifier.verifyFractionalRelease(releaseReq);
    expect(release.releaseId).toBeDefined();
    expect(events.some((e) => e.event === "FRACTIONAL_RELEASE_SIGNED")).toBe(
      true,
    );
  });

  test("PqcFractionalCustodyHub liquidates a vault after reconciliation and emits CUSTODY_VAULT_LIQUIDATED", () => {
    const { events, hub, vault } = setupInitAndReleases(3, 100);
    const liquidation = hub.liquidateVault(
      baseLiquidateRequest(vault.vaultId, 300),
    );
    expect(liquidation.liquidationId).toBeDefined();
    expect(events.some((e) => e.event === "CUSTODY_VAULT_LIQUIDATED")).toBe(
      true,
    );
  });

  test("PqcFractionalCustodyHub rejects asset custody cap exceeding maximum", () => {
    const hub = new PqcFractionalCustodyHub({ policy: POLICY });
    const request = baseInitRequest();
    request.assetCustodyCap = 2000000000;
    expect(() => hub.initializeVault(request)).toThrow(HsmAdapterError);
  });

  test("PqcFractionalCustodyHub rejects fractional bits exceeding maximum", () => {
    const hub = new PqcFractionalCustodyHub({ policy: POLICY });
    const request = baseInitRequest();
    request.fractionalBits = 128;
    expect(() => hub.initializeVault(request)).toThrow(HsmAdapterError);
  });

  test("PqcFractionalCustodyHub rejects un-attested claimant", () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcFractionalCustodyHub({
      policy: POLICY,
      attestationClient,
    });
    const request = baseInitRequest();
    request.claimantAttestation = { authority: "bad" };
    expect(() => hub.initializeVault(request)).toThrow(HsmAdapterError);
  });

  test("ZkFractionalReleaseVerifier rejects un-attested custodian relay", () => {
    const { hub, vault } = setupAndInitVault();
    const attestationClient = new MockAttestationClient();
    const verifier = new ZkFractionalReleaseVerifier({
      policy: POLICY,
      hub,
      attestationClient,
    });
    const releaseReq = baseReleaseRequest(vault.vaultId);
    releaseReq.custodianRelayAttestation = { authority: "bad" };
    expect(() => verifier.verifyFractionalRelease(releaseReq)).toThrow(
      HsmAdapterError,
    );
  });

  test("PqcFractionalCustodyHub rejects unpermitted PQC signature scheme", () => {
    const hub = new PqcFractionalCustodyHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = "RSA-2048";
    expect(() => hub.initializeVault(request)).toThrow(HsmAdapterError);
  });

  test("PqcFractionalCustodyHub rejects duplicate vault initialization", () => {
    const { hub } = setupHubAndVerifier();
    const request = baseInitRequest();
    request.vaultId = "vault-dup";
    hub.initializeVault(request);
    expect(() => hub.initializeVault(request)).toThrow(HsmAdapterError);
  });

  test("PqcFractionalCustodyHub rejects liquidation before quorum", () => {
    const { hub, vault } = setupAndInitVault();
    expect(() =>
      hub.liquidateVault(baseLiquidateRequest(vault.vaultId, 0)),
    ).toThrow(HsmAdapterError);
  });

  test("PqcFractionalCustodyHub rejects liquidation with mismatched reconciliation", () => {
    const { hub, vault } = setupInitAndReleases(3, 100);
    const liqReq = baseLiquidateRequest(vault.vaultId, 999);
    expect(() => hub.liquidateVault(liqReq)).toThrow(HsmAdapterError);
  });

  test("ZkFractionalReleaseVerifier bans peers broadcasting malformed releases", () => {
    const { verifier, vault } = setupAndInitVault();
    const releaseReq = baseReleaseRequest(vault.vaultId);
    releaseReq.zkPartitionProofHash = null;
    releaseReq.peerId = "peer-bad";
    expect(() => verifier.verifyFractionalRelease(releaseReq)).toThrow(
      HsmAdapterError,
    );
    expect(verifier.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkFractionalReleaseVerifier bans peers broadcasting duplicate releases", () => {
    const { verifier, vault } = setupAndInitVault();
    const releaseReq = baseReleaseRequest(vault.vaultId);
    releaseReq.peerId = "peer-bad";
    verifier.verifyFractionalRelease(releaseReq);
    expect(() => verifier.verifyFractionalRelease(releaseReq)).toThrow(
      HsmAdapterError,
    );
    expect(verifier.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkFractionalReleaseVerifier bans peers releasing on non-existent vaults", () => {
    const { verifier } = setupAndInitVault();
    const releaseReq = baseReleaseRequest("nonexistent-vault");
    releaseReq.peerId = "peer-bad";
    expect(() => verifier.verifyFractionalRelease(releaseReq)).toThrow(
      HsmAdapterError,
    );
    expect(verifier.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq fractional custody configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqFractionalCustody", {
        custodianQuorum: 3,
        fractionalBits: 32,
        assetCustodyCap: 1000000,
        pqcSignatureScheme: "ML-DSA-65",
        claimantAttestation: true,
        custodianRelayAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedOrOutOfOrderCustodyClaims: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "pqFractionalCustody", { custodianQuorum: 1 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqFractionalCustody", { fractionalBits: 128 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqFractionalCustody", {
        assetCustodyCap: 2000000000,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqFractionalCustody", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqFractionalCustody", {
        claimantAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqFractionalCustody", {
        custodianRelayAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqFractionalCustody", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqFractionalCustody", {
        banMalformedOrOutOfOrderCustodyClaims: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqFractionalCustody", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
