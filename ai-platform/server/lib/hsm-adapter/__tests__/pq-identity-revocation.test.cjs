"use strict";

/**
 * Track 61: PQ Identity Revocation tests.
 */
const {
  PqcIdentityRevocationRegistry,
} = require("../pqc-identity-revocation-registry.cjs");
const {
  ZkRevocationProofVerifier,
} = require("../zk-revocation-proof-verifier.cjs");
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
  minRevocationCommitteeQuorum: 3,
  maxRevocationListCapacity: 100000,
  maxProofExpirationSeconds: 3600,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requirePublisherAttestation: true,
  requireVerifierAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedNonMembershipProofs: true,
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

function basePublishRequest() {
  return {
    sourceTenantId: "tenant-a",
    blindedIdentityHash: "blinded-hash-001",
    pqcSignatureScheme: "ML-DSA-65",
    publisherAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    committeeSignatures: ["sig-a", "sig-b", "sig-c"],
  };
}

function baseProofRequest(entityBlindedHash) {
  return {
    revocationId: "global",
    entityBlindedHash: entityBlindedHash || "blinded-hash-clean",
    nonMembershipWitnessHash: "witness-hash-001",
    zkProofHash: "zk-proof-hash-001",
    partialSignature: "partial-sig-001",
    verifierAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    proofTimestamp: Math.floor(Date.now() / 1000),
  };
}

function setupRegistryAndVerifier() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const registry = new PqcIdentityRevocationRegistry({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const verifier = new ZkRevocationProofVerifier({
    policy: POLICY,
    registry,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  return { events, attestationClient, registry, verifier };
}

describe("Track 61 PQ identity revocation", () => {
  test("PqcIdentityRevocationRegistry publishes a revocation and emits IDENTITY_REVOCATION_PUBLISHED", () => {
    const { events, registry } = setupRegistryAndVerifier();
    const revocation = registry.publishRevocation(basePublishRequest());
    expect(revocation.status).toBe("active");
    expect(revocation.revocationId).toBeDefined();
    expect(
      events.some((e) => e.event === "IDENTITY_REVOCATION_PUBLISHED"),
    ).toBe(true);
  });

  test("ZkRevocationProofVerifier authenticates a valid non-membership proof and emits ZK_REVOCATION_PROOF_AUTHENTICATED", () => {
    const { events, verifier } = setupRegistryAndVerifier();
    const proof = verifier.verifyNonMembershipProof(
      baseProofRequest("blinded-hash-clean"),
    );
    expect(proof.proofId).toBeDefined();
    expect(
      events.some((e) => e.event === "ZK_REVOCATION_PROOF_AUTHENTICATED"),
    ).toBe(true);
  });

  test("ZkRevocationProofVerifier correctly identifies a non-revoked identity", () => {
    const { registry, verifier } = setupRegistryAndVerifier();
    registry.publishRevocation(basePublishRequest());
    expect(registry.isRevoked("blinded-hash-001")).toBe(true);
    expect(registry.isRevoked("blinded-hash-clean")).toBe(false);
    const proof = verifier.verifyNonMembershipProof(
      baseProofRequest("blinded-hash-clean"),
    );
    expect(proof.entityBlindedHash).toBe("blinded-hash-clean");
  });

  test("PqcIdentityRevocationRegistry rejects insufficient committee quorum", () => {
    const registry = new PqcIdentityRevocationRegistry({ policy: POLICY });
    const request = basePublishRequest();
    request.committeeSignatures = ["sig-a"];
    expect(() => registry.publishRevocation(request)).toThrow(HsmAdapterError);
  });

  test("PqcIdentityRevocationRegistry rejects un-attested publisher", () => {
    const attestationClient = new MockAttestationClient();
    const registry = new PqcIdentityRevocationRegistry({
      policy: POLICY,
      attestationClient,
    });
    const request = basePublishRequest();
    request.publisherAttestation = { authority: "bad" };
    expect(() => registry.publishRevocation(request)).toThrow(HsmAdapterError);
  });

  test("ZkRevocationProofVerifier rejects un-attested verifier", () => {
    const { registry } = setupRegistryAndVerifier();
    const attestationClient = new MockAttestationClient();
    const verifier = new ZkRevocationProofVerifier({
      policy: POLICY,
      registry,
      attestationClient,
    });
    const proofReq = baseProofRequest("blinded-hash-clean");
    proofReq.verifierAttestation = { authority: "bad" };
    expect(() => verifier.verifyNonMembershipProof(proofReq)).toThrow(
      HsmAdapterError,
    );
  });

  test("PqcIdentityRevocationRegistry rejects unpermitted PQC signature scheme", () => {
    const registry = new PqcIdentityRevocationRegistry({ policy: POLICY });
    const request = basePublishRequest();
    request.pqcSignatureScheme = "RSA-2048";
    expect(() => registry.publishRevocation(request)).toThrow(HsmAdapterError);
  });

  test("PqcIdentityRevocationRegistry rejects duplicate blinded identity", () => {
    const { registry } = setupRegistryAndVerifier();
    registry.publishRevocation(basePublishRequest());
    const request = basePublishRequest();
    request.revocationId = "revok-dup";
    expect(() => registry.publishRevocation(request)).toThrow(HsmAdapterError);
  });

  test("ZkRevocationProofVerifier rejects non-membership proof for revoked identity", () => {
    const { registry, verifier } = setupRegistryAndVerifier();
    const pubReq = basePublishRequest();
    pubReq.blindedIdentityHash = "blinded-hash-revoked";
    registry.publishRevocation(pubReq);
    const proofReq = baseProofRequest("blinded-hash-revoked");
    expect(() => verifier.verifyNonMembershipProof(proofReq)).toThrow(
      HsmAdapterError,
    );
  });

  test("ZkRevocationProofVerifier rejects expired proofs", () => {
    const { verifier } = setupRegistryAndVerifier();
    const proofReq = baseProofRequest("blinded-hash-clean");
    proofReq.proofTimestamp = Math.floor(Date.now() / 1000) - 7200;
    expect(() => verifier.verifyNonMembershipProof(proofReq)).toThrow(
      HsmAdapterError,
    );
  });

  test("ZkRevocationProofVerifier bans peers broadcasting malformed proofs", () => {
    const { verifier } = setupRegistryAndVerifier();
    const proofReq = baseProofRequest("blinded-hash-clean");
    proofReq.zkProofHash = null;
    proofReq.peerId = "peer-bad";
    expect(() => verifier.verifyNonMembershipProof(proofReq)).toThrow(
      HsmAdapterError,
    );
    expect(verifier.isPeerBanned("peer-bad")).toBe(true);
  });

  test("ZkRevocationProofVerifier bans peers broadcasting duplicate proofs", () => {
    const { verifier } = setupRegistryAndVerifier();
    const proofReq = baseProofRequest("blinded-hash-clean");
    proofReq.peerId = "peer-bad";
    verifier.verifyNonMembershipProof(proofReq);
    const dupReq = baseProofRequest("blinded-hash-clean");
    dupReq.peerId = "peer-bad";
    expect(() => verifier.verifyNonMembershipProof(dupReq)).toThrow(
      HsmAdapterError,
    );
    expect(verifier.isPeerBanned("peer-bad")).toBe(true);
  });

  test("CryptoPolicyEngine validates pq identity revocation configuration", () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() =>
      engine.validate("t1", "pqIdentityRevocation", {
        revocationCommitteeQuorum: 3,
        revocationListCapacity: 10000,
        proofExpirationSeconds: 3600,
        pqcSignatureScheme: "ML-DSA-65",
        publisherAttestation: true,
        verifierAttestation: true,
        attestationAuthority: "mock-authority",
        banMalformedNonMembershipProofs: true,
        canonicalPayloadLayout: true,
      }),
    ).not.toThrow();

    expect(() =>
      engine.validate("t1", "pqIdentityRevocation", {
        revocationCommitteeQuorum: 1,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqIdentityRevocation", {
        revocationListCapacity: 200000,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqIdentityRevocation", {
        proofExpirationSeconds: 7200,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqIdentityRevocation", {
        pqcSignatureScheme: "RSA-2048",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqIdentityRevocation", {
        publisherAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqIdentityRevocation", {
        verifierAttestation: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqIdentityRevocation", {
        attestationAuthority: "bad",
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqIdentityRevocation", {
        banMalformedNonMembershipProofs: false,
      }),
    ).toThrow(HsmAdapterError);
    expect(() =>
      engine.validate("t1", "pqIdentityRevocation", {
        canonicalPayloadLayout: false,
      }),
    ).toThrow(HsmAdapterError);
  });
});
