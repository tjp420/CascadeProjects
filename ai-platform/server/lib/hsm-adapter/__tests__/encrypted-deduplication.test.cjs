"use strict";

/**
 * Track 55: Encrypted storage deduplication tests.
 */
const {
  EncryptedStorageDeduplicator,
} = require("../encrypted-storage-deduplicator.cjs");
const { BlindedConvergenceGuard } = require("../blinded-convergence-guard.cjs");
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
  minChunkBitLength: 256,
  maxChunkBitLength: 4096,
  maxCrossTenantChunkAllocations: 16,
  permittedBlindingGroups: ["P-256", "P-384", "P-521"],
  requireSubmitterAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedChunkPeers: true,
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

function baseChunk() {
  return Buffer.from("a".repeat(64), "utf8");
}

function baseSubmitRequest(chunk, tenantId) {
  return {
    sourceTenantId: tenantId || "tenant-a",
    chunk: chunk || baseChunk(),
    submitterPeerId: "peer-1",
    submitterAttestation: mockAttestation(),
    blindingGroup: "P-256",
  };
}

describe("Track 55 encrypted storage deduplication", () => {
  test("EncryptedStorageDeduplicator stores a new chunk", () => {
    const events = [];
    const attestationClient = new MockAttestationClient();
    const guard = new BlindedConvergenceGuard({ policy: POLICY });
    const dedup = new EncryptedStorageDeduplicator({
      policy: POLICY,
      attestationClient,
      convergenceGuard: guard,
      audit: (event, info) => events.push({ event, info }),
    });
    const result = dedup.submit(baseSubmitRequest());
    expect(result.deduplicated).toBe(false);
    expect(result.chunkId).toBeDefined();
  });

  test("EncryptedStorageDeduplicator detects duplicate chunks across tenants", () => {
    const events = [];
    const attestationClient = new MockAttestationClient();
    const guard = new BlindedConvergenceGuard({ policy: POLICY });
    const dedup = new EncryptedStorageDeduplicator({
      policy: POLICY,
      attestationClient,
      convergenceGuard: guard,
      audit: (event, info) => events.push({ event, info }),
    });
    const chunk = baseChunk();
    dedup.submit(baseSubmitRequest(chunk, "tenant-a"));
    const result2 = dedup.submit(baseSubmitRequest(chunk, "tenant-b"));
    expect(result2.deduplicated).toBe(true);
    expect(events.some((e) => e.event === "CIPHERTEXT_TAG_MATCHED")).toBe(true);
    expect(events.some((e) => e.event === "DUPLICATE_BLOCK_RECONCILED")).toBe(
      true,
    );
  });

  test("EncryptedStorageDeduplicator rejects un-attested submitter", () => {
    const attestationClient = new MockAttestationClient();
    const dedup = new EncryptedStorageDeduplicator({
      policy: POLICY,
      attestationClient,
    });
    const request = baseSubmitRequest();
    request.submitterAttestation = { authority: "bad" };
    expect(() => dedup.submit(request)).toThrow(HsmAdapterError);
  });

  test("EncryptedStorageDeduplicator rejects chunk below minimum bit length", () => {
    const dedup = new EncryptedStorageDeduplicator({ policy: POLICY });
    const request = baseSubmitRequest();
    request.chunk = Buffer.from("tiny", "utf8");
    expect(() => dedup.submit(request)).toThrow(HsmAdapterError);
  });

  test("EncryptedStorageDeduplicator rejects chunk exceeding maximum bit length", () => {
    const dedup = new EncryptedStorageDeduplicator({ policy: POLICY });
    const request = baseSubmitRequest();
    request.chunk = Buffer.from("a".repeat(1024), "utf8");
    expect(() => dedup.submit(request)).toThrow(HsmAdapterError);
  });

  test("EncryptedStorageDeduplicator rejects excessive cross-tenant allocations", () => {
    const dedup = new EncryptedStorageDeduplicator({ policy: POLICY });
    const request = baseSubmitRequest();
    request.crossTenantAllocations = 32;
    expect(() => dedup.submit(request)).toThrow(HsmAdapterError);
  });

  test("EncryptedStorageDeduplicator rejects unpermitted blinding group", () => {
    const dedup = new EncryptedStorageDeduplicator({ policy: POLICY });
    const request = baseSubmitRequest();
    request.blindingGroup = "secp256k1";
    expect(() => dedup.submit(request)).toThrow(HsmAdapterError);
  });

  test("BlindedConvergenceGuard bans peers after consecutive malformed tokens", () => {
    const events = [];
    const guard = new BlindedConvergenceGuard({
      policy: POLICY,
      maxConsecutiveFaults: 3,
      audit: (event, info) => events.push({ event, info }),
    });
    guard.validateToken("peer-bad", { chunkId: "c1" });
    guard.validateToken("peer-bad", { chunkId: "c2" });
    expect(guard.isPeerBanned("peer-bad")).toBe(false);
    guard.validateToken("peer-bad", { chunkId: "c3" });
    expect(guard.isPeerBanned("peer-bad")).toBe(true);
    expect(events.some((e) => e.event === "PEER_BANNED_MALFORMED_CHUNK")).toBe(
      true,
    );
  });

  test("BlindedConvergenceGuard produces deterministic blinded tags", () => {
    const guard = new BlindedConvergenceGuard({ policy: POLICY });
    const tag1 = guard.blind("raw-hash-1", "P-256");
    const tag2 = guard.blind("raw-hash-1", "P-256");
    expect(tag1).toBe(tag2);
    expect(tag1).toHaveLength(64);
    const tag3 = guard.blind("raw-hash-1", "P-384");
    expect(tag3).not.toBe(tag1);
  });

  test("CryptoPolicyEngine validates encrypted deduplication configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "encryptedDeduplication", {
        chunkBitLength: 512,
        crossTenantChunkAllocations: 4,
        blindingGroup: "P-256",
        submitterAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedChunkPeers: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "encryptedDeduplication", { chunkBitLength: 128 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "encryptedDeduplication", { chunkBitLength: 8192 }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "encryptedDeduplication", {
        crossTenantChunkAllocations: 32,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "encryptedDeduplication", {
        blindingGroup: "secp256k1",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "encryptedDeduplication", {
        submitterAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "encryptedDeduplication", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "encryptedDeduplication", {
        banMalformedChunkPeers: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "encryptedDeduplication", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
